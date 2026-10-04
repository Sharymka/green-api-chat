import { describe, expect, it } from 'vitest'
import { buildRecentChats } from './recentChats'

const IVAN = '79001234567@c.us'
const MARIA = '79007654321@c.us'

/** Записи журналов в том виде, как их показывает документация GREEN-API. */
const incoming = (chatId: string, idMessage: string, timestamp: number, text: string) => ({
  type: 'incoming',
  idMessage,
  timestamp,
  typeMessage: 'textMessage',
  chatId,
  senderId: chatId,
  senderName: chatId === IVAN ? 'Иван' : 'Мария',
  textMessage: text,
})
const outgoing = (chatId: string, idMessage: string, timestamp: number, text: string) => ({
  type: 'outgoing',
  idMessage,
  timestamp,
  typeMessage: 'textMessage',
  chatId,
  textMessage: text,
  statusMessage: 'read',
  sendByApi: true,
})

describe('buildRecentChats', () => {
  it('собирает чаты из входящих и исходящих, сверху — самый свежий', () => {
    const chats = buildRecentChats([
      incoming(IVAN, 'A', 100, 'Привет'),
      outgoing(MARIA, 'B', 300, 'Добрый день'),
      outgoing(IVAN, 'C', 200, 'Привет!'),
    ])

    expect(chats.map((c) => c.chatId)).toEqual([MARIA, IVAN])
    expect(chats[1]).toMatchObject({ name: 'Иван' })
    expect(chats[1]?.messages.map((m) => m.text)).toEqual(['Привет', 'Привет!'])
  })

  it('не показывает чаты, которые ведутся только с телефона', () => {
    const chats = buildRecentChats([
      // С Марией переписка только с телефона: входящее и исходящее не через API
      incoming(MARIA, 'M1', 100, 'Привет, как дела?'),
      { ...outgoing(MARIA, 'M2', 200, 'Норм'), sendByApi: false },
      // Ивану писали из приложения
      outgoing(IVAN, 'I1', 50, 'Здравствуйте'),
    ])

    expect(chats.map((c) => c.chatId)).toEqual([IVAN])
  })

  it('пропускает группы и нетекстовые сообщения', () => {
    const chats = buildRecentChats([
      outgoing('120363369140947676@g.us', 'G', 100, 'В группе'),
      outgoing(IVAN, 'I1', 50, 'Здравствуйте'),
      { ...incoming(IVAN, 'P', 200, ''), typeMessage: 'imageMessage' },
    ])

    expect(chats).toHaveLength(1)
    expect(chats[0]?.messages.map((m) => m.text)).toEqual(['Здравствуйте'])
  })

  it('не падает на мусоре в журнале', () => {
    expect(buildRecentChats([null, 'строка', { chatId: 5 }])).toEqual([])
  })
})
