import type { TaxItem, QuarterlyTaxSummary } from "../types/tax.js";

export function calculateQuarterlySummary(
  items: TaxItem[],
  year: number,
  quarter: number,
): QuarterlyTaxSummary {
  const income = items.filter((i) => i.type === "income");
  const expenses = items.filter((i) => i.type === "expense");

  const totalRevenue = income.reduce((sum, i) => sum + i.baseAmount, 0);
  const totalExpenses = expenses.reduce((sum, i) => sum + i.baseAmount, 0);
  const ivaCollected = income.reduce((sum, i) => sum + i.ivaAmount, 0);
  const ivaPaid = expenses.reduce((sum, i) => sum + i.ivaAmount, 0);
  const irpfRetained = income.reduce((sum, i) => sum + i.irpfAmount, 0);

  return {
    year,
    quarter,
    totalRevenue,
    totalExpenses,
    ivaCollected,
    ivaPaid,
    ivaToPay: ivaCollected - ivaPaid,
    irpfRetained,
    netIncome: totalRevenue - totalExpenses,
  };
}

export function calculateIVA(base: number, rate: 0 | 4 | 10 | 21 = 21): number {
  return base * (rate / 100);
}

export function calculateIRPF(base: number, rate: 7 | 15 | 19 = 15): number {
  return base * (rate / 100);
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatQuarterlySummaryText(summary: QuarterlyTaxSummary): string {
  return `
📊 **Resumen Fiscal Q${summary.quarter}/${summary.year}**

💰 **Ingresos**: ${formatCurrency(summary.totalRevenue)}
💸 **Gastos**: ${formatCurrency(summary.totalExpenses)}
📈 **Resultado neto**: ${formatCurrency(summary.netIncome)}

🔷 **IVA repercutido** (cobrado): ${formatCurrency(summary.ivaCollected)}
🔶 **IVA soportado** (pagado): ${formatCurrency(summary.ivaPaid)}
✅ **IVA a pagar (Modelo 303)**: ${formatCurrency(summary.ivaToPay)}

🏦 **IRPF retenido por clientes**: ${formatCurrency(summary.irpfRetained)}
`.trim();
}
