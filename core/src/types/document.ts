export interface Classification {
  doc_type:
    | 'receipt'
    | 'invoice'
    | 'medical_report'
    | 'id_document'
    | 'tax_form'
    | 'bank_statement'
    | 'contract'
    | 'other';
  agent: 'gestor' | 'doctor' | 'id_docs';
  language: string;
  confidence: number;
}

export interface ExtractedFields {
  [key: string]: string | number | string[] | null;
}

export interface IngestResult {
  paperlessId: number;
  classification: Classification;
  extractedFields: ExtractedFields;
  chunksStored: number;
}

export interface DocumentMetadata {
  agent: string;
  docType: string;
  year: string;
  quarter: string;
}

export interface SearchResult {
  text: string;
  paperlessId: number;
  score: number;
}
