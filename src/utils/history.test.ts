import { describe, expect, it } from 'vitest'
import type { Message } from '../state/chatReducer'
import { historySenderName, mergeMessages, parseHistory, parseHistoryItem } from './history'

/** Записи в том виде, как их показывает документация getChatHistory. */
const incomingItem = {
  type: 'incoming',
  idMessage: '9DB14F14A253D33F4A9CD84123456789',
  timestamp: 1706522263,
  typeMessage: 'textMessage',
  chatId: '79001234567@c.us',
  textMessage: 'Привет',
  senderId: '79001234567@c.us',
  senderName: 'Василиса Премудрая',
  senderContactName: 'Василиса',
  statusMessage: null,
}

const outgoingItem = {
  type: 'outgoing',
  idMessage: 'BAE5143000000000',
  timestamp: 1706761225,
  typeMessage: 'textMessage',
  chatId: '79001234567@c.us',
  textMessage: 'Привет',
  statusMessage: 'read',
  sendByApi: true,
}

describe('parseHistoryItem', () => {
  it('разбирает входящее сообщение', () => {
    expect(parseHistoryItem(incomingItem)).toEqual({
      id: '9DB14F14A253D33F4A9CD84123456789',
      idMessage: '9DB14F14A253D33F4A9CD84123456789',
      text: 'Привет',
      direction: 'in',
      timestamp: 1706522263000,
      status: undefined,
    })
  })

  it('разбирает исходящее и считает его отправленным', () => {
    expect(parseHistoryItem(outgoingItem)).toMatchObject({ direction: 'out', status: 'sent' })
  })

  it('берёт текст из extendedTextMessage, если обычного нет', () => {
    const item = {
      ...incomingItem,
      typeMessage: 'extendedTextMessage',
      textMessage: undefined,
      extendedTextMessage: { text: 'Ссылка https://example.com' },
    }
    expect(parseHistoryItem(item)?.text).toBe('Ссылка https://example.com')
  })

  it.each([
    ['фото', { ...incomingItem, typeMessage: 'imageMessage' }],
    ['пустой текст', { ...incomingItem, textMessage: '' }],
    ['неизвестное направление', { ...incomingItem, type: 'other' }],
    ['нет времени', { ...incomingItem, timestamp: undefined }],
    ['null', null],
  ])('пропускает: %s', (_name, item) => {
    expect(parseHistoryItem(item)).toBeNull()
  })
})

describe('parseHistory', () => {
  it('оставляет только текстовые сообщения', () => {
    const result = parseHistory([incomingItem, { typeMessage: 'imageMessage' }, outgoingItem])
    expect(result).toHaveLength(2)
  })
})

describe('historySenderName', () => {
  it('берёт имя из контактов, а если его нет — имя из WhatsApp', () => {
    expect(historySenderName([outgoingItem, incomingItem])).toBe('Василиса')
    expect(historySenderName([{ ...incomingItem, senderContactName: '' }])).toBe(
      'Василиса Премудрая',
    )
  })

  it('возвращает undefined, если входящих нет', () => {
    expect(historySenderName([outgoingItem])).toBeUndefined()
  })
})

describe('mergeMessages', () => {
  const message = (idMessage: string | undefined, timestamp: number): Message => ({
    id: idMessage ?? `local-${timestamp}`,
    idMessage,
    text: 'текст',
    direction: 'in',
    timestamp,
  })

  it('добавляет новые сообщения и сортирует по времени', () => {
    const merged = mergeMessages([message('B', 200)], [message('A', 100)])
    expect(merged.map((m) => m.idMessage)).toEqual(['A', 'B'])
  })

  it('не задваивает сообщения, которые уже есть в памяти', () => {
    const merged = mergeMessages([message('A', 100)], [message('A', 100)])
    expect(merged).toHaveLength(1)
  })

  it('сохраняет ещё не отправленные сообщения без idMessage', () => {
    const merged = mergeMessages([message(undefined, 300)], [message('A', 100)])
    expect(merged.map((m) => m.id)).toEqual(['A', 'local-300'])
  })
})
