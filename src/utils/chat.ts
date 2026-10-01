import type { Chat } from '../state/chatReducer'
import { formatPhone, phoneFromChatId } from './phone'

/** Как подписать чат: именем собеседника, а если его не знаем — номером телефона. */
export function chatTitle(chat: Pick<Chat, 'chatId' | 'name'>): string {
  return chat.name ?? formatPhone(phoneFromChatId(chat.chatId))
}
