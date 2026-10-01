import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api/errors'
import { getStateInstance } from './api/greenApi'
import App from './App'
import { ChatProvider } from './state/ChatProvider'
import { saveChats } from './state/chatsStorage'
import { loadCredentials, saveCredentials } from './state/credentialsStorage'

// Настоящие запросы в тестах не отправляем: подменяем только проверку инстанса
vi.mock('./api/greenApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/greenApi')>()
  return { ...actual, getStateInstance: vi.fn<typeof actual.getStateInstance>() }
})
const getStateInstanceMock = vi.mocked(getStateInstance)

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

async function fillForm(user: ReturnType<typeof userEvent.setup>, values = credentials) {
  if (values.idInstance) await user.type(screen.getByLabelText('idInstance'), values.idInstance)
  if (values.apiTokenInstance) {
    await user.type(screen.getByLabelText('apiTokenInstance'), values.apiTokenInstance)
  }
  if (values.apiUrl) await user.type(screen.getByLabelText('apiUrl'), values.apiUrl)
}

const submit = () => screen.getByRole('button', { name: 'Войти' })

beforeEach(() => {
  getStateInstanceMock.mockReset()
})

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe('экран входа', () => {
  it('пускает в мессенджер, если инстанс авторизован', async () => {
    getStateInstanceMock.mockResolvedValue('authorized')
    const user = renderApp()

    await fillForm(user, { ...credentials, apiUrl: 'https://7107.api.greenapi.com/' })
    await user.click(submit())

    expect(await screen.findByRole('button', { name: 'Выйти' })).toBeInTheDocument()
    // Слэш в конце адреса убран перед запросом
    expect(getStateInstanceMock).toHaveBeenCalledWith(credentials, expect.any(AbortSignal))
    expect(loadCredentials()).toEqual(credentials)
  })

  it('восстанавливает сохранённые чаты этого инстанса после входа', async () => {
    getStateInstanceMock.mockResolvedValue('authorized')
    saveChats(credentials.idInstance, [{ chatId: '79001234567@c.us' }])
    const user = renderApp()

    await fillForm(user)
    await user.click(submit())

    await screen.findByRole('button', { name: 'Выйти' })
    expect(localStorage.getItem('green-api-chat:chats:7107000001')).toContain('79001234567')
  })

  it('показывает ошибки под полями и не отправляет запрос', async () => {
    const user = renderApp()

    await user.type(screen.getByLabelText('idInstance'), '71a')
    await user.type(screen.getByLabelText('apiUrl'), 'https://evil.example.com')
    await user.click(submit())

    expect(screen.getByText('idInstance состоит только из цифр')).toBeInTheDocument()
    expect(screen.getByText('Укажите apiTokenInstance')).toBeInTheDocument()
    expect(
      screen.getByText('Разрешены только адреса GREEN-API (*.api.greenapi.com)'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('idInstance')).toHaveAttribute('aria-invalid', 'true')
    // Фокус переходит на первое поле с ошибкой
    expect(screen.getByLabelText('idInstance')).toHaveFocus()
    expect(getStateInstanceMock).not.toHaveBeenCalled()
  })

  it('убирает ошибку поля, когда его начинают исправлять', async () => {
    const user = renderApp()
    await user.click(submit())
    expect(screen.getByText('Укажите idInstance')).toBeInTheDocument()

    await user.type(screen.getByLabelText('idInstance'), '7')
    expect(screen.queryByText('Укажите idInstance')).not.toBeInTheDocument()
  })

  it('сообщает о неверном токене', async () => {
    getStateInstanceMock.mockRejectedValue(new ApiError('unauthorized', 401))
    const user = renderApp()

    await fillForm(user)
    await user.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Неверный idInstance или apiTokenInstance',
    )
    expect(submit()).toBeEnabled()
  })

  it('не пускает, если инстанс не авторизован', async () => {
    getStateInstanceMock.mockResolvedValue('notAuthorized')
    const user = renderApp()

    await fillForm(user)
    await user.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent('отсканируйте QR-код')
    expect(screen.queryByRole('button', { name: 'Выйти' })).not.toBeInTheDocument()
  })

  it('пока идёт проверка, блокирует кнопку и показывает «Проверяем…»', async () => {
    getStateInstanceMock.mockReturnValue(new Promise(() => {}))
    const user = renderApp()

    await fillForm(user)
    await user.click(submit())

    expect(screen.getByRole('button', { name: 'Проверяем…' })).toBeDisabled()
  })

  it('показывает и скрывает токен', async () => {
    const user = renderApp()
    const token = screen.getByLabelText('apiTokenInstance')
    expect(token).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Показать токен' }))
    expect(token).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Скрыть токен' }))
    expect(token).toHaveAttribute('type', 'password')
  })
})

describe('выход', () => {
  it('возвращает на экран входа и стирает данные', async () => {
    saveCredentials(credentials)
    const user = renderApp()

    await user.click(screen.getByRole('button', { name: 'Выйти' }))

    expect(screen.getByRole('heading', { name: 'Вход в GREEN-API Chat' })).toBeInTheDocument()
    expect(loadCredentials()).toBeNull()
  })
})
