import { BaseAgent } from './base.js';
import * as llm from '../services/llm.js';
import * as paperless from '../services/paperless.js';
import { fillPdfForm, listFormFields, generateReport } from '../tools/pdf-filler.js';
import { calculateQuarter } from '../tools/tax-calculator.js';
import { getUpcomingDeadlines } from '../services/scheduler.js';
import { IRPF_CATEGORIES } from '../types/tax.js';
import type { AgentResponse, Deadline } from '../types/agent.js';

export class GestorAgent extends BaseAgent {
  name = 'gestor';
  docFilter = { agent: 'gestor' };

  systemPrompt = `You are a Spanish tax assistant specialized in autónomo (self-employed) tax obligations. You help with:

1. Classifying expenses into IRPF deduction categories: ${IRPF_CATEGORIES.join(', ')}
2. Tracking IVA (VAT) collected and paid
3. Preparing quarterly declarations (Modelo 303 for IVA, Modelo 130 for IRPF)
4. Reminding about deadlines
5. Validating invoices have required fields (NIF, base imponible, IVA)

Tax rules:
- Standard IVA: 21% (reduced: 10%, super-reduced: 4%)
- IRPF retention for professionals: 15% (7% first 2 years)
- Modelo 130: 20% of net income (income - deductible expenses)
- Modelo 303: IVA collected - IVA deductible

Always specify quarter and year. Answer in the user's language (Spanish or English).
Base answers ONLY on provided document context. If insufficient, say so clearly.`;

  /**
   * Handle PDF form uploads — fill tax forms with stored data
   */
  async handleFile(
    message: string,
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<AgentResponse> {
    try {
      // List form fields
      const fields = await listFormFields(fileBuffer);

      if (fields.length === 0) {
        return {
          agent: this.name,
          text: `This PDF doesn't have fillable form fields. Upload a fillable version of the form, or ask me to generate a tax summary report instead.`,
        };
      }

      // Gather tax data from Paperless
      const now = new Date();
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      const year = now.getFullYear();
      const taxData = await this.gatherFieldData(quarter, year);

      // Use Haiku to map form field names → tax data values
      const fieldNames = fields.map((f) => f.split(' (')[0]);
      const mapping = await llm.mapFormFields(fieldNames, taxData);

      // Fill the form
      const result = await fillPdfForm(fileBuffer, mapping);

      const summary = [
        `Filled ${result.filled.length} of ${result.allFields.length} fields.`,
        result.filled.length > 0 ? `Filled: ${result.filled.join(', ')}` : '',
        result.missing.length > 0 ? `Missing: ${result.missing.join(', ')}` : '',
        `\nPlease review carefully before submitting to AEAT.`,
      ].filter(Boolean).join('\n');

      return {
        agent: this.name,
        text: summary,
        attachments: [{
          filename: `${fileName.replace('.pdf', '')}_filled_Q${quarter}_${year}.pdf`,
          buffer: result.buffer,
          mimeType: 'application/pdf',
        }],
      };
    } catch (err) {
      return {
        agent: this.name,
        text: `Error processing the form: ${err instanceof Error ? err.message : 'Unknown error'}. Try uploading a different version of the form.`,
      };
    }
  }

  /**
   * Get upcoming tax deadlines
   */
  getDeadlines(): Deadline[] {
    return getUpcomingDeadlines(30);
  }

  /**
   * Generate a quarterly tax summary report as PDF
   */
  async generateQuarterlyReport(quarter: number, year: number): Promise<AgentResponse> {
    const summary = await calculateQuarter(quarter, year);

    const sections = [
      {
        heading: 'Income',
        body: `Total invoiced: €${summary.totalIncome} (${summary.invoiceCount} invoices). IVA collected: €${summary.ivaCollected}.`,
      },
      {
        heading: 'Expenses',
        body: `Total expenses: €${summary.totalExpenses} (${summary.receiptCount} receipts). IVA deductible: €${summary.ivaDeductible}.`,
      },
      {
        heading: 'Modelo 303 (IVA)',
        body: `IVA collected: €${summary.ivaCollected} - IVA deductible: €${summary.ivaDeductible} = Net IVA: €${summary.ivaNet}. ${summary.ivaNet >= 0 ? 'Amount to pay (a ingresar).' : 'Amount to claim (a devolver).'}`,
      },
      {
        heading: 'Modelo 130 (IRPF)',
        body: `Net income: €${summary.irpfBase} (income €${summary.totalIncome} - expenses €${summary.totalExpenses}). IRPF payment (20%): €${summary.irpfPayment}.`,
      },
    ];

    const pdfBuffer = await generateReport(
      `Tax Summary Q${quarter} ${year}`,
      sections,
    );

    return {
      agent: this.name,
      text: `Q${quarter} ${year} summary: Income €${summary.totalIncome}, Expenses €${summary.totalExpenses}. Modelo 303: €${summary.ivaNet}. Modelo 130: €${summary.irpfPayment}.`,
      attachments: [{
        filename: `Tax_Summary_Q${quarter}_${year}.pdf`,
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
      }],
    };
  }

  // ─── Private ─────────────────────────────────────────

  private async gatherFieldData(
    quarter: number,
    year: number,
  ): Promise<Record<string, string>> {
    const summary = await calculateQuarter(quarter, year);
    return {
      periodo: `${quarter}T`,
      ejercicio: String(year),
      base_imponible: String(summary.totalIncome),
      cuota_iva_devengado: String(summary.ivaCollected),
      iva_deducible: String(summary.ivaDeductible),
      resultado: String(summary.ivaNet),
      ingresos: String(summary.totalIncome),
      gastos: String(summary.totalExpenses),
      rendimiento_neto: String(summary.irpfBase),
      pago_fraccionado: String(summary.irpfPayment),
    };
  }
}
