import type { Credentials } from '../api/greenApi'
import { mergeMessages } from '../utils/history'
import type { IncomingMessage } from '../utils/notifications'
import type { SavedChat } from './chatsStorage'

export type MessageStatus = 'pending' | 'sent' | 'failed'

export interface Message {
  /** Наш собственный id: у исходящего он появляется раньше, чем GREEN-API вернёт idMessage. */
  id: string
  /** id сообщения в WhatsApp. По нему отсекаем повторы одного и того же входящего. */
  idMessage?: string
  text: string
  direction: 'in' | 'out'
  /** Время в миллисекундах. */
  timestamp: number
  /** Только у исходящих: отправляется, отправлено или ошибка. */
  status?: MessageStatus
}

export interface Chat {
  chatId: string
  /** Имя собеседника, если WhatsApp его прислал. Иначе показываем номер. */
  name?: string
  messages: Message[]
  unread: number
  /** Загрузка старой переписки через getChatHistory: ещё не грузили, грузим, загрузили, ошибка. */
  history: 'idle' | 'loading' | 'loaded' | 'error'
}

export interface ChatState {
  credentials: Credentials | null
  /** Сверху — чат, где последнее сообщение было позже всего. */
  chats: Chat[]
  activeChatId: string | null
  connection: 'online' | 'reconnecting'
}

export type ChatAction =
  | { type: 'loggedIn'; credentials: Credentials; chats?: SavedChat[] }
  | { type: 'loggedOut' }
  | { type: 'chatOpened'; chatId: string }
  | { type: 'chatClosed' }
  | { type: 'messageQueued'; chatId: string; id: string; text: string; timestamp: number }
  | { type: 'messageSent'; chatId: string; id: string; idMessage: string }
  | { type: 'messageFailed'; chatId: string; id: string }
  | { type: 'messageRetried'; chatId: string; id: string }
  | { type: 'messageReceived'; message: IncomingMessage }
  | { type: 'historyRequested'; chatId: string }
  | { type: 'historyLoaded'; chatId: string; messages: Message[]; name?: string }
  | { type: 'historyFailed'; chatId: string }
  | { type: 'connectionChanged'; connection: ChatState['connection'] }

function newChat({ chatId, name }: SavedChat): Chat {
  return { chatId, name, messages: [], unread: 0, history: 'idle' }
}

export function createInitialState(
  credentials: Credentials | null = null,
  savedChats: SavedChat[] = [],
): ChatState {
  return {
    credentials,
    chats: credentials ? savedChats.map(newChat) : [],
    activeChatId: null,
    connection: 'online',
  }
}

/** Меняет один чат и поднимает его наверх списка (если moveToTop). */
function updateChat(
  chats: Chat[],
  chatId: string,
  update: (chat: Chat) => Chat,
  moveToTop = false,
): Chat[] {
  const chat = chats.find((c) => c.chatId === chatId)
  if (!chat) return chats

  const updated = update(chat)
  if (!moveToTop) return chats.map((c) => (c === chat ? updated : c))
  return [updated, ...chats.filter((c) => c !== chat)]
}

function setStatus(chat: Chat, id: string, status: MessageStatus, idMessage?: string): Chat {
  return {
    ...chat,
    messages: chat.messages.map((m) =>
      m.id === id ? { ...m, status, idMessage: idMessage ?? m.idMessage } : m,
    ),
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'loggedIn':
      return createInitialState(action.credentials, action.chats)

    case 'loggedOut':
      // Стираем всё: следующий человек за этим компьютером не должен увидеть чужие переписки
      return createInitialState()

    case 'chatOpened': {
      const exists = state.chats.some((c) => c.chatId === action.chatId)
      const chats = exists
        ? updateChat(state.chats, action.chatId, (chat) => ({ ...chat, unread: 0 }))
        : [newChat({ chatId: action.chatId }), ...state.chats]
      return { ...state, chats, activeChatId: action.chatId }
    }

    case 'chatClosed':
      return { ...state, activeChatId: null }

    case 'messageQueued': {
      const message: Message = {
        id: action.id,
        text: action.text,
        direction: 'out',
        timestamp: action.timestamp,
        status: 'pending',
      }
      const chats = updateChat(
        state.chats,
        action.chatId,
        (chat) => ({ ...chat, messages: [...chat.messages, message] }),
        true,
      )
      return { ...state, chats }
    }

    case 'messageSent':
      return {
        ...state,
        chats: updateChat(state.chats, action.chatId, (chat) =>
          setStatus(chat, action.id, 'sent', action.idMessage),
        ),
      }

    case 'messageFailed':
      return {
        ...state,
        chats: updateChat(state.chats, action.chatId, (chat) =>
          setStatus(chat, action.id, 'failed'),
        ),
      }

    case 'messageRetried':
      return {
        ...state,
        chats: updateChat(state.chats, action.chatId, (chat) =>
          setStatus(chat, action.id, 'pending'),
        ),
      }

    case 'messageReceived': {
      const { message } = action
      const chat = state.chats.find((c) => c.chatId === message.chatId)
      // Показываем ответы только в чатах, которые пользователь создал сам
      if (!chat) return state
      // Одно и то же уведомление может прийти дважды, если не удалось удалить его из очереди
      if (chat.messages.some((m) => m.idMessage === message.idMessage)) return state

      const isActive = state.activeChatId === message.chatId
      const chats = updateChat(
        state.chats,
        message.chatId,
        (c) => ({
          ...c,
          name: message.senderName ?? c.name,
          unread: isActive ? 0 : c.unread + 1,
          messages: [
            ...c.messages,
            {
              id: message.idMessage,
              idMessage: message.idMessage,
              text: message.text,
              direction: 'in',
              timestamp: message.timestamp * 1000,
            },
          ],
        }),
        true,
      )
      return { ...state, chats }
    }

    case 'historyRequested':
      return {
        ...state,
        chats: updateChat(state.chats, action.chatId, (chat) => ({ ...chat, history: 'loading' })),
      }

    case 'historyLoaded':
      return {
        ...state,
        chats: updateChat(state.chats, action.chatId, (chat) => ({
          ...chat,
          name: chat.name ?? action.name,
          history: 'loaded',
          messages: mergeMessages(chat.messages, action.messages),
        })),
      }

    case 'historyFailed':
      return {
        ...state,
        chats: updateChat(state.chats, action.chatId, (chat) => ({ ...chat, history: 'error' })),
      }

    case 'connectionChanged':
      if (state.connection === action.connection) return state
      return { ...state, connection: action.connection }
  }
}
