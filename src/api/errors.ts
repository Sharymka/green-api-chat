export type ApiErrorKind =
  | 'unauthorized'
  | 'badRequest'
  | 'quotaExceeded'
  | 'rateLimit'
  | 'server'
  | 'network'
  | 'timeout'
  | 'aborted'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor(kind: ApiErrorKind, status?: number) {
    super(
      status
        ? `GREEN-API request failed: ${kind} (HTTP ${status})`
        : `GREEN-API request failed: ${kind}`,
    )
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

export function errorKindFromStatus(status: number): ApiErrorKind {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rateLimit'
  // 466 GREEN-API присылает, когда закончился лимит тарифа
  if (status === 466) return 'quotaExceeded'
  if (status >= 500) return 'server'
  return 'badRequest'
}

/** Временные сбои: через какое-то время запрос может пройти, поэтому его есть смысл повторить. */
export function isRetryable(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === 'network' ||
      error.kind === 'timeout' ||
      error.kind === 'rateLimit' ||
      error.kind === 'server')
  )
}

const MESSAGES: Record<ApiErrorKind, string> = {
  unauthorized: 'Неверный ID инстанса или API-токен',
  badRequest: 'Запрос отклонён сервисом. Проверьте введённые данные',
  quotaExceeded: 'Превышен лимит тарифа GREEN-API',
  rateLimit: 'Слишком много запросов, попробуйте чуть позже',
  server: 'Сервис GREEN-API временно недоступен',
  network: 'Нет соединения с интернетом',
  timeout: 'Сервис долго не отвечает, попробуйте ещё раз',
  aborted: 'Запрос отменён',
}

export function getErrorMessage(error: unknown): string {
  return error instanceof ApiError ? MESSAGES[error.kind] : 'Что-то пошло не так'
}
