import { PersonIcon } from './icons'
import styles from './Avatar.module.css'

// Приглушённые цветные градиенты для аватарок — как в Telegram, только спокойнее
const GRADIENTS = [
  ['#e9a99c', '#d9877d'], // красный
  ['#f0c99d', '#e0a978'], // оранжевый
  ['#b6b9e9', '#9192d6'], // фиолетовый
  ['#b8d8a6', '#90bf88'], // зелёный
  ['#a2d9d0', '#76beb3'], // бирюзовый
  ['#a7cde7', '#7aacd4'], // голубой
  ['#ddb4e4', '#c592d2'], // розовый
] as const

/**
 * Один и тот же чат всегда получает один и тот же цвет. Считаем из chatId число (простой хеш)
 * и берём по нему цвет из списка. Простая сумма цифр не подходит: у номеров 1234567 и 7654321
 * она одинаковая, и аватарки совпали бы по цвету.
 */
function pickGradient(seed: string): readonly [string, string] {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return GRADIENTS[hash % GRADIENTS.length] ?? GRADIENTS[0]
}

interface AvatarProps {
  /** От чего зависит цвет — обычно chatId. */
  seed: string
  name?: string
  size?: number
}

/** Цветной кружок с первой буквой имени. Если имени нет — белый силуэт. */
export function Avatar({ seed, name, size = 49 }: AvatarProps) {
  const letter = name?.trim().charAt(0).toUpperCase()
  const [from, to] = pickGradient(seed)
  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(180deg, ${from}, ${to})`,
      }}
      aria-hidden="true"
    >
      {letter || <PersonIcon width={size * 0.55} height={size * 0.55} />}
    </span>
  )
}
