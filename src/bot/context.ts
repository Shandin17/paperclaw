import type { Context } from 'grammy'

export interface HistoryMessage {
  role: 'user' | 'assistant'
  text: string
  files?: string[]
  timestamp: number
}

export type AppContext = Context

// In-memory conversation history store
// Map<chatId, messages[]> with simple LRU eviction
const MAX_HISTORY = 20
const MAX_CHATS = 1000

const historyStore = new Map<number, HistoryMessage[]>()
const accessOrder: number[] = []

export function getHistory (chatId: number): HistoryMessage[] {
  touchChat(chatId)
  return historyStore.get(chatId) ?? []
}

export function appendHistory (chatId: number, message: HistoryMessage): void {
  touchChat(chatId)
  const history = historyStore.get(chatId) ?? []
  history.push(message)
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY)
  historyStore.set(chatId, history)
}

function touchChat (chatId: number): void {
  const idx = accessOrder.indexOf(chatId)
  if (idx !== -1) accessOrder.splice(idx, 1)
  accessOrder.push(chatId)

  if (accessOrder.length > MAX_CHATS) {
    const evicted = accessOrder.shift()
    if (evicted !== undefined) historyStore.delete(evicted)
  }
}
