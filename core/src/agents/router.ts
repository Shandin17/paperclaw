import * as llm from "../services/llm.js";
import { GestorAgent } from "./gestor.js";
import { DoctorAgent } from "./doctor.js";
import { IdDocsAgent } from "./id-docs.js";
import { BaseAgent } from "./base.js";

const agents: Record<string, BaseAgent> = {
  gestor: new GestorAgent(),
  doctor: new DoctorAgent(),
  id_docs: new IdDocsAgent(),
};

// A general-purpose agent for queries that don't fit a specific domain
class GeneralAgent extends BaseAgent {
  name = "general";
  systemPrompt = `You are a helpful document assistant. You help the user find and understand their stored documents.
Respond in the language the user uses.`;
  docFilter = {};
}

agents["general"] = new GeneralAgent();

export function getAgent(name: string): BaseAgent {
  return agents[name] ?? agents["general"];
}

export async function routeMessage(message: string): Promise<BaseAgent> {
  const routingPrompt = `Classify this user message and return ONLY one of these agent names:
- "gestor" — tax, IVA, IRPF, receipts, invoices, fiscal, impuesto, declaración
- "doctor" — medical, medication, prescription, lab, diagnosis, health, medicamento
- "id_docs" — ID document, empadronamiento, NIE, passport, DNI, form filling, registration
- "general" — anything else

Return ONLY the agent name, nothing else.`;

  try {
    const response = await llm.reason(routingPrompt, message, []);
    const agentName = response.trim().toLowerCase().replace(/['"]/g, "");
    return getAgent(agentName);
  } catch {
    return agents["general"];
  }
}
