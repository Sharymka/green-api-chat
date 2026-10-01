import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { silentReceive } from '../../test/api'
import { ApiError } from '../../api/errors'
import { getChatHistory, sendMessage } from '../../api/greenApi'
import { ChatProvider } from '../../state/ChatProvider'
import { saveChats } from '../../state/chatsStorage'
import { loadCredentials, saveCredentials } from '../../state/credentialsStorage'
import { MessengerScreen } from '../MessengerScreen/MessengerScreen'

vi.mock('../../api/greenApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/greenApi')>()
  return {
    ...actual,
    receiveNotification: silentReceive,
    sendMessage: vi.fn<typeof actual.sendMessage>(),
    getChatHistory: vi.fn<typeof actual.getChatHistory>(),
  }
})
const sendMock = vi.mocked(sendMessage)
const historyMock = vi.mocked(getChatHistory)

const credentials = {
  idInstance: '7107000001',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://7107.api.greenapi.com',
}
const IVAN = '79001234567@c.us'

/** Открывает мессенджер с одним чатом и сразу заходит в него. */
async function openChat() {
  saveCredentials(credentials)
  saveChats(credentials.idInstance, [{ chatId: IVAN, name: 'Иван' }])
  render(
    <ChatProvider>
      <MessengerScreen />
    </ChatProvider>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Иван/ }))
  return user
}

const log = () => screen.getByRole('log', { name: 'Переписка' })
const input = () => screen.getByLabelText('Сообщение')

beforeEach(() => {
  sendMock.mockReset()
  historyMock.mockReset()
  historyMock.mockResolvedValue([])
})

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe('отправка', () => {
  it('по Enter отправляет сообщение и ставит галочку после ответа сервера', async () => {
    let resolveSend: (id: string) => void = () => {}
    sendMock.mockReturnValue(new Promise((resolve) => (resolveSend = resolve)))
    const user = await openChat()

    await user.type(input(), '  Привет!  {Enter}')

    // Сообщение сразу в ленте, пробелы по краям убраны, поле очищено
    expect(within(log()).getByText('Привет!')).toBeInTheDocument()
    expect(within(log()).getByText('отправляется')).toBeInTheDocument()
    expect(input()).toHaveValue('')
    expect(sendMock).toHaveBeenCalledWith(credentials, IVAN, 'Привет!')

    resolveSend('OUT-1')
    expect(await within(log()).findByText('отправлено')).toBeInTheDocument()
  })

  it('Shift+Enter переносит строку, а не отправляет', async () => {
    const user = await openChat()

    await user.type(input(), 'строка 1{Shift>}{Enter}{/Shift}строка 2')

    expect(input()).toHaveValue('строка 1\nстрока 2')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('не отправляет пустое сообщение: кнопка неактивна', async () => {
    const user = await openChat()
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()

    await user.type(input(), '   {Enter}')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('при ошибке показывает «Повторить» и отправляет заново по клику', async () => {
    sendMock.mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce('OUT-1')
    const user = await openChat()

    await user.type(input(), 'Привет{Enter}')
    const retry = await within(log()).findByRole('button', { name: 'Повторить' })
    expect(within(log()).getByText('не отправлено.')).toBeInTheDocument()

    await user.click(retry)

    expect(await within(log()).findByText('отправлено')).toBeInTheDocument()
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(within(log()).getAllByText('Привет')).toHaveLength(1)
  })

  it('если токен больше не подходит — выходит из аккаунта', async () => {
    sendMock.mockRejectedValue(new ApiError('unauthorized', 401))
    const user = await openChat()

    await user.type(input(), 'Привет{Enter}')

    await waitFor(() => expect(loadCredentials()).toBeNull())
  })
})

describe('история', () => {
  const historyItems = [
    {
      type: 'outgoing',
      idMessage: 'OUT-OLD',
      timestamp: 1_700_000_100,
      typeMessage: 'textMessage',
      chatId: IVAN,
      textMessage: 'Как дела?',
    },
    {
      type: 'incoming',
      idMessage: 'IN-OLD',
      timestamp: 1_700_000_000,
      typeMessage: 'textMessage',
      chatId: IVAN,
      textMessage: 'Привет',
      senderName: 'Иван',
    },
  ]

  it('пока грузится — показывает скелетон, потом сообщения по порядку', async () => {
    let resolveHistory: (items: unknown[]) => void = () => {}
    historyMock.mockReturnValue(new Promise((resolve) => (resolveHistory = resolve)))
    await openChat()

    expect(log()).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Сообщений пока нет')).not.toBeInTheDocument()

    resolveHistory(historyItems)

    const texts = await within(log()).findAllByText(/Привет|Как дела\?/)
    expect(texts.map((el) => el.textContent)).toEqual(['Привет', 'Как дела?'])
    expect(log()).not.toHaveAttribute('aria-busy')
    expect(historyMock).toHaveBeenCalledWith(credentials, IVAN, 50)
  })

  it('загружает историю один раз, а не при каждом открытии чата', async () => {
    const user = await openChat()
    await screen.findByText('Сообщений пока нет')

    await user.click(screen.getByRole('button', { name: /Иван/ }))
    expect(historyMock).toHaveBeenCalledTimes(1)
  })

  it('при ошибке загрузки предлагает повторить', async () => {
    historyMock
      .mockRejectedValueOnce(new ApiError('server', 500))
      .mockResolvedValueOnce(historyItems)
    const user = await openChat()

    expect(await screen.findByText('Не удалось загрузить историю переписки')).toBeInTheDocument()
    await user.click(within(log()).getByRole('button', { name: 'Повторить' }))

    expect(await within(log()).findByText('Как дела?')).toBeInTheDocument()
    expect(screen.queryByText('Не удалось загрузить историю переписки')).not.toBeInTheDocument()
  })
})
