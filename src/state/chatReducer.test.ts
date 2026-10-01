import { describe, expect, it } from 'vitest'
import type { Credentials } from '../api/greenApi'
import type { IncomingMessage } from '../utils/notifications'
import { chatReducer, createInitialState, type ChatAction, type ChatState } from './chatReducer'

const credentials: Credentials = {
  apiUrl: 'https://7107.api.greenapi.com',
  idInstance: '7107000001',
  apiTokenInstance: 'test-token',
}

const IVAN = '79001234567@c.us'
const MARIA = '79007654321@c.us'

function reduce(actions: ChatAction[], state: ChatState = createInitialState(credentials)) {
  return actions.reduce(chatReducer, state)
}

function incoming(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    idMessage: 'IN-1',
    chatId: IVAN,
    text: 'Привет!',
    timestamp: 1_700_000_000,
    senderName: 'Иван',
    ...overrides,
  }
}

describe('вход и выход', () => {
  it('при входе запоминает данные и начинает с пустого списка чатов', () => {
    const state = reduce([{ type: 'loggedIn', credentials }], createInitialState())
    expect(state).toEqual(createInitialState(credentials))
  })

  it('при входе восстанавливает сохранённый список чатов', () => {
    const state = reduce(
      [{ type: 'loggedIn', credentials, chats: [{ chatId: IVAN, name: 'Иван' }] }],
      createInitialState(),
    )
    expect(state.chats).toEqual([
      { chatId: IVAN, name: 'Иван', messages: [], unread: 0, history: 'idle' },
    ])
  })

  it('при выходе стирает данные входа и все чаты', () => {
    const state = reduce([{ type: 'chatOpened', chatId: IVAN }, { type: 'loggedOut' }])
    expect(state).toEqual(createInitialState())
  })
})

describe('чаты', () => {
  it('создаёт новый чат, ставит его первым и открывает', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'chatOpened', chatId: MARIA },
    ])
    expect(state.chats.map((c) => c.chatId)).toEqual([MARIA, IVAN])
    expect(state.activeChatId).toBe(MARIA)
  })

  it('не создаёт дубль, если чат с этим номером уже есть', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'chatOpened', chatId: MARIA },
      { type: 'chatOpened', chatId: IVAN },
    ])
    expect(state.chats).toHaveLength(2)
    expect(state.activeChatId).toBe(IVAN)
  })

  it('при открытии чата сбрасывает счётчик непрочитанных', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'chatOpened', chatId: MARIA },
      { type: 'messageReceived', message: incoming() },
      { type: 'chatOpened', chatId: IVAN },
    ])
    expect(state.chats.find((c) => c.chatId === IVAN)?.unread).toBe(0)
  })

  it('закрывает открытый чат (кнопка «Назад» на телефоне)', () => {
    const state = reduce([{ type: 'chatOpened', chatId: IVAN }, { type: 'chatClosed' }])
    expect(state.activeChatId).toBeNull()
    expect(state.chats).toHaveLength(1)
  })
})

describe('отправка', () => {
  const queued: ChatAction = {
    type: 'messageQueued',
    chatId: IVAN,
    id: 'local-1',
    text: 'Привет',
    timestamp: 1000,
  }

  it('сразу показывает сообщение со статусом «отправляется»', () => {
    const state = reduce([{ type: 'chatOpened', chatId: IVAN }, queued])
    expect(state.chats[0]?.messages).toEqual([
      { id: 'local-1', text: 'Привет', direction: 'out', timestamp: 1000, status: 'pending' },
    ])
  })

  it('после ответа сервера ставит «отправлено» и запоминает idMessage', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      queued,
      { type: 'messageSent', chatId: IVAN, id: 'local-1', idMessage: 'OUT-1' },
    ])
    expect(state.chats[0]?.messages[0]).toMatchObject({ status: 'sent', idMessage: 'OUT-1' })
  })

  it('при ошибке ставит «ошибка», а при повторе — снова «отправляется»', () => {
    const failed = reduce([
      { type: 'chatOpened', chatId: IVAN },
      queued,
      { type: 'messageFailed', chatId: IVAN, id: 'local-1' },
    ])
    expect(failed.chats[0]?.messages[0]?.status).toBe('failed')

    const retried = chatReducer(failed, { type: 'messageRetried', chatId: IVAN, id: 'local-1' })
    expect(retried.chats[0]?.messages[0]?.status).toBe('pending')
  })

  it('поднимает чат наверх списка', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'chatOpened', chatId: MARIA },
      queued,
    ])
    expect(state.chats.map((c) => c.chatId)).toEqual([IVAN, MARIA])
  })
})

