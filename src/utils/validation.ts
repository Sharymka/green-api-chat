import type { Credentials } from '../api/greenApi'

export const MAX_MESSAGE_LENGTH = 20_000

export type CredentialsErrors = Partial<Record<keyof Credentials, string>>

/** Куда разрешено отправлять токен. Любой другой адрес может оказаться чужим сервером, и токен утечёт. */
const ALLOWED_HOSTS = [/^([\w-]+\.)*api\.greenapi\.com$/, /^([\w-]+\.)*api\.green-api\.com$/]

export function normalizeApiUrl(input: string): string {
  return input.trim().replace(/\/+$/, '')
}

export function validateApiUrl(input: string): string | undefined {
  const value = normalizeApiUrl(input)
  if (!value) return 'Укажите apiUrl'

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return 'Некорректный адрес'
  }

  if (url.protocol !== 'https:') return 'Адрес должен начинаться с https://'
  if (url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') {
    return 'Укажите только адрес сервера, например https://7107.api.greenapi.com'
  }
  if (!ALLOWED_HOSTS.some((host) => host.test(url.hostname))) {
    return 'Разрешены только адреса GREEN-API (*.api.greenapi.com)'
  }
  return undefined
}

export function validateCredentials(values: Credentials): CredentialsErrors {
  const errors: CredentialsErrors = {}

  const idInstance = values.idInstance.trim()
  if (!idInstance) errors.idInstance = 'Укажите idInstance'
  else if (!/^\d+$/.test(idInstance)) errors.idInstance = 'idInstance состоит только из цифр'

  const token = values.apiTokenInstance.trim()
  if (!token) errors.apiTokenInstance = 'Укажите apiTokenInstance'
  else if (/\s/.test(token)) errors.apiTokenInstance = 'Токен не должен содержать пробелов'

  const apiUrlError = validateApiUrl(values.apiUrl)
  if (apiUrlError) errors.apiUrl = apiUrlError

  return errors
}

export function normalizeCredentials(values: Credentials): Credentials {
  return {
    apiUrl: normalizeApiUrl(values.apiUrl),
    idInstance: values.idInstance.trim(),
    apiTokenInstance: values.apiTokenInstance.trim(),
  }
}

export function validateMessage(text: string): string | undefined {
  if (!text.trim()) return 'Введите сообщение'
  if (text.trim().length > MAX_MESSAGE_LENGTH) {
    return `Сообщение длиннее ${MAX_MESSAGE_LENGTH.toLocaleString('ru-RU')} символов`
  }
  return undefined
}
