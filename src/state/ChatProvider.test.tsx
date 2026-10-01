import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Credentials } from '../api/greenApi'
import { useChat } from './chatContext'
import { ChatProvider } from './ChatProvider'
import { loadCredentials, saveCredentials } from './credentialsStorage'

const credentials: Credentials = {
  apiUrl: 'https://7107.api.greenapi.com',
  idInstance: '7107000001',
  apiTokenInstance: 'test-token',
}

afterEach(() => {
  sessionStorage.clear()
})

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

  it('useChat вне провайдера сообщает понятную ошибку', () => {
    expect(() => renderHook(() => useChat())).toThrow(
      'useChat можно вызывать только внутри <ChatProvider>',
    )
  })
})