describe('получение', () => {
  it('добавляет входящее в чат и запоминает имя собеседника', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'messageReceived', message: incoming() },
    ])
    const chat = state.chats[0]
    expect(chat?.name).toBe('Иван')
    expect(chat?.messages).toEqual([
      {
        id: 'IN-1',
        idMessage: 'IN-1',
        text: 'Привет!',
        direction: 'in',
        timestamp: 1_700_000_000_000,
      },
    ])
  })

  it('не задваивает сообщение, если уведомление пришло повторно', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'messageReceived', message: incoming() },
      { type: 'messageReceived', message: incoming() },
    ])
    expect(state.chats[0]?.messages).toHaveLength(1)
  })

  it('игнорирует сообщения от номеров, с которыми чата нет', () => {
    const before = reduce([{ type: 'chatOpened', chatId: MARIA }])
    const after = chatReducer(before, { type: 'messageReceived', message: incoming() })
    expect(after).toBe(before)
  })

  it('считает непрочитанные только в неоткрытом чате', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'chatOpened', chatId: MARIA },
      { type: 'messageReceived', message: incoming({ idMessage: 'IN-1' }) },
      { type: 'messageReceived', message: incoming({ idMessage: 'IN-2' }) },
      { type: 'messageReceived', message: incoming({ idMessage: 'IN-3', chatId: MARIA }) },
    ])
    expect(state.chats.find((c) => c.chatId === IVAN)?.unread).toBe(2)
    expect(state.chats.find((c) => c.chatId === MARIA)?.unread).toBe(0)
  })

  it('поднимает чат с новым сообщением наверх списка', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'chatOpened', chatId: MARIA },
      { type: 'messageReceived', message: incoming() },
    ])
    expect(state.chats.map((c) => c.chatId)).toEqual([IVAN, MARIA])
  })
})

describe('история переписки', () => {
  const fromHistory = {
    id: 'OLD-1',
    idMessage: 'OLD-1',
    text: 'Старое сообщение',
    direction: 'in' as const,
    timestamp: 500,
  }

  it('отмечает, что история загружается', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'historyRequested', chatId: IVAN },
    ])
    expect(state.chats[0]?.history).toBe('loading')
  })

  it('склеивает историю с сообщениями, которые уже есть в памяти', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'messageReceived', message: incoming() },
      { type: 'historyRequested', chatId: IVAN },
      // Журнал уже успел записать IN-1 — он не должен задвоиться
      {
        type: 'historyLoaded',
        chatId: IVAN,
        messages: [fromHistory, { ...fromHistory, id: 'IN-1', idMessage: 'IN-1' }],
        name: 'Иван Иванович',
      },
    ])
    const chat = state.chats[0]
    expect(chat?.history).toBe('loaded')
    expect(chat?.messages.map((m) => m.idMessage)).toEqual(['OLD-1', 'IN-1'])
    // Имя из уведомления уже было — не перезаписываем
    expect(chat?.name).toBe('Иван')
  })

  it('берёт имя из истории, если его ещё не знали', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'historyLoaded', chatId: IVAN, messages: [], name: 'Иван Иванович' },
    ])
    expect(state.chats[0]?.name).toBe('Иван Иванович')
  })

  it('запоминает ошибку загрузки истории', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: IVAN },
      { type: 'historyRequested', chatId: IVAN },
      { type: 'historyFailed', chatId: IVAN },
    ])
    expect(state.chats[0]?.history).toBe('error')
  })
})

describe('соединение', () => {
  it('переключает статус соединения', () => {
    const state = reduce([{ type: 'connectionChanged', connection: 'reconnecting' }])
    expect(state.connection).toBe('reconnecting')
  })

  it('не создаёт новое состояние, если статус не изменился', () => {
    const before = createInitialState(credentials)
    expect(chatReducer(before, { type: 'connectionChanged', connection: 'online' })).toBe(before)
  })
})
