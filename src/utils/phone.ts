const MIN_DIGITS = 11
const MAX_DIGITS = 15

/**
 * Turns user input like "+7 (900) 123-45-67" or "8 900 123 45 67" into "79001234567".
 * Returns null when the input is not a valid phone number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return null

  let digits = trimmed.replace(/\D/g, '')
  // Russian numbers are often written with a leading 8 instead of 7
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`

  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null
  return digits
}

export function toChatId(phone: string): string {
  return `${phone}@c.us`
}

export function phoneFromChatId(chatId: string): string {
  return chatId.replace(/@c\.us$/, '')
}

/** "79001234567" → "+7 900 123-45-67"; other countries are shown as "+<digits>". */
export function formatPhone(phone: string): string {
  const match = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone)
  if (match) return `+7 ${match[1]} ${match[2]}-${match[3]}-${match[4]}`
  return `+${phone}`
}
