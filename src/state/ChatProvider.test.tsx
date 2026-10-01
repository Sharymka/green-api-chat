import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Credentials } from '../api/greenApi'
import { useChat } from './chatContext'
import { ChatProvider } from './ChatProvider'
import { loadChats, saveChats } from './chatsStorage'
import { loadCredentials, saveCredentials } from './credentialsStorage'

const credentials: Credentials = {
  apiUrl: 'https://7107.api.greenapi.com',
  idInstance: '7107000001',
  apiTokenInstance: 'test-token',
}

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

const IVAN = '79001234567@c.us'

describe('credentialsStorage', () => {
  it('сохраняет и читает данные входа', () => {
    saveCredentials(credentials)
    expect(loadCredentials()).toEqual(credentials)
  })

  it('удаляет данные при выходе', () => {
    saveCredentials(credentials)
    saveCredentials(null)
    expect(loadCredentials()).toBeNull()
  })

  it('не падает на испорченных данных в хранилище', () => {
    sessionStorage.setItem('green-api-chat:credentials', '{битый json')
    expect(loadCredentials()).toBeNull()

    sessionStorage.setItem('green-api-chat:credentials', JSON.stringify({ apiUrl: 1 }))
    expect(loadCredentials()).toBeNull()
  })
})

describe('chatsStorage', () => {
  it('хранит отдельный список чатов для каждого инстанса', () => {
    saveChats('111', [{ chatId: IVAN, name: 'Иван' }])
    expect(loadChats('111')).toEqual([{ chatId: IVAN, name: 'Иван' }])
    expect(loadChats('222')).toEqual([])
  })

  it('не падает на испорченных данных и пропускает неверные записи', () => {
    localStorage.setItem('green-api-chat:chats:111', '{битый json')
    expect(loadChats('111')).toEqual([])

    localStorage.setItem(
      'green-api-chat:chats:111',
      JSON.stringify([{ chatId: IVAN }, { chatId: 5 }, null, 'строка']),
    )
    expect(loadChats('111')).toEqual([{ chatId: IVAN, name: undefined }])
  })
})

describe('ChatProvider', () => {
  const renderChat = () => renderHook(() => useChat(), { wrapper: ChatProvider })

  it('после перезагрузки страницы восстанавливает вход из sessionStorage', () => {
    saveCredentials(credentials)
    const { result } = renderChat()
    expect(result.current.state.credentials).toEqual(credentials)
  })

  it('сохраняет данные при входе и стирает при выходе', () => {
    const { result } = renderChat()
    expect(result.current.state.credentials).toBeNull()

    act(() => result.current.dispatch({ type: 'loggedIn', credentials }))
    expect(loadCredentials()).toEqual(credentials)

    act(() => result.current.dispatch({ type: 'loggedOut' }))
    expect(loadCredentials()).toBeNull()
    expect(result.current.state.credentials).toBeNull()
  })

  it('после перезагрузки восстанавливает список чатов этого инстанса', () => {
    saveCredentials(credentials)
    saveChats(credentials.idInstance, [{ chatId: IVAN, name: 'Иван' }])

    const { result } = renderChat()
    expect(result.current.state.chats.map((c) => c.chatId)).toEqual([IVAN])
  })

  it('сохраняет новые чаты и стирает список при выходе', () => {
    const { result } = renderChat()
    act(() => result.current.dispatch({ type: 'loggedIn', credentials }))
    act(() => result.current.dispatch({ type: 'chatOpened', chatId: IVAN }))
    expect(loadChats(credentials.idInstance)).toEqual([{ chatId: IVAN }])

    act(() => result.current.dispatch({ type: 'loggedOut' }))
    expect(loadChats(credentials.idInstance)).toEqual([])
  })

  it('useChat вне провайдера сообщает понятную ошибку', () => {
    expect(() => renderHook(() => useChat())).toThrow(
      'useChat можно вызывать только внутри <ChatProvider>',
    )
  })
})
