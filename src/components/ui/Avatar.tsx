import { PersonIcon } from './icons'
import styles from './Avatar.module.css'

/** Кружок с первой буквой имени. Если имени нет — серый силуэт, как в WhatsApp. */
export function Avatar({ name, size = 49 }: { name?: string; size?: number }) {
  const letter = name?.trim().charAt(0).toUpperCase()
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {letter || <PersonIcon width={size * 0.6} height={size * 0.6} />}
    </span>
  )
}
