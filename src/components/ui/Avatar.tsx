import { PersonIcon } from './icons'
import styles from './Avatar.module.css'

// Приглушённые градиенты для аватарок, как в Telegram, но спокойнее:
// сверху светлый пастельный оттенок, снизу — более глубокий того же цвета
const GRADIENTS = [
  ['#f4c3b8', '#c96f69'], // красный
  ['#f7dcb5', '#d39461'], // оранжевый
  ['#d2d4f5', '#7778c4'], // фиолетовый
  ['#d3ebc4', '#76a971'], // зелёный
  ['#c3ece5', '#5aa89d'], // бирюзовый
  ['#c6e2f4', '#5f93c2'], // голубой
  ['#eccdf1', '#ab74bd'], // розовый
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
        // Мягкий блик сверху слева поверх диагонального градиента — аватарка выглядит объёмнее
        background: `radial-gradient(circle at 30% 25%, rgb(255 255 255 / 0.35), transparent 55%), linear-gradient(145deg, ${from}, ${to})`,
      }}
      aria-hidden="true"
    >
      {letter || <PersonIcon width={size * 0.55} height={size * 0.55} />}
    </span>
  )
}
