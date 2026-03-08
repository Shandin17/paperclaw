import * as llm from "../services/llm.js";
import * as vectorstore from "../services/vectorstore.js";
import type { AgentResponse } from "../types/agent.js";

export abstract class BaseAgent {
  abstract name: string;
  abstract systemPrompt: string;
  abstract docFilter: { agent?: string; docType?: string };

  async answer(message: string, fileBuffer?: Buffer): Promise<AgentResponse> {
    if (fileBuffer) {
      return this.handleFile(message, fileBuffer);
    }

    // Embed the question
    const [queryEmbedding] = await llm.embed([message]);

    // Retrieve relevant docs
    const results = await vectorstore.search(queryEmbedding, this.docFilter);
    const contextDocs = results.map((r) => r.text);

    // Reason with Sonnet
    const text = await llm.reason(this.systemPrompt, message, contextDocs);

    return { agent: this.name, text };
  }

  async handleFile(message: string, _fileBuffer: Buffer): Promise<AgentResponse> {
    return {
      agent: this.name,
      text: `File received but ${this.name} agent has no file handler. ${message}`,
    };
  }
}
