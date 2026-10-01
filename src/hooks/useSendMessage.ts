import { useCallback } from 'react'
import { ApiError } from '../api/errors'
import { sendMessage } from '../api/greenApi'
import { useChat } from '../state/chatContext'

let localIdCounter = 0

/** Свой id для исходящего сообщения: нужен сразу, ещё до ответа GREEN-API. */
function createLocalId(): string {
  localIdCounter += 1
  return `local-${Date.now()}-${localIdCounter}`
}

/**
 * Отправка сообщений. Сообщение сразу появляется в ленте со статусом «отправляется»,
 * а после ответа GREEN-API становится «отправлено» или «ошибка» (тогда его можно повторить).
 */
export function useSendMessage(chatId: string) {
  const { state, dispatch } = useChat()
  const { credentials } = state

  const deliver = useCallback(
    async (id: string, text: string) => {
      if (!credentials) return
      try {
        const idMessage = await sendMessage(credentials, chatId, text)
        dispatch({ type: 'messageSent', chatId, id, idMessage })
      } catch (error) {
        dispatch({ type: 'messageFailed', chatId, id })
        // Токен перестал подходить (например, его сменили в кабинете) — дальше работать бессмысленно
        if (error instanceof ApiError && error.kind === 'unauthorized') {
          dispatch({ type: 'loggedOut' })
        }
      }
    },
    [credentials, chatId, dispatch],
  )

  const send = useCallback(
    (text: string) => {
      const id = createLocalId()
      dispatch({ type: 'messageQueued', chatId, id, text, timestamp: Date.now() })
      void deliver(id, text)
    },
    [chatId, deliver, dispatch],
  )

  const retry = useCallback(
    (id: string, text: string) => {
      dispatch({ type: 'messageRetried', chatId, id })
      void deliver(id, text)
    },
    [chatId, deliver, dispatch],
  )

  return { send, retry }
}
