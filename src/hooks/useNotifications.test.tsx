import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { deleteNotification, receiveNotification, type Notification } from '../api/greenApi'
import { useChat } from '../state/chatContext'
import { ChatProvider } from '../state/ChatProvider'
import { saveChats } from '../state/chatsStorage'
import { saveCredentials } from '../state/credentialsStorage'
import { silentReceive } from '../test/api'
import { useNotifications } from './useNotifications'

vi.mock('../api/greenApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/greenApi')>()
  return {
    ...actual,
    receiveNotification: vi.fn<typeof actual.receiveNotification>(),
    deleteNotification: vi.fn<typeof actual.deleteNotification>(),
  }
})
const receiveMock = vi.mocked(receiveNotification)
const deleteMock = vi.mocked(deleteNotification)

const credentials = {
  idInstance: '7107000001',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://7107.api.greenapi.com',
}
const IVAN = '79001234567@c.us'

function textNotification(receiptId: number, idMessage: string, chatId = IVAN): Notification {
  return {
    receiptId,
    body: {
      typeWebhook: 'incomingMessageReceived',
      idMessage,
      timestamp: 1_700_000_000,
      senderData: { chatId, senderName: 'Иван' },
      messageData: {
        typeMessage: 'textMessage',
        textMessageData: { textMessage: `текст ${idMessage}` },
      },
    },
  }
}

/**
 * Ответы сервера по очереди: каждый элемент — уведомление, null (пусто) или ошибка.
 * Когда ответы закончились, «сервер молчит» до отмены запроса.
 */
