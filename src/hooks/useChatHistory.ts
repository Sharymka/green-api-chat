import { useCallback, useEffect, useRef } from 'react'
import { getChatHistory } from '../api/greenApi'
import { useChat } from '../state/chatContext'
import type { Chat } from '../state/chatReducer'
import { historySenderName, parseHistory } from '../utils/history'

const HISTORY_SIZE = 50

/**
 * Подгружает старую переписку через getChatHistory, когда чат открывают впервые.
 * Возвращает функцию для повторной попытки, если загрузка не удалась.
 */
export function useChatHistory(chat: Chat) {
  const { state, dispatch } = useChat()
  const { credentials } = state
  // Какие чаты уже грузятся. Нужно, чтобы не отправить два одинаковых запроса
  // (в режиме разработки React специально запускает эффекты дважды)
  const inFlight = useRef(new Set<string>())

  const load = useCallback(
    async (chatId: string) => {
      if (!credentials || inFlight.current.has(chatId)) return
      inFlight.current.add(chatId)
      dispatch({ type: 'historyRequested', chatId })
      try {
        const items = await getChatHistory(credentials, chatId, HISTORY_SIZE)
        dispatch({
          type: 'historyLoaded',
          chatId,
          messages: parseHistory(items),
          name: historySenderName(items),
        })
      } catch {
        dispatch({ type: 'historyFailed', chatId })
      } finally {
        inFlight.current.delete(chatId)
      }
    },
    [credentials, dispatch],
  )

  useEffect(() => {
    if (chat.history === 'idle') void load(chat.chatId)
  }, [chat.chatId, chat.history, load])

  return { retry: () => void load(chat.chatId) }
}
