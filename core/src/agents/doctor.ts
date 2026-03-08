import { BaseAgent } from './base.js';
import { generateReport } from '../tools/pdf-filler.js';
import * as llm from '../services/llm.js';
import * as vectorstore from '../services/vectorstore.js';
import type { AgentResponse } from '../types/agent.js';

export class DoctorAgent extends BaseAgent {
  name = 'doctor';
  docFilter = { agent: 'doctor' };

  systemPrompt = `You are a medical document assistant. You help by:

1. Analyzing medical reports, prescriptions, and bills
2. Building a timeline of diagnoses and treatments
3. Tracking medications and flagging potential interactions
4. Suggesting which type of specialist to consult based on diagnoses
5. Summarizing conditions in plain language

IMPORTANT LIMITATIONS:
- You are NOT a doctor. Always recommend consulting a real professional.
- Never diagnose. Only summarize what documents say.
- Flag potential medication interactions as "worth discussing with your doctor."
- When suggesting specialists, explain WHY based on document content.

Answer in the user's language. Base answers ONLY on provided medical documents.`;

  /**
   * Generate a medical summary PDF for sharing with a new doctor
   */
  async generateMedicalSummary(): Promise<AgentResponse> {
    // Get all medical documents via vector search
    const dummyEmbedding = await llm.embed(['medical history summary all diagnoses medications']);
    const results = await vectorstore.search(dummyEmbedding[0], { agent: 'doctor' }, 20);

    if (results.length === 0) {
      return {
        agent: this.name,
        text: 'No medical documents found. Upload some medical reports first.',
      };
    }

    const contextDocs = results.map((r) => r.text);

    // Ask Sonnet to create a structured summary
    const summaryText = await llm.reason(
      `You are creating a medical summary document. Organize the information into these sections:
1. Personal Information (if available)
2. Diagnoses (chronological)
3. Current Medications
4. Past Treatments
5. Recent Lab Results
6. Specialist Visits

Format each section clearly. Note: this is for sharing with a new doctor.`,
      'Create a comprehensive medical summary from all available documents.',
      contextDocs,
    );

    // Parse sections from the response (simple split by numbered headers)
    const sections = parseSections(summaryText);

    const pdfBuffer = await generateReport('Medical Summary', sections);

    return {
      agent: this.name,
      text: 'Medical summary generated. Please review before sharing with your doctor.',
      attachments: [{
        filename: `Medical_Summary_${new Date().toISOString().split('T')[0]}.pdf`,
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
      }],
    };
  }
}

function parseSections(text: string): { heading: string; body: string }[] {
  // Split by lines that look like headers (numbered or bold patterns)
  const lines = text.split('\n');
  const sections: { heading: string; body: string }[] = [];
  let currentHeading = 'Summary';
  let currentBody: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)/) || line.match(/^\d+\.\s+(.+)/);
    if (headerMatch) {
      if (currentBody.length > 0) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
      }
      currentHeading = headerMatch[1].replace(/\*+/g, '').trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  if (currentBody.length > 0) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
  }

  return sections.length > 0 ? sections : [{ heading: 'Summary', body: text }];
}
