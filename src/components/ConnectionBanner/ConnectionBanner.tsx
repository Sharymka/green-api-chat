import { Spinner } from '../ui/Spinner'
import styles from './ConnectionBanner.module.css'

/**
 * Плашка «нет соединения». Элемент <output> скринридер воспринимает как область статуса.
 * Сам элемент есть на странице всегда, а текст в нём появляется и исчезает —
 * так скринридер замечает изменение и зачитывает его.
 */
export function ConnectionBanner({ reconnecting }: { reconnecting: boolean }) {
  return (
    <output>
      {reconnecting && (
        <p className={styles.banner}>
          <Spinner />
          Нет соединения. Переподключаемся…
        </p>
      )}
    </output>
  )
}
