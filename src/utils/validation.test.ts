import { describe, expect, it } from 'vitest'
import {
  MAX_MESSAGE_LENGTH,
  normalizeCredentials,
  validateApiUrl,
  validateCredentials,
  validateMessage,
} from './validation'

describe('validateApiUrl', () => {
  it.each([
    'https://7107.api.greenapi.com',
    'https://7107.api.greenapi.com/',
    'https://api.green-api.com',
    'https://3100.api.green-api.com',
  ])('accepts %s', (url) => {
    expect(validateApiUrl(url)).toBeUndefined()
  })

  it.each([
    ['empty', '', 'Укажите apiUrl'],
    ['not a URL', 'greenapi', 'Некорректный адрес'],
    ['http', 'http://7107.api.greenapi.com', 'Адрес должен начинаться с https://'],
    [
      'foreign host',
      'https://evil.example.com',
      'Разрешены только адреса GREEN-API (*.api.greenapi.com)',
    ],
    [
      'look-alike host',
      'https://api.greenapi.com.evil.example',
      'Разрешены только адреса GREEN-API (*.api.greenapi.com)',
    ],
    [
      'path',
      'https://7107.api.greenapi.com/waInstance1',
      'Укажите только адрес сервера, например https://7107.api.greenapi.com',
    ],
    [
      'credentials in URL',
      'https://user:pass@7107.api.greenapi.com',
      'Укажите только адрес сервера, например https://7107.api.greenapi.com',
    ],
  ])('rejects %s', (_name, url, message) => {
    expect(validateApiUrl(url)).toBe(message)
  })
})

describe('validateCredentials', () => {
  const valid = {
    apiUrl: 'https://7107.api.greenapi.com',
    idInstance: '7107000001',
    apiTokenInstance: 'abc123',
  }

  it('returns no errors for valid values', () => {
    expect(validateCredentials(valid)).toEqual({})
  })

  it('reports every invalid field', () => {
    expect(validateCredentials({ apiUrl: '', idInstance: '71a', apiTokenInstance: 'a b' })).toEqual(
      {
        apiUrl: 'Укажите apiUrl',
        idInstance: 'idInstance состоит только из цифр',
        apiTokenInstance: 'Токен не должен содержать пробелов',
      },
    )
  })

  it('reports empty fields', () => {
    const errors = validateCredentials({
      apiUrl: valid.apiUrl,
      idInstance: ' ',
      apiTokenInstance: '',
    })
    expect(errors.idInstance).toBe('Укажите idInstance')
    expect(errors.apiTokenInstance).toBe('Укажите apiTokenInstance')
  })

  it('trims values and the trailing slash on normalize', () => {
    expect(
      normalizeCredentials({
        apiUrl: ' https://7107.api.greenapi.com/ ',
        idInstance: ' 7107000001 ',
        apiTokenInstance: ' abc123 ',
      }),
    ).toEqual(valid)
  })
})

describe('validateMessage', () => {
  it('rejects blank messages', () => {
    expect(validateMessage('   \n ')).toBe('Введите сообщение')
  })

  it('rejects messages over the API limit', () => {
    expect(validateMessage('a'.repeat(MAX_MESSAGE_LENGTH + 1))).toMatch(/длиннее/)
  })

  it('accepts a normal message', () => {
    expect(validateMessage('Привет')).toBeUndefined()
  })
})
