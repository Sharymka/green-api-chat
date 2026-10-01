import { useChat } from '../../state/chatContext'
import styles from './MessengerScreen.module.css'

export function MessengerScreen() {
  const { state, dispatch } = useChat()

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Чаты">
        <header className={styles.header}>
          <span className={styles.instance}>Инстанс {state.credentials?.idInstance}</span>
          <button
            type="button"
            className={styles.logout}
            onClick={() => dispatch({ type: 'loggedOut' })}
          >
            Выйти
          </button>
        </header>
      </aside>
      <main className={styles.main}>
        <p className={styles.placeholder}>Выберите чат или создайте новый</p>
      </main>
    </div>
  )
}
