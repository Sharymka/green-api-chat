/**
 * Подмена для receiveNotification: «сервер молчит», пока запрос не отменят.
 * Так фоновый цикл получения в тестах не крутится впустую и корректно останавливается при выходе.
 */
export function silentReceive(
  _credentials: unknown,
  _timeout?: number,
  signal?: AbortSignal,
): Promise<null> {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })
}
