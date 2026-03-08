import { GestorAgent } from './gestor.js';
import { DoctorAgent } from './doctor.js';
import { IdDocsAgent } from './id-docs.js';
import { BaseAgent } from './base.js';
import * as llm from '../services/llm.js';
import type { AgentResponse } from '../types/agent.js';

const AGENTS: Record<string, () => BaseAgent> = {
  gestor: () => new GestorAgent(),
  doctor: () => new DoctorAgent(),
  id_docs: () => new IdDocsAgent(),
};

export async function routeToAgent(
  agentName: string | undefined,
  message: string,
  fileBuffer?: Buffer,
  fileName?: string,
): Promise<AgentResponse> {
  // Auto-detect agent if not specified
  if (!agentName || agentName === 'auto') {
    agentName = await llm.classifyIntent(message);
    console.log(`[router] Auto-classified intent → ${agentName}`);
  }

  const factory = AGENTS[agentName];
  if (!factory) {
    return {
      agent: 'router',
      text: `Unknown agent "${agentName}". Available agents: ${Object.keys(AGENTS).join(', ')}`,
    };
  }

  const agent = factory();
  return agent.answer(message, fileBuffer, fileName);
}

export function getAgentNames(): string[] {
  return Object.keys(AGENTS);
}
