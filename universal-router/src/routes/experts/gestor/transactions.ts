// stub — full implementation in Task #6 (DB schema)
export async function getTransactions(url: URL): Promise<unknown> {
  const year    = url.searchParams.get("year");
  const quarter = url.searchParams.get("quarter");
  return { transactions: [], year, quarter, status: "db_not_ready" };
}
