import type { Chat } from '../../state/chatReducer'
import { chatTitle } from '../../utils/chat'
import { formatPhone, phoneFromChatId } from '../../utils/phone'
import { Avatar } from '../ui/Avatar'
import { BackIcon } from '../ui/icons'
import { IconButton } from '../ui/IconButton'
import styles from './ChatPane.module.css'

interface ChatPaneProps {
  chat: Chat
  onBack: () => void
}

/** Открытый чат: шапка с собеседником, лента сообщений и поле ввода. */
export function ChatPane({ chat, onBack }: ChatPaneProps) {
  const title = chatTitle(chat)
  const phone = formatPhone(phoneFromChatId(chat.chatId))

  return (
    <section className={styles.pane} aria-label={`Чат: ${title}`}>
      <header className={styles.header}>
        {/* «Назад» нужна только на телефоне, где список и чат не помещаются рядом */}
        <IconButton label="Назад к списку чатов" className={styles.back} onClick={onBack}>
          <BackIcon />
        </IconButton>
        <Avatar name={chat.name} size={40} />
        <div className={styles.titles}>
          <h2 className={styles.title}>{title}</h2>
          {chat.name && <p className={styles.subtitle}>{phone}</p>}
        </div>
      </header>
      <div className={styles.messages}>
        {chat.messages.length === 0 && chat.history !== 'loading' && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Сообщений пока нет</p>
            <p>Напишите первым — сообщение придёт в WhatsApp на номер {phone}</p>
          </div>
        )}
      </div>
    </section>
  )
}
