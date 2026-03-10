const MESSAGES = [
  '🔍 Rummaging through the filing cabinet...',
  '🧠 Cogitating furiously...',
  '⚙️ Spinning up the bureaucracy engine...',
  '📜 Unrolling the papyrus...',
  '🤔 Gazlightning the documents...',
  '🫧 Buzzling through the archives...',
  '🔭 Squinting at pixels...',
  '🐹 Sending it to the paper hamster...',
  '📎 Consulting Clippy... just kidding...',
  '🌀 Summoning the document spirits...',
  '🕵️ Sniffing through the evidence...',
  '🧩 Assembling the puzzle pieces...',
  '🪄 Waving the paperwork wand...',
  '🐌 Asking the slow bureaucrat...',
  '📡 Pinging the knowledge satellites...',
  '☕ Brewing a fresh pot of data...',
  '🎲 Rolling the dice of retrieval...',
  '🔬 Microscopically examining...',
]

export function randomProcessingMessage (): string {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)] ?? MESSAGES[0]
}
