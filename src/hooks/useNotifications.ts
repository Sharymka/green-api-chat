import { useEffect } from 'react'
import { ApiError } from '../api/errors'
import { deleteNotification, receiveNotification } from '../api/greenApi'
import { useChat } from '../state/chatContext'
import { parseIncomingMessage, parseStatusUpdate } from '../utils/notifications'
import { nextDelay, wait } from '../utils/wait'

/** Сколько секунд сервер держит запрос, ожидая новое уведомление. */
const RECEIVE_TIMEOUT_SEC = 20

/**
 * Фоновый цикл получения входящих сообщений (HTTP API GREEN-API):
 * 1. спрашиваем «есть новое?» (receiveNotification) — сервер ждёт до 20 секунд;
 * 2. если это текстовое сообщение — показываем его в нужном чате, если статус нашего — обновляем галочки;
 * 3. удаляем уведомление из очереди (deleteNotification), иначе получим его снова;
 * 4. повторяем.
 * Если связь пропала — показываем плашку и пробуем снова с растущей паузой.
 * Цикл один на всё приложение и останавливается при выходе из аккаунта.
 */
export function useNotifications() {
  const { state, dispatch } = useChat()
  const { credentials } = state

  useEffect(() => {
    if (!credentials) return
    const creds = credentials
    const controller = new AbortController()
    const { signal } = controller

    // Браузер сам сообщает, что интернет пропал, — не ждём, пока запрос упадёт по таймауту
    const handleOffline = () => dispatch({ type: 'connectionChanged', connection: 'reconnecting' })
    window.addEventListener('offline', handleOffline)

    async function run() {
      let delay: number | null = null

      while (!signal.aborted) {
        try {
          const notification = await receiveNotification(creds, RECEIVE_TIMEOUT_SEC, signal)
          dispatch({ type: 'connectionChanged', connection: 'online' })
          delay = null
          if (!notification) continue // за 20 секунд ничего не пришло — спрашиваем снова

          const message = parseIncomingMessage(notification.body)
          if (message) dispatch({ type: 'messageReceived', message })
          // «Доставлено» и «прочитано» для наших сообщений приходят через ту же очередь
          const statusUpdate = parseStatusUpdate(notification.body)
          if (statusUpdate) dispatch({ type: 'messageStatusUpdated', ...statusUpdate })
          // Удаляем любое уведомление, даже ненужное нам (статусы, фото), иначе очередь застрянет.
          // Если удалить не получится, уведомление придёт ещё раз — повтор отсечёт reducer по idMessage
          await deleteNotification(creds, notification.receiptId, signal)
        } catch (error) {
          if (signal.aborted) return
          if (error instanceof ApiError && error.kind === 'unauthorized') {
            dispatch({ type: 'loggedOut' })
            return
          }
          dispatch({ type: 'connectionChanged', connection: 'reconnecting' })
          delay = nextDelay(delay)
          await wait(delay, signal)
        }
      }
    }

    void run()
    return () => {
      controller.abort()
      window.removeEventListener('offline', handleOffline)
    }
  }, [credentials, dispatch])
}
