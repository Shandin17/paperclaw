import { BaseAgent } from "./base.js";
import type { AgentResponse } from "../types/agent.js";
import pdfParse from "pdf-parse";
import { ingestDocument } from "../ingestion/pipeline.js";

export class DoctorAgent extends BaseAgent {
  name = "doctor";
  systemPrompt = `You are a personal medical records assistant. You have access to the user's medical documents including:
- Lab results and blood tests
- Prescriptions and medications
- Medical reports and diagnoses
- Specialist consultations

You help the user:
- Track their medications, dosages, and schedules
- Understand their lab results in plain language
- Find historical medical information
- Identify patterns or changes over time

Always remind the user to consult their doctor for medical decisions.
Be clear, compassionate, and accurate. Respond in the language the user uses.`;

  docFilter = { agent: "doctor" };

  async handleFile(message: string, fileBuffer: Buffer): Promise<AgentResponse> {
    // For medical documents, ingest them automatically
    try {
      const result = await ingestDocument(fileBuffer, "medical_document.pdf", "application/pdf");
      return {
        agent: this.name,
        text:
          `📋 Medical document ingested successfully.\n\n` +
          `**Type**: ${result.docType}\n` +
          `**Summary**: ${result.summary}\n\n` +
          `You can now ask me questions about this document.`,
      };
    } catch {
      // Fallback: just read the PDF
      const parsed = await pdfParse(fileBuffer);
      return {
        agent: this.name,
        text: `I received your medical document. Here's a summary:\n\n${parsed.text.slice(0, 500)}...\n\nNote: This document was not saved to your records.`,
      };
    }
  }
}
