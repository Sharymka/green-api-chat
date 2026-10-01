import type { Message } from '../state/chatReducer'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function extractText(item: Record<string, unknown>): string | undefined {
  switch (item.typeMessage) {
    case 'textMessage':
      return getString(item.textMessage)
    // В истории текст со ссылкой и ответ на сообщение тоже бывают обычным текстом,
    // поэтому сначала смотрим textMessage, а потом вложенный объект
    case 'extendedTextMessage':
    case 'quotedMessage': {
      const extended = item.extendedTextMessage
      return (
        getString(item.textMessage) ?? (isRecord(extended) ? getString(extended.text) : undefined)
      )
    }
    default:
      return undefined
  }
}

/**
 * Превращает одну запись из getChatHistory в сообщение для ленты.
 * Фото, голосовые и всё непонятное пропускаем — показываем только текст.
 */
export function parseHistoryItem(item: unknown): Message | null {
  if (!isRecord(item)) return null

  const idMessage = getString(item.idMessage)
  const text = extractText(item)
  const direction = item.type === 'incoming' ? 'in' : item.type === 'outgoing' ? 'out' : undefined
  if (!idMessage || !text || !direction || typeof item.timestamp !== 'number') return null

  return {
    id: idMessage,
    idMessage,
    text,
    direction,
    timestamp: item.timestamp * 1000,
    // В истории исходящие уже точно ушли с телефона, так что для нас они «отправлены»
    status: direction === 'out' ? 'sent' : undefined,
  }
}

export function parseHistory(items: unknown[]): Message[] {
  return items.map(parseHistoryItem).filter((m): m is Message => m !== null)
}

/**
 * Склеивает загруженную историю с тем, что уже есть в памяти.
 * Журнал GREEN-API отстаёт до 2 минут, поэтому свежие сообщения из памяти не выбрасываем.
 * Совпадения ищем по idMessage, сортируем по времени.
 */
export function mergeMessages(current: Message[], history: Message[]): Message[] {
  const known = new Set(current.map((m) => m.idMessage).filter(Boolean))
  const fresh = history.filter((m) => !known.has(m.idMessage))
  return [...current, ...fresh].sort((a, b) => a.timestamp - b.timestamp)
}

/** Имя собеседника из истории: берём его из любого входящего сообщения, где оно есть. */
export function historySenderName(items: unknown[]): string | undefined {
  for (const item of items) {
    if (!isRecord(item) || item.type !== 'incoming') continue
    const name = getString(item.senderContactName) ?? getString(item.senderName)
    if (name) return name
  }
  return undefined
}
