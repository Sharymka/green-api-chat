import { useEffect } from 'react'
import { lastIncomingMessages, lastOutgoingMessages } from '../api/greenApi'
import { useChat } from '../state/chatContext'
import { buildRecentChats } from '../utils/recentChats'

/**
 * За какой период подтягиваем недавние чаты: неделя. Это наш выбор, а не ограничение GREEN-API:
 * по умолчанию журнал отдаёт сутки (1440 минут), максимальный период в документации не указан.
 * Суток мало (вернулись после выходных — чатов нет), а неделя покрывает обычный перерыв
 * и не тянет лишнего: в журнале вся переписка аккаунта, и фильтруем мы её уже у себя.
 */
const RECENT_MINUTES = 7 * 24 * 60

/**
 * После входа подтягивает недавние чаты из журналов GREEN-API. Так список чатов одинаковый
 * на любом компьютере, а не только в том браузере, где чат создавали.
 * Если журнал недоступен (например, выключены уведомления), остаётся список из браузера.
 */
export function useRecentChats() {
  const { state, dispatch } = useChat()
  const { credentials } = state

  useEffect(() => {
    if (!credentials) return
    const controller = new AbortController()
    const { signal } = controller

    void Promise.allSettled([
      lastIncomingMessages(credentials, RECENT_MINUTES, signal),
      lastOutgoingMessages(credentials, RECENT_MINUTES, signal),
    ]).then((results) => {
      if (signal.aborted) return
      const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      if (items.length > 0) dispatch({ type: 'recentChatsLoaded', chats: buildRecentChats(items) })
    })

    return () => controller.abort()
  }, [credentials, dispatch])
}
