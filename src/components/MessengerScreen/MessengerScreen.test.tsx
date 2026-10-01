import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { useChat } from '../../state/chatContext'
import { ChatProvider } from '../../state/ChatProvider'
import { saveChats } from '../../state/chatsStorage'
import { saveCredentials } from '../../state/credentialsStorage'
import { MessengerScreen } from './MessengerScreen'

const credentials = {
  idInstance: '7107000001',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://7107.api.greenapi.com',
}
const IVAN = '79001234567@c.us'
const MARIA = '79007654321@c.us'

// Даёт тесту доступ к dispatch, чтобы имитировать входящие сообщения
let dispatchRef: ReturnType<typeof useChat>['dispatch'] | undefined
function DispatchGrabber() {
  const { dispatch } = useChat()
  useEffect(() => {
    dispatchRef = dispatch
  }, [dispatch])
  return null
}

function renderMessenger(chats: { chatId: string; name?: string }[] = []) {
  saveCredentials(credentials)
  saveChats(credentials.idInstance, chats)
  render(
    <ChatProvider>
      <DispatchGrabber />
      <MessengerScreen />
    </ChatProvider>,
  )
  return userEvent.setup()
}

const chatList = () => screen.getByRole('complementary', { name: 'Чаты' })

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  dispatchRef = undefined
})

describe('список чатов', () => {
  it('без чатов подсказывает, как начать', () => {
    renderMessenger()
    expect(screen.getByText(/Чатов пока нет/)).toBeInTheDocument()
    expect(screen.getByText(/Выберите чат слева/)).toBeInTheDocument()
  })

  it('показывает сохранённые чаты: имя или номер телефона', () => {
    renderMessenger([{ chatId: IVAN, name: 'Иван' }, { chatId: MARIA }])
    const list = within(chatList())
    expect(list.getByText('Иван')).toBeInTheDocument()
    expect(list.getByText('+7 900 765-43-21')).toBeInTheDocument()
  })

  it('открывает чат по клику и отмечает его в списке', async () => {
    const user = renderMessenger([{ chatId: IVAN, name: 'Иван' }])

    await user.click(within(chatList()).getByRole('button', { name: /Иван/ }))

    expect(screen.getByRole('heading', { level: 2, name: 'Иван' })).toBeInTheDocument()
    expect(within(chatList()).getByRole('button', { name: /Иван/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('показывает последнее сообщение и счётчик непрочитанных', () => {
    renderMessenger([{ chatId: IVAN, name: 'Иван' }])

    act(() =>
      dispatchRef?.({
        type: 'messageReceived',
        message: { idMessage: 'IN-1', chatId: IVAN, text: 'Привет!', timestamp: 1_700_000_000 },
      }),
    )

    const item = within(chatList()).getByRole('button', { name: /Иван/ })
    expect(item).toHaveTextContent('Привет!')
    expect(item).toHaveTextContent('1 непрочитанных')
  })

  it('в пустом чате подсказывает написать первым', async () => {
    const user = renderMessenger([{ chatId: IVAN, name: 'Иван' }])
    expect(within(chatList()).getByRole('button', { name: /Иван/ })).toHaveTextContent(
      'Нет сообщений',
    )

    await user.click(within(chatList()).getByRole('button', { name: /Иван/ }))

    expect(screen.getByText('Сообщений пока нет')).toBeInTheDocument()
    expect(screen.getByText(/придёт в WhatsApp на номер \+7 900 123-45-67/)).toBeInTheDocument()
  })

  it('кнопка «Назад» закрывает чат (для телефона)', async () => {
    const user = renderMessenger([{ chatId: IVAN, name: 'Иван' }])
    await user.click(within(chatList()).getByRole('button', { name: /Иван/ }))

    await user.click(screen.getByRole('button', { name: 'Назад к списку чатов' }))

    expect(screen.queryByRole('heading', { level: 2, name: 'Иван' })).not.toBeInTheDocument()
  })
})

describe('новый чат', () => {
  it('создаёт чат по номеру, открывает его и закрывает окно', async () => {
    const user = renderMessenger()

    await user.click(screen.getByRole('button', { name: 'Новый чат' }))
    const dialog = screen.getByRole('dialog', { name: 'Новый чат' })
    // Фокус сразу в поле номера
    expect(within(dialog).getByLabelText('Номер телефона')).toHaveFocus()

    await user.type(within(dialog).getByLabelText('Номер телефона'), '8 (900) 123-45-67')
    await user.click(within(dialog).getByRole('button', { name: 'Начать чат' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '+7 900 123-45-67' })).toBeInTheDocument()
    expect(localStorage.getItem('green-api-chat:chats:7107000001')).toContain(IVAN)
  })

  it('не создаёт дубль, а открывает существующий чат', async () => {
    const user = renderMessenger([{ chatId: IVAN, name: 'Иван' }, { chatId: MARIA }])

    await user.click(screen.getByRole('button', { name: 'Новый чат' }))
    await user.type(screen.getByLabelText('Номер телефона'), '+79001234567')
    await user.click(screen.getByRole('button', { name: 'Начать чат' }))

    expect(within(chatList()).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 2, name: 'Иван' })).toBeInTheDocument()
  })

  it('показывает ошибку для неверного номера', async () => {
    const user = renderMessenger()

    await user.click(screen.getByRole('button', { name: 'Новый чат' }))
    await user.click(screen.getByRole('button', { name: 'Начать чат' }))
    expect(screen.getByText('Введите номер')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Номер телефона'), '123')
    await user.click(screen.getByRole('button', { name: 'Начать чат' }))
    expect(screen.getByText('Введите номер целиком, вместе с кодом страны')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('закрывается по Esc и кнопке «Закрыть», возвращая фокус на «Новый чат»', async () => {
    const user = renderMessenger()
    const openButton = screen.getByRole('button', { name: 'Новый чат' })

    await user.click(openButton)
    // В jsdom нет нативной обработки Esc у <dialog>, поэтому присылаем событие cancel сами
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(openButton).toHaveFocus()

    await user.click(openButton)
    await user.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
