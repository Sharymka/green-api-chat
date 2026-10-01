export interface IncomingMessage {
  idMessage: string
  chatId: string
  text: string
  /** Unix time in seconds, as sent by GREEN-API. */
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
    // A text with a link and a reply to another message keep the text in the same place
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
 * Picks an incoming text message from a private chat out of a raw notification body.
 * Returns null for everything else (statuses, media, group chats, malformed data).
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
