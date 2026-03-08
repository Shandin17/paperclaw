export interface AgentRequest {
  agent?: string;
  message: string;
  fileBuffer?: Buffer;
  fileName?: string;
}

export interface AgentResponse {
  agent: string;
  text: string;
  attachments?: Attachment[];
}

export interface Attachment {
  filename: string;
  buffer: Buffer;
  mimeType: string;
}

export interface Deadline {
  model: string;
  description: string;
  deadline: string;
  daysUntil: number;
  urgent: boolean;
}
