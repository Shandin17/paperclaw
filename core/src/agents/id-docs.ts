import { BaseAgent } from "./base.js";
import type { AgentResponse } from "../types/agent.js";
import { fillPdfForm, listFormFields } from "../tools/pdf-filler.js";
import * as llm from "../services/llm.js";
import * as vectorstore from "../services/vectorstore.js";

export class IdDocsAgent extends BaseAgent {
  name = "id_docs";
  systemPrompt = `You are a document assistant specializing in ID documents and official forms.
You help the user:
- Fill out official Spanish forms (empadronamiento, NIE, residency, etc.)
- Answer questions about their personal documents (DNI, NIE, passport, etc.)
- Understand requirements for official procedures

You have access to the user's stored ID documents.
Be precise with personal data. Respond in the language the user uses.`;

  docFilter = { agent: "id_docs" };

  async handleFile(message: string, fileBuffer: Buffer): Promise<AgentResponse> {
    try {
      const fields = await listFormFields(fileBuffer);

      if (fields.length === 0) {
        return {
          agent: this.name,
          text: "This PDF doesn't have fillable form fields. Would you like me to analyze it instead?",
        };
      }

      // Gather ID data from stored documents
      const idData = await this.gatherIdData();
      const mapping = await llm.mapFieldsToData(fields, idData);

      if (Object.keys(mapping).length === 0) {
        return {
          agent: this.name,
          text: `Form detected with ${fields.length} fields:\n${fields.join("\n")}\n\nI couldn't find enough ID data to fill it. Please make sure your ID documents are in the system.`,
        };
      }

      const filledPdf = await fillPdfForm(fileBuffer, mapping);

      return {
        agent: this.name,
        text:
          `✅ Form filled with your ID data.\n` +
          `📝 ${Object.keys(mapping).length} of ${fields.length} fields filled.\n` +
          `⚠️ Please review all fields before submitting.`,
        attachments: [
          {
            filename: `form_filled_${Date.now()}.pdf`,
            buffer: filledPdf,
            mimeType: "application/pdf",
          },
        ],
      };
    } catch (err) {
      return {
        agent: this.name,
        text: `Error processing form: ${(err as Error).message}`,
      };
    }
  }

  private async gatherIdData(): Promise<Record<string, string>> {
    const [queryEmbedding] = await llm.embed(["personal data name address DNI NIE passport"]);
    const results = await vectorstore.search(queryEmbedding, { agent: "id_docs" }, 10);
    const allText = results.map((r) => r.text).join("\n");

    const extracted = await llm.reason(
      `Extract personal identification data from the documents. Return ONLY JSON with these fields (use empty string if not found):
{
  "nombre": "",
  "apellidos": "",
  "fecha_nacimiento": "",
  "lugar_nacimiento": "",
  "nacionalidad": "",
  "numero_documento": "",
  "tipo_documento": "",
  "direccion": "",
  "codigo_postal": "",
  "municipio": "",
  "provincia": "",
  "telefono": "",
  "email": ""
}`,
      "Extract personal data",
      [allText.slice(0, 4000)],
    );

    try {
      return JSON.parse(extracted) as Record<string, string>;
    } catch {
      return {};
    }
  }
}
