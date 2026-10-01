import { useState } from 'react'
import { useNotifications } from '../../hooks/useNotifications'
import { useChat } from '../../state/chatContext'
import { ChatList } from '../ChatList/ChatList'
import { ConnectionBanner } from '../ConnectionBanner/ConnectionBanner'
import { ChatPane } from '../ChatPane/ChatPane'
import { NewChatDialog } from '../NewChatDialog/NewChatDialog'
import { ChatIcon, LogoutIcon, PlusIcon } from '../ui/icons'
import { IconButton } from '../ui/IconButton'
import styles from './MessengerScreen.module.css'

export function MessengerScreen() {
  const { state, dispatch } = useChat()
  const [newChatOpen, setNewChatOpen] = useState(false)
  // Пока открыт мессенджер, в фоне работает цикл получения входящих сообщений
  useNotifications()
  const activeChat = state.chats.find((c) => c.chatId === state.activeChatId)

  return (
    // На телефоне видна одна колонка: список чатов или открытый чат
    <div className={styles.layout} data-chat-open={activeChat ? true : undefined}>
      <aside className={styles.sidebar} aria-label="Чаты">
        <header className={styles.header}>
          <div className={styles.account}>
            <span className={styles.accountName}>Мой WhatsApp</span>
            <span className={styles.accountId}>ID {state.credentials?.idInstance}</span>
          </div>
          <IconButton label="Новый чат" tone="accent" onClick={() => setNewChatOpen(true)}>
            <PlusIcon />
          </IconButton>
          <IconButton label="Выйти" tone="danger" onClick={() => dispatch({ type: 'loggedOut' })}>
            <LogoutIcon />
          </IconButton>
        </header>
        <ConnectionBanner reconnecting={state.connection === 'reconnecting'} />
        <ChatList
          chats={state.chats}
          activeChatId={state.activeChatId}
          onSelect={(chatId) => dispatch({ type: 'chatOpened', chatId })}
        />
      </aside>

      <main className={styles.main}>
        {activeChat ? (
          <ChatPane chat={activeChat} onBack={() => dispatch({ type: 'chatClosed' })} />
        ) : (
          <div className={styles.placeholder}>
            <ChatIcon width={64} height={64} className={styles.placeholderIcon} />
            <h2 className={styles.placeholderTitle}>GREEN-API Chat</h2>
            <p>Выберите чат слева или создайте новый по номеру телефона.</p>
          </div>
        )}
      </main>

      {newChatOpen && (
        <NewChatDialog
          onClose={() => setNewChatOpen(false)}
          onCreate={(chatId) => {
            dispatch({ type: 'chatOpened', chatId })
            setNewChatOpen(false)
          }}
        />
      )}
    </div>
  )
}
