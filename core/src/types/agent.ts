export interface AgentRequest {
  message: string;
  agent?: string;
  file?: Buffer;
  filename?: string;
  mimeType?: string;
}

export interface AgentAttachment {
  filename: string;
  buffer: Buffer;
  mimeType: string;
}

export interface AgentResponse {
  agent: string;
  text: string;
  attachments?: AgentAttachment[];
}

export interface QueryRequest {
  message: string;
  agent?: string;
}
