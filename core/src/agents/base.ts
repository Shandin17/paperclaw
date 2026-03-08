import * as llm from '../services/llm.js';
import * as vectorstore from '../services/vectorstore.js';
import type { AgentResponse } from '../types/agent.js';

export abstract class BaseAgent {
  abstract name: string;
  abstract systemPrompt: string;
  abstract docFilter: { agent?: string; docType?: string };

  async answer(message: string, fileBuffer?: Buffer, fileName?: string): Promise<AgentResponse> {
    // If user sent a file (e.g. PDF form to fill), delegate to file handler
    if (fileBuffer) {
      return this.handleFile(message, fileBuffer, fileName ?? 'document.pdf');
    }

    // 1. Embed the question
    const [queryEmbedding] = await llm.embed([message]);

    // 2. Retrieve relevant document chunks
    const results = await vectorstore.search(queryEmbedding, this.docFilter);
    const contextDocs = results.map((r) => r.text);

    // 3. Reason with Sonnet using document context
    const text = await llm.reason(this.systemPrompt, message, contextDocs);

    return { agent: this.name, text };
  }

  /**
   * Override in subclasses to handle file uploads (PDF form filling, etc.)
   */
  async handleFile(
    message: string,
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<AgentResponse> {
    return {
      agent: this.name,
      text: `I received "${fileName}" but this agent doesn't have a file handler yet. Ask me questions about your documents instead.`,
    };
  }
}
