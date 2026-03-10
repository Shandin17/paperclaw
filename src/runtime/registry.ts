import fs from 'fs/promises'
import path from 'path'
import type { AgentDefinition, AgentManifest, CustomRunnerFn } from './types.ts'
import { logger } from '../utils/logger.ts'

export class AgentRegistry {
  private agents = new Map<string, AgentDefinition>()

  async loadAll (agentsDir: string): Promise<void> {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const agentDir = path.join(agentsDir, entry.name)

      try {
        const manifestRaw = await fs.readFile(path.join(agentDir, 'manifest.json'), 'utf-8')
        const manifest = JSON.parse(manifestRaw) as AgentManifest
        const systemPrompt = await fs.readFile(path.join(agentDir, 'SKILL.md'), 'utf-8')

        let customRunner: CustomRunnerFn | undefined
        const runnerPath = path.join(agentDir, 'index.js')
        try {
          await fs.access(runnerPath)
          const mod = await import(runnerPath) as { default: CustomRunnerFn }
          customRunner = mod.default
        } catch {
          // no custom runner
        }

        this.agents.set(manifest.name, { manifest, systemPrompt, customRunner })
        logger.debug({ agent: manifest.name }, 'Loaded agent')
      } catch (err) {
        logger.error({ agent: entry.name, err }, 'Failed to load agent')
      }
    }

    logger.info({ count: this.agents.size, agents: this.names() }, 'Agent registry loaded')
  }

  get (name: string): AgentDefinition | undefined {
    return this.agents.get(name)
  }

  getAll (): AgentDefinition[] {
    return Array.from(this.agents.values())
  }

  names (): string[] {
    return Array.from(this.agents.keys())
  }

  manifests (): AgentManifest[] {
    return this.getAll().map(a => a.manifest)
  }
}
