import { BaseAgent } from "./base.js";
import type { AgentResponse } from "../types/agent.js";
import { fillPdfForm, listFormFields } from "../tools/pdf-filler.js";
import * as llm from "../services/llm.js";
import * as paperless from "../services/paperless.js";
import * as vectorstore from "../services/vectorstore.js";

export class GestorAgent extends BaseAgent {
  name = "gestor";
  systemPrompt = `Eres un asesor fiscal experto en España para autónomos.
Ayudas con:
- Declaraciones trimestrales de IVA (Modelo 303)
- Pagos fraccionados de IRPF (Modelo 130)
- Resumen anual de IVA (Modelo 390)
- Renta anual (Modelo 100)
- Deducciones permitidas y gastos deducibles
- Plazos y calendarios fiscales

Responde siempre en español con claridad. Si das cifras, explica el cálculo.
Advierte que el usuario debe revisar antes de presentar a AEAT.`;

  docFilter = { agent: "gestor" };

  async handleFile(message: string, fileBuffer: Buffer): Promise<AgentResponse> {
    try {
      // User sent a PDF form — try to fill it
      const fields = await listFormFields(fileBuffer);

      if (fields.length === 0) {
        return {
          agent: this.name,
          text: "Este PDF no tiene campos de formulario rellenables. ¿Quieres que lo analice y genere un resumen?",
        };
      }

      // Gather all relevant tax data from vector store
      const taxData = await this.gatherTaxData();

      // Use Haiku to map form fields → tax data
      const mapping = await llm.mapFieldsToData(fields, taxData);

      if (Object.keys(mapping).length === 0) {
        return {
          agent: this.name,
          text: `El formulario tiene ${fields.length} campos pero no encontré datos suficientes para rellenarlos.\n\nCampos detectados:\n${fields.join("\n")}`,
        };
      }

      // Fill the PDF
      const filledPdf = await fillPdfForm(fileBuffer, mapping);
      const quarter = this.currentQuarter();
      const year = new Date().getFullYear();

      return {
        agent: this.name,
        text:
          `✅ Modelo rellenado con datos del Q${quarter}/${year}.\n` +
          `📝 Campos rellenados: ${Object.keys(mapping).length} de ${fields.length}.\n` +
          `⚠️ Revisa todos los campos antes de presentar a AEAT.`,
        attachments: [
          {
            filename: `Modelo_rellenado_Q${quarter}_${year}.pdf`,
            buffer: filledPdf,
            mimeType: "application/pdf",
          },
        ],
      };
    } catch (err) {
      return {
        agent: this.name,
        text: `Error al procesar el PDF: ${(err as Error).message}`,
      };
    }
  }

  private currentQuarter(): number {
    return Math.ceil((new Date().getMonth() + 1) / 3);
  }

  private async gatherTaxData(): Promise<Record<string, string>> {
    const quarter = this.currentQuarter();
    const year = new Date().getFullYear();

    // Search for all gestor documents from current quarter
    const [queryEmbedding] = await llm.embed([`facturas recibos IVA IRPF Q${quarter} ${year}`]);
    const results = await vectorstore.search(queryEmbedding, { agent: "gestor" }, 20);

    // Aggregate key financial data
    const allText = results.map((r) => r.text).join("\n");

    // Use Haiku to extract aggregated tax totals
    const summaryResponse = await llm.reason(
      `Extrae los siguientes totales del texto de documentos fiscales del Q${quarter}/${year}:
- total_ingresos: suma total de ingresos/facturación
- total_gastos: suma total de gastos deducibles
- iva_repercutido: total IVA cobrado a clientes
- iva_soportado: total IVA pagado en compras
- irpf_retenido: total IRPF retenido por clientes
- base_imponible: base imponible total

Responde SOLO con JSON válido. Usa "0" si no hay datos.`,
      "Extrae totales fiscales",
      [allText.slice(0, 6000)],
    );

    try {
      const parsed = JSON.parse(summaryResponse) as Record<string, string>;
      return {
        ...parsed,
        ejercicio: year.toString(),
        periodo: `${quarter}T`,
        quarter: quarter.toString(),
        year: year.toString(),
      };
    } catch {
      return {
        ejercicio: year.toString(),
        periodo: `${quarter}T`,
        quarter: quarter.toString(),
        year: year.toString(),
      };
    }
  }
}
