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
  ])('пропускает %s', (url) => {
    expect(validateApiUrl(url)).toBeUndefined()
  })

  it.each([
    ['пустой адрес', '', 'Укажите адрес API'],
    ['не адрес', 'greenapi', 'Некорректный адрес'],
    ['http вместо https', 'http://7107.api.greenapi.com', 'Адрес должен начинаться с https://'],
    [
      'чужой домен',
      'https://evil.example.com',
      'Разрешены только адреса GREEN-API (*.api.greenapi.com)',
    ],
    [
      'поддельный домен, похожий на настоящий',
      'https://api.greenapi.com.evil.example',
      'Разрешены только адреса GREEN-API (*.api.greenapi.com)',
    ],
    [
      'адрес с путём',
      'https://7107.api.greenapi.com/waInstance1',
      'Укажите только адрес сервера, например https://7107.api.greenapi.com',
    ],
    [
      'логин и пароль внутри адреса',
      'https://user:pass@7107.api.greenapi.com',
      'Укажите только адрес сервера, например https://7107.api.greenapi.com',
    ],
  ])('отклоняет: %s', (_name, url, message) => {
    expect(validateApiUrl(url)).toBe(message)
  })
})

describe('validateCredentials', () => {
  const valid = {
    apiUrl: 'https://7107.api.greenapi.com',
    idInstance: '7107000001',
    apiTokenInstance: 'abc123',
  }

  it('не находит ошибок в правильных данных', () => {
    expect(validateCredentials(valid)).toEqual({})
  })

  it('сообщает об ошибке в каждом неверном поле', () => {
    expect(validateCredentials({ apiUrl: '', idInstance: '71a', apiTokenInstance: 'a b' })).toEqual(
      {
        apiUrl: 'Укажите адрес API',
        idInstance: 'ID инстанса состоит только из цифр',
        apiTokenInstance: 'Токен не должен содержать пробелов',
      },
    )
  })

  it('сообщает о пустых полях', () => {
    const errors = validateCredentials({
      apiUrl: valid.apiUrl,
      idInstance: ' ',
      apiTokenInstance: '',
    })
    expect(errors.idInstance).toBe('Укажите ID инстанса')
    expect(errors.apiTokenInstance).toBe('Укажите API-токен')
  })

  it('убирает лишние пробелы и слэш в конце', () => {
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
  it('не пропускает пустое сообщение', () => {
    expect(validateMessage('   \n ')).toBe('Введите сообщение')
  })

  it('не пропускает сообщение длиннее лимита API', () => {
    expect(validateMessage('a'.repeat(MAX_MESSAGE_LENGTH + 1))).toMatch(/длиннее/)
  })

  it('пропускает обычное сообщение', () => {
    expect(validateMessage('Привет')).toBeUndefined()
  })
})
