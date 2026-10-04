import { Fragment, useLayoutEffect, useRef } from 'react'
import type { Chat, Message } from '../../state/chatReducer'
import { dayKey, formatDayLabel, formatMessageTime } from '../../utils/time'
import { AlertIcon, CheckIcon, ClockIcon, DoubleCheckIcon } from '../ui/icons'
import styles from './MessageList.module.css'

interface MessageListProps {
  chat: Chat
  phone: string
  onRetry: (message: Message) => void
  onRetryHistory: () => void
}

/** Насколько близко к низу (в пикселях) считаем, что человек «внизу» ленты. */
const STICK_TO_BOTTOM_PX = 120

function MessageStatus({ message, onRetry }: { message: Message; onRetry: () => void }) {
  switch (message.status) {
    case 'pending':
      return (
        <span className={styles.status} title="Отправляется">
          <ClockIcon width={14} height={14} />
          <span className="visually-hidden">отправляется</span>
        </span>
      )
    case 'sent':
      return (
        <span className={styles.status} title="Отправлено">
          <CheckIcon width={15} height={15} />
          <span className="visually-hidden">отправлено</span>
        </span>
      )
    case 'delivered':
      return (
        <span className={styles.status} title="Доставлено">
          <DoubleCheckIcon width={18} height={15} />
          <span className="visually-hidden">доставлено</span>
        </span>
      )
    case 'read':
      // Голубые галочки, как в WhatsApp
      return (
        <span className={`${styles.status} ${styles.read}`} title="Прочитано">
          <DoubleCheckIcon width={18} height={15} />
          <span className="visually-hidden">прочитано</span>
        </span>
      )
    case 'failed':
      return (
        <span className={`${styles.status} ${styles.failed}`}>
          <AlertIcon width={15} height={15} />
          <span className="visually-hidden">не отправлено.</span>
          <button type="button" className={styles.retry} onClick={onRetry}>
            Повторить
          </button>
        </span>
      )
    default:
      return null
  }
}

function Skeleton() {
  // Ширины «пузырей» заданы вручную, чтобы скелетон был похож на настоящую переписку
  const bubbles = [
    { side: 'in', width: 55 },
    { side: 'in', width: 35 },
    { side: 'out', width: 45 },
    { side: 'in', width: 60 },
    { side: 'out', width: 30 },
  ]
  return (
    <div className={styles.skeleton} aria-hidden="true">
      {bubbles.map((bubble, index) => (
        <div
          key={index}
          className={styles.skeletonBubble}
          data-side={bubble.side}
          style={{ width: `${bubble.width}%` }}
        />
      ))}
    </div>
  )
}

export function MessageList({ chat, phone, onRetry, onRetryHistory }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastMessage = chat.messages.at(-1)
  const loading = chat.history === 'loading' && chat.messages.length === 0

  // Прокручиваем вниз при открытии чата, при своём новом сообщении и при входящем,
  // если человек и так был внизу. Если он листает старую переписку — не мешаем.
  const prevChatId = useRef<string>(null)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const chatChanged = prevChatId.current !== chat.chatId
    prevChatId.current = chat.chatId
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX
    if (chatChanged || nearBottom || lastMessage?.direction === 'out') {
      el.scrollTop = el.scrollHeight
    }
  }, [chat.chatId, chat.messages.length, lastMessage?.direction])

  return (
    <div
      ref={scrollRef}
      className={styles.scroller}
      role="log"
      aria-label="Переписка"
      aria-busy={loading || undefined}
    >
      <div className={styles.inner}>
        {loading && <Skeleton />}

        {chat.history === 'error' && (
          <div className={styles.notice} role="alert">
            <p>Не удалось загрузить историю переписки</p>
            <button type="button" className={styles.noticeButton} onClick={onRetryHistory}>
              Повторить
            </button>
          </div>
        )}

        {!loading && chat.messages.length === 0 && chat.history !== 'error' && (
          <div className={styles.notice}>
            <p className={styles.noticeTitle}>Сообщений пока нет</p>
            <p>Напишите первым — сообщение придёт в WhatsApp на номер {phone}</p>
          </div>
        )}

        <ol className={styles.list}>
          {chat.messages.map((message, index) => {
            const previous = chat.messages[index - 1]
            const newDay = !previous || dayKey(previous.timestamp) !== dayKey(message.timestamp)
            // Хвостик у пузыря только у первого сообщения в серии от одного автора
            const firstInGroup = newDay || previous?.direction !== message.direction
            return (
              <Fragment key={message.id}>
                {newDay && (
                  <li className={styles.day}>
                    <span>{formatDayLabel(message.timestamp)}</span>
                  </li>
                )}
                <li
                  className={styles.row}
                  data-direction={message.direction}
                  data-first={firstInGroup || undefined}
                >
                  <div
                    className={styles.bubble}
                    data-failed={message.status === 'failed' || undefined}
                  >
                    <span className="visually-hidden">
                      {message.direction === 'out' ? 'Вы:' : 'Собеседник:'}
                    </span>
                    <p className={styles.text}>{message.text}</p>
                    <span className={styles.meta}>
                      <time dateTime={new Date(message.timestamp).toISOString()}>
                        {formatMessageTime(message.timestamp)}
                      </time>
                      <MessageStatus message={message} onRetry={() => onRetry(message)} />
                    </span>
                  </div>
                </li>
              </Fragment>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
