import cron from 'node-cron';
import { TAX_DEADLINES } from '../types/tax.js';
import type { Deadline } from '../types/agent.js';

// ─── Get Upcoming Deadlines ──────────────────────────────

export function getUpcomingDeadlines(withinDays = 30): Deadline[] {
  const today = new Date();
  const upcoming: Deadline[] = [];

  for (const d of TAX_DEADLINES) {
    let deadline = new Date(today.getFullYear(), d.month - 1, d.day);
    if (deadline < today) {
      deadline = new Date(today.getFullYear() + 1, d.month - 1, d.day);
    }
    const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= withinDays) {
      upcoming.push({
        model: d.model,
        description: d.description,
        deadline: deadline.toISOString().split('T')[0],
        daysUntil,
        urgent: daysUntil <= 7,
      });
    }
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ─── Start Cron Scheduler ────────────────────────────────

export function startScheduler(): void {
  // Run daily at 09:00 (server timezone — set TZ=Europe/Madrid in env)
  cron.schedule('0 9 * * *', () => {
    const deadlines = getUpcomingDeadlines(14);
    for (const d of deadlines) {
      console.warn(
        `[TAX REMINDER] ${d.description} — Deadline: ${d.deadline} (${d.daysUntil} days)`,
      );
      // TODO: Send via OpenClaw messaging API or Telegram bot API
    }
  });

  console.log('Scheduler started — daily deadline check at 09:00');
}