function serverReplies(replies: (Notification | null | Error)[]) {
  receiveMock.mockImplementation((creds, timeout, signal) => {
    const next = replies.shift()
    if (next === undefined) return silentReceive(creds, timeout, signal)
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
}

function renderLoop(chats = [{ chatId: IVAN }]) {
  saveCredentials(credentials)
  saveChats(credentials.idInstance, chats)
  return renderHook(
    () => {
      useNotifications()
      return useChat()
    },
    { wrapper: ChatProvider },
  )
}

beforeEach(() => {
  receiveMock.mockReset()
  deleteMock.mockReset()
  deleteMock.mockResolvedValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
  localStorage.clear()
})

describe('цикл получения сообщений', () => {
  it('показывает входящее в нужном чате и удаляет уведомление из очереди', async () => {
    serverReplies([textNotification(15, 'IN-1')])
    const { result } = renderLoop()

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith(credentials, 15, expect.any(AbortSignal)),
    )
    expect(result.current.state.chats[0]?.messages.map((m) => m.text)).toEqual(['текст IN-1'])
  })

  it('если сервер мгновенно ответил «пусто», спрашивает снова не раньше чем через 3 секунды', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    serverReplies([null, null, textNotification(1, 'IN-1')])
    const { result } = renderLoop()

    await waitFor(() => expect(receiveMock).toHaveBeenCalledTimes(1))
    await act(() => vi.advanceTimersByTimeAsync(2900))
    expect(receiveMock).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(receiveMock).toHaveBeenCalledTimes(2)

    await act(() => vi.advanceTimersByTimeAsync(3000))
    await waitFor(() => expect(result.current.state.chats[0]?.messages).toHaveLength(1))
  })

  it('после уведомления спрашивает следующее сразу, без паузы', async () => {
    serverReplies([textNotification(1, 'IN-1'), textNotification(2, 'IN-2')])
    const { result } = renderLoop()

    await waitFor(() => expect(result.current.state.chats[0]?.messages).toHaveLength(2))
  })

  it('удаляет и ненужные уведомления: статусы и сообщения от незнакомых номеров', async () => {
    serverReplies([
      { receiptId: 1, body: { typeWebhook: 'outgoingMessageStatus', status: 'read' } },
      textNotification(2, 'IN-X', '79990000000@c.us'),
    ])
    const { result } = renderLoop()

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(2))
    expect(result.current.state.chats[0]?.messages).toEqual([])
  })

  it('если удалить не удалось, повторное уведомление не задваивает сообщение', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    deleteMock.mockRejectedValueOnce(new ApiError('network'))
    serverReplies([textNotification(7, 'IN-1'), textNotification(7, 'IN-1')])
    const { result } = renderLoop()

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    // После неудачного удаления цикл делает паузу в 1 секунду — проматываем её
    await act(() => vi.advanceTimersByTimeAsync(1000))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(2))
    expect(result.current.state.chats[0]?.messages).toHaveLength(1)
  })

  it('при обрыве связи показывает «переподключаемся» и пробует снова с паузой', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    serverReplies([new ApiError('network'), new ApiError('network'), null])
    const { result } = renderLoop()

    await waitFor(() => expect(result.current.state.connection).toBe('reconnecting'))
    expect(receiveMock).toHaveBeenCalledTimes(1)

    // Первая пауза — 1 секунда, вторая — 2
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(receiveMock).toHaveBeenCalledTimes(2)
    await act(() => vi.advanceTimersByTimeAsync(2000))

    await waitFor(() => expect(result.current.state.connection).toBe('online'))
  })

  it('когда браузер сообщает, что интернет вернулся, не ждёт конца паузы', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    serverReplies([new ApiError('network'), null])
    const { result } = renderLoop()
    await waitFor(() => expect(result.current.state.connection).toBe('reconnecting'))

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => expect(result.current.state.connection).toBe('online'))
  })

  it('сразу показывает плашку, если браузер сообщил, что интернет пропал', async () => {
    serverReplies([])
    const { result } = renderLoop()

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.state.connection).toBe('reconnecting')
  })

  it('обновляет галочки нашего сообщения по уведомлению о статусе', async () => {
    // Первый запрос «висит», пока мы не отправим сообщение, а потом приходит статус «прочитано»
    let releaseStatus: (n: Notification) => void = () => {}
    receiveMock
      .mockImplementationOnce(() => new Promise((resolve) => (releaseStatus = resolve)))
      .mockImplementation(silentReceive)
    const { result } = renderLoop()
    act(() => {
      result.current.dispatch({
        type: 'messageQueued',
        chatId: IVAN,
        id: 'l1',
        text: 'Привет',
        timestamp: 1,
      })
      result.current.dispatch({ type: 'messageSent', chatId: IVAN, id: 'l1', idMessage: 'OUT-1' })
    })

    await act(async () =>
      releaseStatus({
        receiptId: 3,
        body: {
          typeWebhook: 'outgoingMessageStatus',
          chatId: IVAN,
          idMessage: 'OUT-1',
          status: 'read',
        },
      }),
    )

    await waitFor(() => expect(result.current.state.chats[0]?.messages[0]?.status).toBe('read'))
    expect(deleteMock).toHaveBeenCalledWith(credentials, 3, expect.any(AbortSignal))
  })

  it('пока нет ни одного чата, очередь не опрашивает, а с первым чатом начинает', async () => {
    serverReplies([])
    const { result } = renderLoop([])
    await act(() => Promise.resolve())
    expect(receiveMock).not.toHaveBeenCalled()

    act(() => result.current.dispatch({ type: 'chatOpened', chatId: IVAN }))

    await waitFor(() => expect(receiveMock).toHaveBeenCalledTimes(1))
  })

  it('показывает, что инстанс отключили от WhatsApp, и убирает это после переподключения', async () => {
    serverReplies([
      {
        receiptId: 1,
        body: { typeWebhook: 'stateInstanceChanged', stateInstance: 'notAuthorized' },
      },
    ])
    const { result } = renderLoop()
    await waitFor(() => expect(result.current.state.instanceState).toBe('notAuthorized'))

    act(() =>
      result.current.dispatch({ type: 'instanceStateChanged', instanceState: 'authorized' }),
    )
    expect(result.current.state.instanceState).toBe('authorized')
  })

  it('запоминает, что закончился лимит тарифа', async () => {
    serverReplies([
      {
        receiptId: 1,
        body: { typeWebhook: 'quotaExceeded', quotaData: { used: 3, total: 3, description: '' } },
      },
    ])
    const { result } = renderLoop()

    await waitFor(() => expect(result.current.state.quota).toMatchObject({ total: 3 }))
    expect(deleteMock).toHaveBeenCalledWith(credentials, 1, expect.any(AbortSignal))
  })

  it('если токен больше не подходит — выходит из аккаунта и останавливается', async () => {
    serverReplies([new ApiError('unauthorized', 401)])
    const { result } = renderLoop()

    await waitFor(() => expect(result.current.state.credentials).toBeNull())
    expect(result.current.state.logoutReason).toBe('tokenRejected')
    expect(receiveMock).toHaveBeenCalledTimes(1)
  })

  it('при выходе из аккаунта обрывает ожидающий запрос', async () => {
    serverReplies([])
    const { result } = renderLoop()
    await waitFor(() => expect(receiveMock).toHaveBeenCalledTimes(1))
    const signal = receiveMock.mock.calls[0]?.[2]

    act(() => result.current.dispatch({ type: 'loggedOut' }))

    expect(signal?.aborted).toBe(true)
  })
})
