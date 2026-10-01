import { useChatHistory } from '../../hooks/useChatHistory'
import { useSendMessage } from '../../hooks/useSendMessage'
import type { Chat } from '../../state/chatReducer'
import { chatTitle } from '../../utils/chat'
import { formatPhone, phoneFromChatId } from '../../utils/phone'
import { Composer } from '../Composer/Composer'
import { MessageList } from '../MessageList/MessageList'
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
  const { send, retry } = useSendMessage(chat.chatId)
  const history = useChatHistory(chat)

  return (
    <section className={styles.pane} aria-label={`Чат: ${title}`}>
      <header className={styles.header}>
        {/* «Назад» нужна только на телефоне, где список и чат не помещаются рядом */}
        <IconButton
          label="Назад к списку чатов"
          tone="accent"
          className={styles.back}
          onClick={onBack}
        >
          <BackIcon />
        </IconButton>
        <Avatar seed={chat.chatId} name={chat.name} size={40} />
        <div className={styles.titles}>
          <h2 className={styles.title}>{title}</h2>
          {chat.name && <p className={styles.subtitle}>{phone}</p>}
        </div>
      </header>
      <div className={styles.wallpaper}>
        <MessageList
          chat={chat}
          phone={phone}
          onRetry={(message) => retry(message.id, message.text)}
          onRetryHistory={history.retry}
        />
      </div>
      <Composer key={chat.chatId} onSend={send} />
    </section>
  )
}
