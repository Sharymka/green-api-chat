import type { Credentials, InstanceState } from '../api/greenApi'
import { mergeMessages } from '../utils/history'
import type { IncomingMessage, QuotaInfo } from '../utils/notifications'
import type { RecentChat } from '../utils/recentChats'
import type { SavedChat } from './chatsStorage'

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

/** Статусы, которые сообщает WhatsApp про уже отправленное сообщение. */
export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed'

// Порядок «продвижения» сообщения: отправлено → доставлено → прочитано
const PROGRESS: Record<MessageStatus, number> = {
  pending: 0,
  failed: 0,
  sent: 1,
  delivered: 2,
  read: 3,
}

/**
 * Можно ли сменить статус сообщения. Статусы приходят не всегда по порядку, поэтому:
 * - «прочитано» не превращаем обратно в «доставлено» — статус только растёт;
 * - ошибка (например, у номера нет WhatsApp) применяется, пока сообщение не доставлено.
 */
function canChangeStatus(current: MessageStatus, next: DeliveryStatus): boolean {
  if (next === 'failed') return current === 'pending' || current === 'sent'
  return PROGRESS[next] > PROGRESS[current]
}

export interface Message {
  /** Наш собственный id: у исходящего он появляется раньше, чем GREEN-API вернёт idMessage. */
  id: string
  /** id сообщения в WhatsApp. По нему отсекаем повторы одного и того же входящего. */
  idMessage?: string
  text: string
  direction: 'in' | 'out'
  /** Время в миллисекундах. */
  timestamp: number
  /** Только у исходящих: отправляется → отправлено → доставлено → прочитано, или ошибка. */
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
  /** Почему пользователя выкинуло на экран входа — чтобы объяснить это, а не молча разлогинить. */
  logoutReason: 'tokenRejected' | null
  /** Состояние подключения инстанса к WhatsApp (приходит уведомлением stateInstanceChanged). */
  instanceState: InstanceState
  /** Закончился лимит тарифа (уведомление quotaExceeded). */
  quota: QuotaInfo | null
}

export type ChatAction =
  | { type: 'loggedIn'; credentials: Credentials; chats?: SavedChat[] }
  | { type: 'loggedOut'; reason?: 'tokenRejected' }
  | { type: 'instanceStateChanged'; instanceState: InstanceState }
  | { type: 'quotaExceeded'; quota: QuotaInfo }
  | { type: 'chatOpened'; chatId: string }
  | { type: 'chatClosed' }
  | { type: 'messageQueued'; chatId: string; id: string; text: string; timestamp: number }
  | { type: 'messageSent'; chatId: string; id: string; idMessage: string }
  | { type: 'messageFailed'; chatId: string; id: string }
  | { type: 'messageRetried'; chatId: string; id: string }
  | { type: 'messageReceived'; message: IncomingMessage }
  | { type: 'messageStatusUpdated'; chatId: string; idMessage: string; status: DeliveryStatus }
  | { type: 'recentChatsLoaded'; chats: RecentChat[] }
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
    logoutReason: null,
    instanceState: 'authorized',
    quota: null,
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
  // Ничего не поменялось — возвращаем тот же массив, чтобы React не перерисовывал зря
  if (updated === chat) return chats
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
      // Стираем всё: следующий человек за этим компьютером не должен увидеть чужие переписки.
      // Оставляем только причину выхода, чтобы показать её на экране входа
      return { ...createInitialState(), logoutReason: action.reason ?? null }

    case 'instanceStateChanged':
      return { ...state, instanceState: action.instanceState }

    case 'quotaExceeded':
      return { ...state, quota: action.quota }

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

    case 'messageStatusUpdated': {
      const { chatId, idMessage, status } = action
      const chats = updateChat(state.chats, chatId, (chat) => {
        const message = chat.messages.find((m) => m.idMessage === idMessage)
        if (!message?.status || !canChangeStatus(message.status, status)) return chat
        return {
          ...chat,
          messages: chat.messages.map((m) => (m === message ? { ...m, status } : m)),
        }
      })
      return chats === state.chats ? state : { ...state, chats }
    }

    case 'recentChatsLoaded': {
      // Склеиваем недавние чаты из журнала GREEN-API с тем, что уже есть:
      // новые чаты добавляем, у знакомых дополняем сообщения (повторы отсекаются по idMessage)
      const merged = new Map(state.chats.map((chat) => [chat.chatId, chat]))
      for (const recent of action.chats) {
        const existing = merged.get(recent.chatId)
        merged.set(
          recent.chatId,
          existing
            ? {
                ...existing,
                name: existing.name ?? recent.name,
                messages: mergeMessages(existing.messages, recent.messages),
              }
            : { ...newChat(recent), messages: recent.messages },
        )
      }
      // Сверху — чат с самым свежим сообщением; чаты без сообщений остаются внизу в прежнем порядке
      const lastTime = (chat: Chat) => chat.messages.at(-1)?.timestamp ?? 0
      const chats = [...merged.values()].sort((a, b) => lastTime(b) - lastTime(a))
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
