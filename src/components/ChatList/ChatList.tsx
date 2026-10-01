import type { Chat } from '../../state/chatReducer'
import { chatTitle } from '../../utils/chat'
import { formatChatTime } from '../../utils/time'
import { Avatar } from '../ui/Avatar'
import styles from './ChatList.module.css'

interface ChatListProps {
  chats: Chat[]
  activeChatId: string | null
  onSelect: (chatId: string) => void
}

export function ChatList({ chats, activeChatId, onSelect }: ChatListProps) {
  if (chats.length === 0) {
    return (
      <p className={styles.empty}>
        Чатов пока нет.
        <br />
        Нажмите «＋», чтобы написать по номеру телефона.
      </p>
    )
  }

  return (
    <ul className={styles.list}>
      {chats.map((chat) => {
        const last = chat.messages.at(-1)
        const title = chatTitle(chat)
        const active = chat.chatId === activeChatId
        return (
          <li key={chat.chatId}>
            <button
              type="button"
              className={styles.item}
              onClick={() => onSelect(chat.chatId)}
              aria-current={active ? 'true' : undefined}
            >
              <Avatar name={chat.name} />
              <span className={styles.body}>
                <span className={styles.row}>
                  <span className={styles.title}>{title}</span>
                  {last && (
                    <time
                      className={styles.time}
                      data-unread={chat.unread > 0 || undefined}
                      dateTime={new Date(last.timestamp).toISOString()}
                    >
                      {formatChatTime(last.timestamp)}
                    </time>
                  )}
                </span>
                <span className={styles.row}>
                  <span className={styles.preview}>
                    {last
                      ? last.direction === 'out'
                        ? `Вы: ${last.text}`
                        : last.text
                      : 'Нет сообщений'}
                  </span>
                  {chat.unread > 0 && (
                    <span className={styles.badge}>
                      {chat.unread}
                      <span className="visually-hidden"> непрочитанных</span>
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
