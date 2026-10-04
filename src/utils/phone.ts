const MIN_DIGITS = 11
const MAX_DIGITS = 15

/**
 * Приводит номер к виду «только цифры»: "+7 (900) 123-45-67", "8 900 123 45 67" и "900 123 45 67"
 * станут "79001234567".
 * Если это не похоже на номер телефона, возвращает null.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return null

  let digits = trimmed.replace(/\D/g, '')
  // Российские номера часто пишут через 8 — меняем её на 7
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`
  // А мобильные — вообще без кода страны: 900 123-45-67. Без плюса и с 9 в начале — это Россия
  if (digits.length === 10 && digits.startsWith('9') && !trimmed.startsWith('+')) {
    digits = `7${digits}`
  }

  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null
  return digits
}

export function toChatId(phone: string): string {
  return `${phone}@c.us`
}

export function phoneFromChatId(chatId: string): string {
  return chatId.replace(/@c\.us$/, '')
}

/** Для показа на экране: "79001234567" → "+7 900 123-45-67". Номера других стран — просто "+цифры". */
export function formatPhone(phone: string): string {
  const match = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone)
  if (match) return `+7 ${match[1]} ${match[2]}-${match[3]}-${match[4]}`
  return `+${phone}`
}
