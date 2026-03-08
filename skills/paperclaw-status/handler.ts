// OpenClaw skill handler — system status and deadline checker

const CORE_URL = process.env.PAPERCLAW_CORE_URL ?? "http://paperclaw-core:8080";

interface StatusInput {
  days?: number;
}

export async function handle(input: StatusInput = {}): Promise<string> {
  const days = input.days ?? 30;

  // Check health
  let healthStatus = "❌ Offline";
  try {
    const healthRes = await fetch(`${CORE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (healthRes.ok) {
      healthStatus = "✅ Online";
    }
  } catch {
    return `PaperClaw Core is offline. Check that the service is running at ${CORE_URL}`;
  }

  // Get deadlines
  const deadlineRes = await fetch(`${CORE_URL}/deadlines?days=${days}`);
  const deadlineData = await deadlineRes.json() as {
    deadlines: Array<{
      name: string;
      daysUntil: number;
      description: string;
      dueDate: string;
    }>;
  };

  const lines = [
    `🐾 **PaperClaw Status**`,
    `Core: ${healthStatus}`,
    ``,
    `📅 **Upcoming Tax Deadlines (next ${days} days)**`,
  ];

  if (deadlineData.deadlines.length === 0) {
    lines.push("No deadlines in the next period.");
  } else {
    for (const d of deadlineData.deadlines) {
      const urgency = d.daysUntil <= 7 ? "🔴" : d.daysUntil <= 14 ? "🟡" : "🟢";
      lines.push(`${urgency} **${d.name}** — ${d.daysUntil} days (${d.dueDate})`);
      lines.push(`   _${d.description}_`);
    }
  }

  return lines.join("\n");
}
