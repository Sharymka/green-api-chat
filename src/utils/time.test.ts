import { describe, expect, it } from 'vitest'
import { formatChatTime, formatMessageTime } from './time'

// Время задаём по местному часовому поясу, чтобы тест не зависел от того, где его запускают
const now = new Date(2026, 9, 1, 15, 30).getTime()

describe('formatMessageTime', () => {
  it('показывает часы и минуты с ведущим нулём', () => {
    expect(formatMessageTime(new Date(2026, 9, 1, 9, 5).getTime())).toBe('09:05')
  })
})

describe('formatChatTime', () => {
  it('для сегодняшнего сообщения показывает время', () => {
    expect(formatChatTime(new Date(2026, 9, 1, 14, 5).getTime(), now)).toBe('14:05')
  })

  it('для вчерашнего пишет «вчера»', () => {
    expect(formatChatTime(new Date(2026, 8, 30, 23, 59).getTime(), now)).toBe('вчера')
  })

  it('для более старых показывает дату', () => {
    expect(formatChatTime(new Date(2026, 8, 12, 10, 0).getTime(), now)).toBe('12.09.2026')
  })
})
