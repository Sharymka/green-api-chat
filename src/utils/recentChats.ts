import type { Message } from '../state/chatReducer'
import { historySenderName, parseHistoryItem } from './history'

export interface RecentChat {
  chatId: string
  name?: string
  messages: Message[]
}

function chatIdOf(item: unknown): string | undefined {
  if (typeof item !== 'object' || item === null || !('chatId' in item)) return undefined
  return typeof item.chatId === 'string' ? item.chatId : undefined
}

/** Сообщение отправлено через API — то есть из нашего приложения, а не с телефона. */
function isSentByApi(item: unknown): boolean {
  return (
    typeof item === 'object' &&
    item !== null &&
    'type' in item &&
    item.type === 'outgoing' &&
    'sendByApi' in item &&
    item.sendByApi === true
  )
}

/**
 * Собирает список недавних чатов из журналов lastIncomingMessages и lastOutgoingMessages.
 * В журнале есть вообще вся переписка аккаунта, включая друзей, с которыми человек общается
 * с телефона. Поэтому берём только чаты, куда хотя бы раз писали через API — из этого приложения.
 * Только личные чаты (…@c.us) и только текстовые сообщения. Сверху — чат с самым свежим сообщением.
 */
export function buildRecentChats(items: unknown[]): RecentChat[] {
  const appChatIds = new Set(items.filter(isSentByApi).map(chatIdOf))

  const byChat = new Map<string, unknown[]>()
  for (const item of items) {
    const chatId = chatIdOf(item)
    if (!chatId?.endsWith('@c.us') || !appChatIds.has(chatId)) continue
    byChat.set(chatId, [...(byChat.get(chatId) ?? []), item])
  }

  const chats = [...byChat].map(([chatId, chatItems]) => ({
    chatId,
    name: historySenderName(chatItems),
    messages: chatItems
      .map(parseHistoryItem)
      .filter((m): m is Message => m !== null)
      .sort((a, b) => a.timestamp - b.timestamp),
  }))

  const lastTime = (chat: RecentChat) => chat.messages.at(-1)?.timestamp ?? 0
  return chats.sort((a, b) => lastTime(b) - lastTime(a))
}
