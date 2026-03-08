const CORE_URL = process.env.PAPERCLAW_CORE_URL || 'http://paperclaw-core:8080';

export default async function handler(context) {
  try {
    // Fetch deadlines
    const deadlinesRes = await fetch(`${CORE_URL}/deadlines`);
    const { deadlines } = await deadlinesRes.json();

    // Fetch health
    const healthRes = await fetch(`${CORE_URL}/health`);
    const health = await healthRes.json();

    let reply = `📊 PaperClaw Status\n`;
    reply += `Service: ${health.status}\n`;
    reply += `Agents: ${health.agents?.join(', ') ?? 'unknown'}\n\n`;

    if (deadlines.length === 0) {
      reply += `✅ No upcoming tax deadlines in the next 60 days.`;
    } else {
      reply += `📅 Upcoming Tax Deadlines:\n`;
      for (const d of deadlines) {
        const icon = d.urgent ? '🔴' : '🟡';
        reply += `${icon} Modelo ${d.model}: ${d.description}\n`;
        reply += `   Due: ${d.deadline} (${d.daysUntil} days)\n`;
      }
    }

    return reply;
  } catch (err) {
    return `Failed to check status: ${err.message}. Is the core service running?`;
  }
}
