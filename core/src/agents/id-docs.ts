import { BaseAgent } from './base.js';
import * as llm from '../services/llm.js';
import * as vectorstore from '../services/vectorstore.js';
import { fillPdfForm, listFormFields } from '../tools/pdf-filler.js';
import type { AgentResponse } from '../types/agent.js';

export class IdDocsAgent extends BaseAgent {
  name = 'id_docs';
  docFilter = { agent: 'id_docs' };

  systemPrompt = `You are a personal ID document assistant. You help by:

1. Storing and retrieving personal identification data
2. Auto-filling form fields with stored personal information
3. Tracking document expiry dates and alerting before expiry
4. Providing the correct document data when filling official forms

Available data types: passport, DNI/NIE, driver's license, birth certificate,
marriage certificate, social security, bank account details, addresses.

When asked to fill a form, list exactly which fields you can fill
from stored documents and which fields are missing.

PRIVACY: Treat all ID data as highly sensitive.
Only share specific fields when explicitly asked.
Answer in the user's language.`;

  /**
   * Handle PDF form uploads — fill with personal data from stored ID documents
   */
  async handleFile(
    message: string,
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<AgentResponse> {
    try {
      const fields = await listFormFields(fileBuffer);

      if (fields.length === 0) {
        return {
          agent: this.name,
          text: `This PDF doesn't have fillable form fields. I can only auto-fill forms with fillable fields. Try uploading a different version.`,
        };
      }

      // Gather all personal data from stored ID documents
      const personalData = await this.gatherPersonalData();

      if (Object.keys(personalData).length === 0) {
        return {
          agent: this.name,
          text: `I don't have any stored ID documents yet. Upload your DNI/NIE, passport, or other ID documents first, then I can fill forms for you.`,
        };
      }

      // Use Haiku to map form field names → personal data
      const fieldNames = fields.map((f) => f.split(' (')[0]);
      const mapping = await llm.mapFormFields(fieldNames, personalData);

      // Fill the form
      const result = await fillPdfForm(fileBuffer, mapping);

      const summary = [
        `Filled ${result.filled.length} of ${result.allFields.length} fields with your personal data.`,
        result.filled.length > 0 ? `✅ Filled: ${result.filled.join(', ')}` : '',
        result.missing.length > 0 ? `❌ Missing: ${result.missing.join(', ')}` : '',
        result.missing.length > 0 ? `\nReply with the missing values and I'll add them.` : '',
      ].filter(Boolean).join('\n');

      return {
        agent: this.name,
        text: summary,
        attachments: [{
          filename: `${fileName.replace('.pdf', '')}_filled.pdf`,
          buffer: result.buffer,
          mimeType: 'application/pdf',
        }],
      };
    } catch (err) {
      return {
        agent: this.name,
        text: `Error processing the form: ${err instanceof Error ? err.message : 'Unknown error'}.`,
      };
    }
  }

  // ─── Private ─────────────────────────────────────────

  private async gatherPersonalData(): Promise<Record<string, string>> {
    // Search all ID documents in vector store
    const embedding = await llm.embed([
      'personal data name NIE DNI passport address date of birth nationality',
    ]);
    const results = await vectorstore.search(embedding[0], { agent: 'id_docs' }, 15);

    if (results.length === 0) return {};

    // Ask Haiku to extract a unified personal data record
    const contextDocs = results.map((r) => r.text);
    const response = await llm.reason(
      `Extract ALL personal identification data from these documents into a single flat JSON object.
Use these standard field names where possible:
full_name, first_name, last_name, date_of_birth, nationality, gender,
document_number, nie_number, passport_number, drivers_license_number,
address, city, postal_code, province, country,
phone, email, social_security_number, tax_id_nif
Return ONLY valid JSON. No explanation.`,
      'Extract personal data.',
      contextDocs,
    );

    try {
      return JSON.parse(response);
    } catch {
      return {};
    }
  }
}
