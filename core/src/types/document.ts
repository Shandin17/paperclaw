export type DocType =
  | "receipt"
  | "invoice"
  | "medical_report"
  | "prescription"
  | "lab_result"
  | "id_document"
  | "contract"
  | "tax_form"
  | "bank_statement"
  | "other";

export type AgentName = "gestor" | "doctor" | "id_docs" | "general";

export interface DocumentMetadata {
  paperlessId: number;
  docType: DocType;
  agent: AgentName;
  title: string;
  date: string;
  year: string;
  quarter: string;
  tags: string[];
  customFields: Record<string, string>;
}

export interface Classification {
  doc_type: DocType;
  agent: AgentName;
  confidence: number;
}

export interface ExtractedFields {
  amount?: string;
  currency?: string;
  vendor?: string;
  date?: string;
  iva_rate?: string;
  iva_amount?: string;
  irpf_rate?: string;
  description?: string;
  [key: string]: string | undefined;
}
