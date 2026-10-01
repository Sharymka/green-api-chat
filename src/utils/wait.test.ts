import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextDelay, wait } from './wait'

afterEach(() => {
  vi.useRealTimers()
})

describe('nextDelay', () => {
  it('удваивает паузу после каждой неудачи, но не больше 30 секунд', () => {
    const delays: number[] = []
    let delay: number | null = null
    for (let i = 0; i < 7; i++) {
      delay = nextDelay(delay)
      delays.push(delay)
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000])
  })
})

describe('wait', () => {
  it('заканчивается по истечении времени', async () => {
    vi.useFakeTimers()
    const done = vi.fn<() => void>()
    void wait(1000, new AbortController().signal).then(done)

    await vi.advanceTimersByTimeAsync(999)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toHaveBeenCalled()
  })

  it('заканчивается сразу, если цикл остановили', async () => {
    const controller = new AbortController()
    const promise = wait(60_000, controller.signal)
    controller.abort()
    await expect(promise).resolves.toBeUndefined()
  })

  it('заканчивается сразу, когда вернулся интернет', async () => {
    const promise = wait(60_000, new AbortController().signal)
    window.dispatchEvent(new Event('online'))
    await expect(promise).resolves.toBeUndefined()
  })
})
