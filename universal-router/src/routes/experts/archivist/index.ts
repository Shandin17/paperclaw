// Archivist: catch-all expert — no domain analysis, just tag and store
export async function archiveDocument(doc: { id: number; type: string }): Promise<{ message: string }> {
  return { message: `Document ${doc.id} archived as ${doc.type}` };
}
