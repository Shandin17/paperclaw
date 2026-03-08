import * as paperless from '../services/paperless.js';

export interface QuarterSummary {
  quarter: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  ivaCollected: number;
  ivaDeductible: number;
  ivaNet: number;
  irpfBase: number;
  irpfPayment: number;
  invoiceCount: number;
  receiptCount: number;
}

/**
 * Calculate quarterly tax totals from Paperless documents.
 * Searches for documents tagged with the quarter and extracts amounts.
 */
export async function calculateQuarter(
  quarter: number,
  year: number,
): Promise<QuarterSummary> {
  const invoices = await paperless.searchDocuments('', [
    `agent:gestor`,
    `type:invoice`,
    `tax:q${quarter}`,
    `year:${year}`,
  ]);

  const receipts = await paperless.searchDocuments('', [
    `agent:gestor`,
    `type:receipt`,
    `tax:q${quarter}`,
    `year:${year}`,
  ]);

  // Sum up amounts from custom fields
  let totalIncome = 0;
  let ivaCollected = 0;
  for (const inv of invoices) {
    const amount = extractCustomField(inv, 'amount');
    const iva = extractCustomField(inv, 'amount_iva');
    if (amount) totalIncome += amount;
    if (iva) ivaCollected += iva;
  }

  let totalExpenses = 0;
  let ivaDeductible = 0;
  for (const rec of receipts) {
    const amount = extractCustomField(rec, 'amount');
    const iva = extractCustomField(rec, 'amount_iva');
    if (amount) totalExpenses += amount;
    if (iva) ivaDeductible += iva;
  }

  const ivaNet = ivaCollected - ivaDeductible;
  const irpfBase = totalIncome - totalExpenses;
  const irpfPayment = irpfBase * 0.20; // Modelo 130: 20% of net income

  return {
    quarter,
    year,
    totalIncome: round(totalIncome),
    totalExpenses: round(totalExpenses),
    ivaCollected: round(ivaCollected),
    ivaDeductible: round(ivaDeductible),
    ivaNet: round(ivaNet),
    irpfBase: round(irpfBase),
    irpfPayment: round(irpfPayment),
    invoiceCount: invoices.length,
    receiptCount: receipts.length,
  };
}

function extractCustomField(doc: any, fieldName: string): number | null {
  const fields = doc.custom_fields ?? [];
  for (const f of fields) {
    if (f.field?.name === fieldName && f.value != null) {
      return parseFloat(f.value);
    }
  }
  return null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
