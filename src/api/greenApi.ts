import { ApiError, errorKindFromStatus } from './errors'

export interface Credentials {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export type InstanceState =
  'authorized' | 'notAuthorized' | 'blocked' | 'starting' | 'yellowCard' | (string & {})

export interface Notification {
  receiptId: number
  /** Уведомление как есть. Разбираем его отдельно, потому что у разных типов разная структура. */
  body: unknown
}

const DEFAULT_TIMEOUT_MS = 15_000

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  /** Что дописать в адрес после токена, например receiptId. */
  pathSuffix?: string
  query?: Record<string, string>
  body?: unknown
  timeoutMs?: number
  signal?: AbortSignal
}

async function request<T>(
  credentials: Credentials,
  apiMethod: string,
  options: RequestOptions = {},
): Promise<T | null> {
  const {
    method = 'GET',
    pathSuffix,
    query,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = options

  const base = credentials.apiUrl.replace(/\/+$/, '')
  const id = encodeURIComponent(credentials.idInstance)
  const token = encodeURIComponent(credentials.apiTokenInstance)
  let url = `${base}/waInstance${id}/${apiMethod}/${token}`
  if (pathSuffix) url += `/${encodeURIComponent(pathSuffix)}`
  if (query) url += `?${new URLSearchParams(query).toString()}`

  // Обрываем запрос в двух случаях: сервер слишком долго молчит или нас попросили отменить (например, при выходе).
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const abortFromCaller = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abortFromCaller)

  try {
    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      if (timedOut) throw new ApiError('timeout')
      if (signal?.aborted) throw new ApiError('aborted')
      throw new ApiError('network')
    }

    if (!response.ok) throw new ApiError(errorKindFromStatus(response.status), response.status)

    // Если новых уведомлений нет, receiveNotification отвечает пустотой или `null`
    const text = await response.text()
    if (!text) return null
    try {
      return JSON.parse(text) as T | null
    } catch {
      throw new ApiError('server', response.status)
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

export async function getStateInstance(
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<InstanceState> {
  const data = await request<{ stateInstance: InstanceState }>(credentials, 'getStateInstance', {
    signal,
  })
  if (!data?.stateInstance) throw new ApiError('server')
  return data.stateInstance
}

export async function sendMessage(
  credentials: Credentials,
  chatId: string,
  message: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await request<{ idMessage: string }>(credentials, 'sendMessage', {
    method: 'POST',
    body: { chatId, message },
    signal,
  })
  if (!data?.idMessage) throw new ApiError('server')
  return data.idMessage
}

/**
 * Спрашиваем, нет ли новых уведомлений. Сервер не отвечает сразу, а ждёт до `receiveTimeoutSec` секунд:
 * если за это время что-то пришло — отдаёт уведомление, если нет — `null`.
 */
export async function receiveNotification(
  credentials: Credentials,
  receiveTimeoutSec = 20,
  signal?: AbortSignal,
): Promise<Notification | null> {
  return request<Notification>(credentials, 'receiveNotification', {
    query: { receiveTimeout: String(receiveTimeoutSec) },
    timeoutMs: (receiveTimeoutSec + 10) * 1000,
    signal,
  })
}

export async function deleteNotification(
  credentials: Credentials,
  receiptId: number,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await request<{ result: boolean }>(credentials, 'deleteNotification', {
    method: 'DELETE',
    pathSuffix: String(receiptId),
    signal,
  })
  return data?.result ?? false
}

/**
 * Последние сообщения переписки с одним собеседником (новые — первыми).
 * Записи отдаём как есть: разбираем их отдельно, в utils/history.ts.
 */
export async function getChatHistory(
  credentials: Credentials,
  chatId: string,
  count = 50,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const data = await request<unknown>(credentials, 'getChatHistory', {
    method: 'POST',
    body: { chatId, count },
    signal,
  })
  if (!Array.isArray(data)) throw new ApiError('server')
  return data
}

/** Настройки инстанса, которые важны для работы чата. Остальные поля нам не нужны. */
export interface InstanceSettings {
  /** Адрес webhook. Если он заполнен, уведомления уходят туда, а не в очередь HTTP API. */
  webhookUrl?: string
  /** Уведомления о входящих сообщениях: без них ответы не появятся в реальном времени. */
  incomingWebhook?: 'yes' | 'no'
  /** Уведомления о статусах наших сообщений: доставлено, прочитано. */
  outgoingWebhook?: 'yes' | 'no'
}

export async function getSettings(
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<InstanceSettings> {
  const data = await request<InstanceSettings>(credentials, 'getSettings', { signal })
  if (!data) throw new ApiError('server')
  return data
}

/** Меняет только переданные настройки инстанса. GREEN-API применяет их в течение пары минут. */
export async function setSettings(
  credentials: Credentials,
  settings: InstanceSettings,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await request<{ saveSettings: boolean }>(credentials, 'setSettings', {
    method: 'POST',
    body: settings,
    signal,
  })
  return data?.saveSettings ?? false
}

/**
 * Журналы последних входящих и исходящих сообщений аккаунта за `minutes` минут.
 * Из них собираем список недавних чатов, чтобы он был одинаковым на любом устройстве.
 */
export async function lastIncomingMessages(
  credentials: Credentials,
  minutes: number,
  signal?: AbortSignal,
): Promise<unknown[]> {
  return journal(credentials, 'lastIncomingMessages', minutes, signal)
}

export async function lastOutgoingMessages(
  credentials: Credentials,
  minutes: number,
  signal?: AbortSignal,
): Promise<unknown[]> {
  return journal(credentials, 'lastOutgoingMessages', minutes, signal)
}

async function journal(
  credentials: Credentials,
  apiMethod: string,
  minutes: number,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const data = await request<unknown>(credentials, apiMethod, {
    query: { minutes: String(minutes) },
    signal,
  })
  if (!Array.isArray(data)) throw new ApiError('server')
  return data
}
