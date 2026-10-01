/**
 * Пауза перед следующей попыткой. Заканчивается раньше, если:
 * - нас попросили остановиться (signal) — например, человек вышел из аккаунта;
 * - вернулся интернет (событие online) — тогда незачем ждать до конца.
 */
export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      window.removeEventListener('online', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done)
    window.addEventListener('online', done)
  })
}

const FIRST_DELAY_MS = 1000
const MAX_DELAY_MS = 30_000

/** Пауза растёт после каждой неудачи: 1 → 2 → 4 → … секунд, но не больше 30. */
export function nextDelay(previous: number | null): number {
  return previous === null ? FIRST_DELAY_MS : Math.min(previous * 2, MAX_DELAY_MS)
}
