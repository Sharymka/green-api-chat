import { describe, expect, it } from 'vitest'
import { parseIncomingMessage } from './notifications'

/** Входящее сообщение в том виде, как его показывает документация GREEN-API. */
function incoming(messageData: unknown, overrides: Record<string, unknown> = {}) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 7107000001, wid: '79876543210@c.us', typeInstance: 'whatsapp' },
    timestamp: 1588091580,
    idMessage: 'F7AEC1B7086ECDC7E6E45923F5EDB825',
    senderData: {
      chatId: '79001234567@c.us',
      sender: '79001234567@c.us',
      chatName: 'Иван',
      senderName: 'Иван Царевич',
    },
    messageData,
    ...overrides,
  }
}

const expected = {
  idMessage: 'F7AEC1B7086ECDC7E6E45923F5EDB825',
  chatId: '79001234567@c.us',
  text: 'Привет',
  timestamp: 1588091580,
  senderName: 'Иван Царевич',
}

describe('parseIncomingMessage', () => {
  it('parses a plain text message', () => {
    const body = incoming({
      typeMessage: 'textMessage',
      textMessageData: { textMessage: 'Привет' },
    })
    expect(parseIncomingMessage(body)).toEqual(expected)
  })

  it.each(['extendedTextMessage', 'quotedMessage'])('parses %s', (typeMessage) => {
    const body = incoming({ typeMessage, extendedTextMessageData: { text: 'Привет' } })
    expect(parseIncomingMessage(body)).toEqual(expected)
  })

  it('falls back to chatName when senderName is missing', () => {
    const body = incoming(
      { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
      { senderData: { chatId: '79001234567@c.us', chatName: 'Иван' } },
    )
    expect(parseIncomingMessage(body)?.senderName).toBe('Иван')
  })

  it.each([
    ['null', null],
    ['a status notification', { typeWebhook: 'outgoingMessageStatus', status: 'read' }],
    ['an image', incoming({ typeMessage: 'imageMessage', fileMessageData: {} })],
    [
      'a group message',
      incoming(
        { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
        { senderData: { chatId: '120363369140947676@g.us' } },
      ),
    ],
    [
      'an empty text',
      incoming({ typeMessage: 'textMessage', textMessageData: { textMessage: '' } }),
    ],
    ['missing messageData', incoming(undefined)],
    [
      'missing idMessage',
      incoming(
        { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
        { idMessage: undefined },
      ),
    ],
  ])('ignores %s', (_name, body) => {
    expect(parseIncomingMessage(body)).toBeNull()
  })
})
