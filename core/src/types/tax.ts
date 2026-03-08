export interface TaxDeadline {
  name: string;
  model: string;
  dueDate: string;
  quarter?: number;
  year?: number;
  description: string;
}

export interface QuarterlyTaxSummary {
  year: number;
  quarter: number;
  totalRevenue: number;
  totalExpenses: number;
  ivaCollected: number;
  ivaPaid: number;
  ivaToPay: number;
  irpfRetained: number;
  netIncome: number;
}

export interface TaxItem {
  paperlessId: number;
  date: string;
  vendor: string;
  description: string;
  baseAmount: number;
  ivaRate: number;
  ivaAmount: number;
  irpfRate: number;
  irpfAmount: number;
  type: "income" | "expense";
}
