import type { AppContext } from '../context.ts'
import { PaperlessClient } from '../../clients/paperless.ts'
import type { AgentRegistry } from '../../runtime/registry.ts'

const paperless = new PaperlessClient()

export function registerCommandHandlers (bot: { command: Function }, registry: AgentRegistry): void {
  bot.command('start', async (ctx: AppContext) => {
    await ctx.reply(
      'Hi! I\'m Paperclaw 📄\n\n' +
      'I can store and retrieve your personal documents — passports, contracts, receipts, and more.\n\n' +
      'Just send me a file or ask a question like:\n' +
      '• "What\'s my passport number?"\n' +
      '• "Find my lease contract"\n' +
      '• "Fill this form" (attach the form)\n\n' +
      'Commands: /list /agents'
    )
  })

  bot.command('list', async (ctx: AppContext) => {
    try {
      const docs = await paperless.list(1, 25)
      if (docs.length === 0) {
        await ctx.reply('No documents stored yet. Send me a file to get started!')
        return
      }
      const lines = docs.map((d, i) => `${i + 1}. ${d.title} (ID: ${d.id})`)
      await ctx.reply(`Your documents:\n\n${lines.join('\n')}`)
    } catch (err) {
      await ctx.reply('Could not fetch documents. Is Paperless running?')
    }
  })

  bot.command('agents', async (ctx: AppContext) => {
    const agents = registry.manifests()
    const lines = agents.map(a => `• **${a.name}**: ${a.description}`)
    await ctx.reply(`Active agents:\n\n${lines.join('\n')}`)
  })
}
