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
  /** Raw notification body; parsed separately because its shape depends on the type. */
  body: unknown
}

const DEFAULT_TIMEOUT_MS = 15_000

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  /** Extra path segment after the token, e.g. receiptId. */
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

  // One controller aborts the request either on timeout or when the caller cancels.
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

    // receiveNotification answers with an empty body or `null` when the queue is empty
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
 * Long polling: the server holds the request for up to `receiveTimeoutSec`
 * and returns `null` if no notification arrived.
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
