export const IRPF_CATEGORIES = [
  'suministros',
  'alquiler',
  'dietas',
  'transporte',
  'material_oficina',
  'telefonia',
  'formacion',
  'seguros',
  'asesoria',
  'publicidad',
  'software',
  'amortizacion',
  'otros',
] as const;

export type IrpfCategory = (typeof IRPF_CATEGORIES)[number];

export interface TaxDeadline {
  month: number;
  day: number;
  model: string;
  description: string;
}

export const TAX_DEADLINES: TaxDeadline[] = [
  { month: 1, day: 20, model: '303', description: 'IVA Q4 (Oct-Dec prev year)' },
  { month: 1, day: 30, model: '130', description: 'IRPF Q4 (Oct-Dec prev year)' },
  { month: 1, day: 30, model: '390', description: 'Annual IVA summary' },
  { month: 4, day: 20, model: '303', description: 'IVA Q1 (Jan-Mar)' },
  { month: 4, day: 20, model: '130', description: 'IRPF Q1 (Jan-Mar)' },
  { month: 7, day: 20, model: '303', description: 'IVA Q2 (Apr-Jun)' },
  { month: 7, day: 20, model: '130', description: 'IRPF Q2 (Apr-Jun)' },
  { month: 10, day: 20, model: '303', description: 'IVA Q3 (Jul-Sep)' },
  { month: 10, day: 20, model: '130', description: 'IRPF Q3 (Jul-Sep)' },
];
