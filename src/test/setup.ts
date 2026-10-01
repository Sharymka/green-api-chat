import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// jsdom (браузер для тестов) пока не умеет открывать <dialog> как модальное окно.
// Достаточно простой замены: открыть = поставить атрибут open, закрыть = убрать.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

// Тесты никогда не ходят в настоящую сеть: если какой-то запрос забыли подменить, тест упадёт с понятной ошибкой
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.reject(new Error('В тестах нельзя делать настоящие запросы — подмените API')),
    ),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
