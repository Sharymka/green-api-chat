import styles from './Spinner.module.css'

/** Крутилка загрузки. Скринридер её не читает — состояние объясняем текстом рядом. */
export function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />
}
