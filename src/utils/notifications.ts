import type { InstanceState } from '../api/greenApi'
import type { DeliveryStatus } from '../state/chatReducer'

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

export interface StatusUpdate {
  chatId: string
  idMessage: string
  status: DeliveryStatus
}

/**
 * Достаёт из уведомления новый статус нашего сообщения: отправлено, доставлено, прочитано или ошибка.
 * noAccount (у номера нет WhatsApp), suspended и yellowCard для пользователя означают одно — не дошло.
 */
export function parseStatusUpdate(body: unknown): StatusUpdate | null {
  if (!isRecord(body) || body.typeWebhook !== 'outgoingMessageStatus') return null

  const chatId = getString(body.chatId)
  const idMessage = getString(body.idMessage)
  if (!chatId || !idMessage) return null

  switch (body.status) {
    case 'sent':
    case 'delivered':
    case 'read':
      return { chatId, idMessage, status: body.status }
    case 'failed':
    case 'noAccount':
    case 'suspended':
    case 'yellowCard':
      return { chatId, idMessage, status: 'failed' }
    default:
      return null
  }
}

/** Уведомление stateInstanceChanged: инстанс подключили к WhatsApp, отключили, заблокировали… */
export function parseInstanceState(body: unknown): InstanceState | null {
  if (!isRecord(body) || body.typeWebhook !== 'stateInstanceChanged') return null
  return getString(body.stateInstance) ?? null
}

export interface QuotaInfo {
  used?: number
  total?: number
  /** С кем ещё можно переписываться в этом месяце (chatId из описания GREEN-API). */
  allowedChatIds: string[]
}

/**
 * Уведомление quotaExceeded: на бесплатном тарифе за месяц можно переписываться
 * лишь с несколькими собеседниками. Список разрешённых GREEN-API пишет только текстом
 * в description, поэтому достаём chatId оттуда.
 */
export function parseQuotaExceeded(body: unknown): QuotaInfo | null {
  if (!isRecord(body) || body.typeWebhook !== 'quotaExceeded') return null
  const data = isRecord(body.quotaData) ? body.quotaData : {}
  const description = getString(data.description) ?? ''
  return {
    used: typeof data.used === 'number' ? data.used : undefined,
    total: typeof data.total === 'number' ? data.total : undefined,
    allowedChatIds: description.match(/\d+@(?:c|g)\.us/g) ?? [],
  }
}
