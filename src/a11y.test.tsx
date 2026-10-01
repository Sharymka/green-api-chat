import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getChatHistory } from './api/greenApi'
import App from './App'
import { ChatProvider } from './state/ChatProvider'
import { saveChats } from './state/chatsStorage'
import { saveCredentials } from './state/credentialsStorage'

vi.mock('./api/greenApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/greenApi')>()
  return {
    ...actual,
    receiveNotification: (await import('./test/api')).silentReceive,
    getChatHistory: vi.fn<typeof actual.getChatHistory>(),
  }
})

/**
 * Автоматическая проверка доступности (axe — тот же движок, что в Lighthouse и devtools).
 * Контраст цветов тут не проверить: jsdom не считает стили, его проверяем руками в браузере.
 */
async function expectNoA11yViolations() {
  const result = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false } },
  })
  const problems = result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  )
  expect(problems).toEqual([])
}

const credentials = {
  idInstance: '7107000001',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://7107.api.greenapi.com',
}

function renderApp() {
  render(
    <ChatProvider>
      <App />
    </ChatProvider>,
  )
  return userEvent.setup()
}

beforeEach(() => {
  vi.mocked(getChatHistory).mockResolvedValue([
    {
      type: 'incoming',
      idMessage: 'IN-1',
      timestamp: 1_700_000_000,
      typeMessage: 'textMessage',
      textMessage: 'Привет',
    },
  ])
})

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe('доступность', () => {
  it('экран входа (в том числе с ошибками полей)', async () => {
    const user = renderApp()
    await expectNoA11yViolations()

    await user.click(screen.getByRole('button', { name: 'Войти' }))
    await expectNoA11yViolations()
  })

  it('мессенджер с открытым чатом', async () => {
    saveCredentials(credentials)
    saveChats(credentials.idInstance, [{ chatId: '79001234567@c.us', name: 'Иван' }])
    const user = renderApp()

    await user.click(screen.getByRole('button', { name: /Иван/ }))
    await within(screen.getByRole('log')).findByText('Привет')
    await expectNoA11yViolations()
  })

  it('окно нового чата', async () => {
    saveCredentials(credentials)
    const user = renderApp()

    await user.click(screen.getByRole('button', { name: 'Новый чат' }))
    await expectNoA11yViolations()
  })
})
