export interface IncomingMessage {
  idMessage: string
  chatId: string
  text: string
  /** Время отправки в секундах (так присылает GREEN-API). */
  timestamp: number
  senderName?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function extractText(messageData: Record<string, unknown>): string | undefined {
  switch (messageData.typeMessage) {
    case 'textMessage': {
      const data = messageData.textMessageData
      return isRecord(data) ? getString(data.textMessage) : undefined
    }
    // У текста со ссылкой и у ответа на сообщение текст лежит в одном и том же месте
    case 'extendedTextMessage':
    case 'quotedMessage': {
      const data = messageData.extendedTextMessageData
      return isRecord(data) ? getString(data.text) : undefined
    }
    default:
      return undefined
  }
}

/**
 * Достаёт из уведомления входящее текстовое сообщение из личного чата.
 * Для всего остального (статусы, фото, группы, непонятные данные) возвращает null — такое мы не показываем.
 */
export function parseIncomingMessage(body: unknown): IncomingMessage | null {
  if (!isRecord(body) || body.typeWebhook !== 'incomingMessageReceived') return null

  const { senderData, messageData } = body
  if (!isRecord(senderData) || !isRecord(messageData)) return null

  const chatId = getString(senderData.chatId)
  const idMessage = getString(body.idMessage)
  const text = extractText(messageData)
  if (!chatId?.endsWith('@c.us') || !idMessage || !text) return null

  return {
    idMessage,
    chatId,
    text,
    timestamp: typeof body.timestamp === 'number' ? body.timestamp : Math.floor(Date.now() / 1000),
    senderName: getString(senderData.senderName) ?? getString(senderData.chatName),
  }
}
