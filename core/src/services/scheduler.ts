import cron from "node-cron";
import type { TaxDeadline } from "../types/tax.js";

// Spain autónomo quarterly tax deadlines
const DEADLINES: TaxDeadline[] = [
  {
    name: "Modelo 303 Q1 (IVA)",
    model: "303",
    dueDate: "04-20",
    quarter: 1,
    description: "Declaración trimestral de IVA - 1T (enero–marzo)",
  },
  {
    name: "Modelo 130 Q1 (IRPF)",
    model: "130",
    dueDate: "04-20",
    quarter: 1,
    description: "Pago fraccionado IRPF - 1T (enero–marzo)",
  },
  {
    name: "Modelo 303 Q2 (IVA)",
    model: "303",
    dueDate: "07-20",
    quarter: 2,
    description: "Declaración trimestral de IVA - 2T (abril–junio)",
  },
  {
    name: "Modelo 130 Q2 (IRPF)",
    model: "130",
    dueDate: "07-20",
    quarter: 2,
    description: "Pago fraccionado IRPF - 2T (abril–junio)",
  },
  {
    name: "Modelo 303 Q3 (IVA)",
    model: "303",
    dueDate: "10-20",
    quarter: 3,
    description: "Declaración trimestral de IVA - 3T (julio–septiembre)",
  },
  {
    name: "Modelo 130 Q3 (IRPF)",
    model: "130",
    dueDate: "10-20",
    quarter: 3,
    description: "Pago fraccionado IRPF - 3T (julio–septiembre)",
  },
  {
    name: "Modelo 303 Q4 (IVA)",
    model: "303",
    dueDate: "01-30",
    quarter: 4,
    description: "Declaración trimestral de IVA - 4T (octubre–diciembre)",
  },
  {
    name: "Modelo 130 Q4 (IRPF)",
    model: "130",
    dueDate: "01-30",
    quarter: 4,
    description: "Pago fraccionado IRPF - 4T (octubre–diciembre)",
  },
  {
    name: "Modelo 390 (Resumen anual IVA)",
    model: "390",
    dueDate: "01-30",
    description: "Resumen anual de IVA",
  },
  {
    name: "Renta (IRPF anual)",
    model: "100",
    dueDate: "06-30",
    description: "Declaración anual de la renta",
  },
];

export function getUpcomingDeadlines(daysAhead = 30): (TaxDeadline & { daysUntil: number })[] {
  const now = new Date();
  const year = now.getFullYear();

  return DEADLINES.map((d) => {
    // Try current year and next year for the deadline date
    const [month, day] = d.dueDate.split("-").map(Number);
    let deadline = new Date(year, month - 1, day);
    if (deadline < now) {
      deadline = new Date(year + 1, month - 1, day);
    }
    const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { ...d, daysUntil };
  })
    .filter((d) => d.daysUntil <= daysAhead && d.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function getAllDeadlines(): TaxDeadline[] {
  return DEADLINES;
}

type NotifyFn = (message: string) => void;

export function startScheduler(notify: NotifyFn): void {
  // Check daily at 09:00 Madrid time
  cron.schedule("0 9 * * *", () => {
    const upcoming = getUpcomingDeadlines(14);
    for (const d of upcoming) {
      if (d.daysUntil === 14 || d.daysUntil === 7 || d.daysUntil === 3 || d.daysUntil === 1) {
        notify(
          `⚠️ Tax deadline in ${d.daysUntil} day(s): ${d.name}\n` +
          `📅 Due: ${d.dueDate}\n` +
          `📋 ${d.description}`,
        );
      }
    }
  }, { timezone: "Europe/Madrid" });

  console.log("Tax deadline scheduler started");
}
