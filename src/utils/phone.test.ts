import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone, phoneFromChatId, toChatId } from './phone'

describe('normalizePhone', () => {
  it.each([
    ['79001234567', '79001234567'],
    ['+7 (900) 123-45-67', '79001234567'],
    ['8 900 123 45 67', '79001234567'],
    ['  +79001234567  ', '79001234567'],
    ['+44 7911 123456', '447911123456'],
    ['900 123-45-67', '79001234567'],
    ['(900) 1234567', '79001234567'],
  ])('превращает "%s" в "%s"', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each([
    ['пустую строку', ''],
    ['слишком короткий номер', '+7 900 123'],
    ['10 цифр с плюсом — это не российский мобильный без кода', '+9001234567'],
    ['10 цифр, но не с 9', '4951234567'],
    ['слишком длинный номер', '+1234567890123456'],
    ['буквы', '+7 900 abc 45 67'],
    ['плюс в середине', '7900+1234567'],
  ])('отклоняет: %s', (_name, input) => {
    expect(normalizePhone(input)).toBeNull()
  })
})

describe('один и тот же номер в разных форматах', () => {
  it.each(['+7 900 123-45-67', '8 (900) 123-45-67', '79001234567', '900 123 45 67'])(
    '"%s" — тот же чат 79001234567@c.us',
    (input) => {
      const phone = normalizePhone(input)
      expect(phone && toChatId(phone)).toBe('79001234567@c.us')
    },
  )
})

describe('toChatId и phoneFromChatId', () => {
  it('превращает номер в chatId и обратно', () => {
    expect(toChatId('79001234567')).toBe('79001234567@c.us')
    expect(phoneFromChatId('79001234567@c.us')).toBe('79001234567')
  })
})

describe('formatPhone', () => {
  it('красиво форматирует российский номер', () => {
    expect(formatPhone('79001234567')).toBe('+7 900 123-45-67')
  })

  it('номера других стран показывает с плюсом', () => {
    expect(formatPhone('447911123456')).toBe('+447911123456')
  })
})
