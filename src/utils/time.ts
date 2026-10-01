const pad = (n: number) => String(n).padStart(2, '0')

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Время сообщения внутри переписки: всегда «14:05». */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Время в списке чатов, как в WhatsApp: сегодня — «14:05», вчера — «вчера»,
 * раньше — «12.09.2026».
 */
export function formatChatTime(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp)
  const today = new Date(now)
  if (isSameDay(date, today)) return formatMessageTime(timestamp)

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(date, yesterday)) return 'вчера'

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

/** Подпись-разделитель между днями в переписке: «Сегодня», «Вчера» или «12 сентября». */
export function formatDayLabel(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp)
  const today = new Date(now)
  if (isSameDay(date, today)) return 'Сегодня'

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(date, yesterday)) return 'Вчера'

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

/** Ключ дня, чтобы понять, что два сообщения из разных дней и между ними нужен разделитель. */
export function dayKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
