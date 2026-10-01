import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getErrorMessage, isRetryable } from './errors'
import {
  deleteNotification,
  getStateInstance,
  receiveNotification,
  sendMessage,
  type Credentials,
} from './greenApi'

const credentials: Credentials = {
  apiUrl: 'https://7107.api.greenapi.com/',
  idInstance: '7107000001',
  apiTokenInstance: 'test-token',
}

const fetchMock = vi.fn<typeof fetch>()

function respond(status: number, body = '') {
  fetchMock.mockResolvedValueOnce(new Response(body || null, { status }))
}

/** Имитирует «зависший» запрос: ответа нет, пока запрос не оборвут. */
function hang() {
  fetchMock.mockImplementationOnce(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        )
      }),
  )
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('Expected promise to reject')
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('getStateInstance', () => {
  it('builds the URL from credentials and returns the state', async () => {
    respond(200, JSON.stringify({ stateInstance: 'authorized' }))

    await expect(getStateInstance(credentials)).resolves.toBe('authorized')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://7107.api.greenapi.com/waInstance7107000001/getStateInstance/test-token',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [400, 'badRequest'],
    [429, 'rateLimit'],
    [466, 'quotaExceeded'],
    [502, 'server'],
  ])('maps HTTP %i to "%s"', async (status, kind) => {
    respond(status)

    const error = await catchError(getStateInstance(credentials))
    expect(error.kind).toBe(kind)
    expect(error.status).toBe(status)
  })

  it('reports a network error when fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    expect((await catchError(getStateInstance(credentials))).kind).toBe('network')
  })

  it('reports a timeout when the server does not answer in time', async () => {
    vi.useFakeTimers()
    hang()

    const result = catchError(getStateInstance(credentials))
    await vi.advanceTimersByTimeAsync(15_000)
    expect((await result).kind).toBe('timeout')
  })

  it('reports "aborted" when the caller cancels the request', async () => {
    hang()
    const controller = new AbortController()

    const result = catchError(getStateInstance(credentials, controller.signal))
    controller.abort()
    expect((await result).kind).toBe('aborted')
  })
})

describe('sendMessage', () => {
  it('posts chatId and message as JSON and returns idMessage', async () => {
    respond(200, JSON.stringify({ idMessage: '3EB0C767D097B7C7C030' }))

    await expect(sendMessage(credentials, '79001234567@c.us', 'Привет')).resolves.toBe(
      '3EB0C767D097B7C7C030',
    )
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://7107.api.greenapi.com/waInstance7107000001/sendMessage/test-token')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      chatId: '79001234567@c.us',
      message: 'Привет',
    })
  })

  it('fails when the response has no idMessage', async () => {
    respond(200, '{}')

    expect((await catchError(sendMessage(credentials, '79001234567@c.us', 'Hi'))).kind).toBe(
      'server',
    )
  })
})

describe('receiveNotification', () => {
  it('passes receiveTimeout and returns the notification', async () => {
    const notification = { receiptId: 15, body: { typeWebhook: 'incomingMessageReceived' } }
    respond(200, JSON.stringify(notification))

    await expect(receiveNotification(credentials, 20)).resolves.toEqual(notification)
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://7107.api.greenapi.com/waInstance7107000001/receiveNotification/test-token?receiveTimeout=20',
    )
  })

  it.each([
    ['an empty body', ''],
    ['null', 'null'],
  ])('returns null when the queue is empty (%s)', async (_name, body) => {
    respond(200, body)

    await expect(receiveNotification(credentials)).resolves.toBeNull()
  })

  it('waits longer than receiveTimeout before timing out', async () => {
    vi.useFakeTimers()
    hang()

    const result = catchError(receiveNotification(credentials, 20))
    await vi.advanceTimersByTimeAsync(25_000)
    expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(5_000)
    expect((await result).kind).toBe('timeout')
  })
})

describe('deleteNotification', () => {
  it('sends DELETE with receiptId in the path', async () => {
    respond(200, JSON.stringify({ result: true }))

    await expect(deleteNotification(credentials, 15)).resolves.toBe(true)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(
      'https://7107.api.greenapi.com/waInstance7107000001/deleteNotification/test-token/15',
    )
    expect(init?.method).toBe('DELETE')
  })
})

describe('errors helpers', () => {
  it('marks only temporary failures as retryable', () => {
    expect(isRetryable(new ApiError('network'))).toBe(true)
    expect(isRetryable(new ApiError('server', 500))).toBe(true)
    expect(isRetryable(new ApiError('unauthorized', 401))).toBe(false)
    expect(isRetryable(new Error('other'))).toBe(false)
  })

  it('returns a user-facing message', () => {
    expect(getErrorMessage(new ApiError('unauthorized', 401))).toBe(
      'Неверный idInstance или apiTokenInstance',
    )
    expect(getErrorMessage(new Error('boom'))).toBe('Что-то пошло не так')
  })
})
