import { describe, expect, it } from 'vitest'
import {
  parseIncomingMessage,
  parseInstanceState,
  parseQuotaExceeded,
  parseStatusUpdate,
} from './notifications'

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
  it('разбирает обычное текстовое сообщение', () => {
    const body = incoming({
      typeMessage: 'textMessage',
      textMessageData: { textMessage: 'Привет' },
    })
    expect(parseIncomingMessage(body)).toEqual(expected)
  })

  it.each(['extendedTextMessage', 'quotedMessage'])('разбирает %s', (typeMessage) => {
    const body = incoming({ typeMessage, extendedTextMessageData: { text: 'Привет' } })
    expect(parseIncomingMessage(body)).toEqual(expected)
  })

  it('берёт chatName, если нет senderName', () => {
    const body = incoming(
      { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
      { senderData: { chatId: '79001234567@c.us', chatName: 'Иван' } },
    )
    expect(parseIncomingMessage(body)?.senderName).toBe('Иван')
  })

  it.each([
    ['null', null],
    ['статус доставки', { typeWebhook: 'outgoingMessageStatus', status: 'read' }],
    ['фото', incoming({ typeMessage: 'imageMessage', fileMessageData: {} })],
    [
      'сообщение из группы',
      incoming(
        { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
        { senderData: { chatId: '120363369140947676@g.us' } },
      ),
    ],
    [
      'пустой текст',
      incoming({ typeMessage: 'textMessage', textMessageData: { textMessage: '' } }),
    ],
    ['нет messageData', incoming(undefined)],
    [
      'нет idMessage',
      incoming(
        { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
        { idMessage: undefined },
      ),
    ],
  ])('пропускает: %s', (_name, body) => {
    expect(parseIncomingMessage(body)).toBeNull()
  })
})

describe('parseStatusUpdate', () => {
  /** Уведомление о статусе в том виде, как его показывает документация GREEN-API. */
  const statusBody = (status: string) => ({
    typeWebhook: 'outgoingMessageStatus',
    chatId: '79001234567@c.us',
    instanceData: { idInstance: 7107000001, wid: '79876543210@c.us', typeInstance: 'whatsapp' },
    timestamp: 1727691478,
    idMessage: '3EB0608D6A2901063D63',
    status,
    sendByApi: true,
  })

  it.each(['sent', 'delivered', 'read'])('разбирает статус %s', (status) => {
    expect(parseStatusUpdate(statusBody(status))).toEqual({
      chatId: '79001234567@c.us',
      idMessage: '3EB0608D6A2901063D63',
      status,
    })
  })

  it.each(['failed', 'noAccount', 'suspended', 'yellowCard'])(
    'статус %s считает ошибкой доставки',
    (status) => {
      expect(parseStatusUpdate(statusBody(status))?.status).toBe('failed')
    },
  )

  it.each([
    ['входящее сообщение', { typeWebhook: 'incomingMessageReceived' }],
    ['неизвестный статус', statusBody('somethingNew')],
    ['нет idMessage', { ...statusBody('read'), idMessage: undefined }],
    ['null', null],
  ])('пропускает: %s', (_name, body) => {
    expect(parseStatusUpdate(body)).toBeNull()
  })
})

describe('parseInstanceState', () => {
  it('достаёт новое состояние инстанса', () => {
    expect(
      parseInstanceState({ typeWebhook: 'stateInstanceChanged', stateInstance: 'notAuthorized' }),
    ).toBe('notAuthorized')
  })

  it('пропускает другие уведомления', () => {
    expect(parseInstanceState({ typeWebhook: 'incomingMessageReceived' })).toBeNull()
  })
})

describe('parseQuotaExceeded', () => {
  /** Уведомление в том виде, в каком его реально прислал GREEN-API (номера заменены). */
  const quotaBody = {
    typeWebhook: 'quotaExceeded',
    instanceData: { idInstance: 7107000001, wid: '79000000000@c.us', typeInstance: 'whatsapp' },
    quotaData: {
      method: 'correspondents',
      used: 3,
      total: 3,
      status: 'CORRESPONDENTS_QUOTE_EXCEEDED',
      description:
        'Monthly quota has been exceeded. You can only send or receive messages from these numbers: 120363000000000001@g.us,79001234567@c.us. Please go to your personal account and change the tariff to business https://console.green-api.com',
    },
  }

  it('достаёт лимит и список разрешённых собеседников из описания', () => {
    expect(parseQuotaExceeded(quotaBody)).toEqual({
      used: 3,
      total: 3,
      allowedChatIds: ['120363000000000001@g.us', '79001234567@c.us'],
    })
  })

  it('не падает, если данных о лимите нет', () => {
    expect(parseQuotaExceeded({ typeWebhook: 'quotaExceeded' })).toEqual({
      used: undefined,
      total: undefined,
      allowedChatIds: [],
    })
  })

  it('пропускает другие уведомления', () => {
    expect(parseQuotaExceeded({ typeWebhook: 'outgoingMessageStatus' })).toBeNull()
  })
})
