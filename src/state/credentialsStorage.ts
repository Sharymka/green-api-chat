import type { Credentials } from '../api/greenApi'

const KEY = 'green-api-chat:credentials'

// sessionStorage живёт, пока открыта вкладка: перезагрузка страницы не разлогинит,
// а после закрытия вкладки токен из браузера исчезнет.
// Доступ к хранилищу может бросить ошибку (например, в приватном режиме), поэтому всё в try/catch.

export function loadCredentials(): Credentials | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (
      typeof data === 'object' &&
      data !== null &&
      'apiUrl' in data &&
      'idInstance' in data &&
      'apiTokenInstance' in data &&
      typeof data.apiUrl === 'string' &&
      typeof data.idInstance === 'string' &&
      typeof data.apiTokenInstance === 'string'
    ) {
      return {
        apiUrl: data.apiUrl,
        idInstance: data.idInstance,
        apiTokenInstance: data.apiTokenInstance,
      }
    }
    return null
  } catch {
    return null
  }
}

export function saveCredentials(credentials: Credentials | null): void {
  try {
    if (credentials) sessionStorage.setItem(KEY, JSON.stringify(credentials))
    else sessionStorage.removeItem(KEY)
  } catch {
    // Не получилось сохранить — не страшно, просто после перезагрузки придётся войти снова
  }
}
