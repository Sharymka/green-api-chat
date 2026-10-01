import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone, phoneFromChatId, toChatId } from './phone'

describe('normalizePhone', () => {
  it.each([
    ['79001234567', '79001234567'],
    ['+7 (900) 123-45-67', '79001234567'],
    ['8 900 123 45 67', '79001234567'],
    ['  +79001234567  ', '79001234567'],
    ['+44 7911 123456', '447911123456'],
  ])('normalizes "%s" to "%s"', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each([
    ['empty', ''],
    ['too short', '+7 900 123'],
    ['too long', '+1234567890123456'],
    ['letters', '+7 900 abc 45 67'],
    ['plus in the middle', '7900+1234567'],
  ])('rejects %s input', (_name, input) => {
    expect(normalizePhone(input)).toBeNull()
  })
})

describe('chatId helpers', () => {
  it('converts a phone to a chatId and back', () => {
    expect(toChatId('79001234567')).toBe('79001234567@c.us')
    expect(phoneFromChatId('79001234567@c.us')).toBe('79001234567')
  })
})

describe('formatPhone', () => {
  it('formats Russian numbers', () => {
    expect(formatPhone('79001234567')).toBe('+7 900 123-45-67')
  })

  it('shows other numbers with a plus', () => {
    expect(formatPhone('447911123456')).toBe('+447911123456')
  })
})
