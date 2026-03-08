interface Deadline {
  model: string;
  description: string;
  dueDate: string;
  daysUntil: number;
  period: string;
}

export async function getDeadlines(): Promise<{ deadlines: Deadline[] }> {
  const now = new Date();
  const year = now.getFullYear();

  const all: Array<Omit<Deadline, "daysUntil">> = [
    { model: "303/130", description: "IVA + IRPF Q1",            dueDate: `${year}-04-20`, period: `Q1 ${year}` },
    { model: "303/130", description: "IVA + IRPF Q2",            dueDate: `${year}-07-20`, period: `Q2 ${year}` },
    { model: "303/130", description: "IVA + IRPF Q3",            dueDate: `${year}-10-20`, period: `Q3 ${year}` },
    { model: "303/130", description: "IVA + IRPF Q4",            dueDate: `${year + 1}-01-20`, period: `Q4 ${year}` },
    { model: "390",     description: "IVA annual summary",        dueDate: `${year + 1}-01-30`, period: `FY ${year}` },
    { model: "100",     description: "Annual income tax (Renta)", dueDate: `${year}-06-30`,     period: `FY ${year - 1}` },
  ];

  const deadlines = all
    .map((d) => ({
      ...d,
      daysUntil: Math.ceil((new Date(d.dueDate).getTime() - now.getTime()) / 86_400_000),
    }))
    .filter((d) => d.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return { deadlines };
}
