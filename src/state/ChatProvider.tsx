import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { ChatContext } from './chatContext'
import { chatReducer, createInitialState } from './chatReducer'
import { loadCredentials, saveCredentials } from './credentialsStorage'

export function ChatProvider({ children }: { children: ReactNode }) {
  // Если вкладку просто перезагрузили — сразу пускаем в чат с сохранёнными данными
  const [state, dispatch] = useReducer(chatReducer, null, () =>
    createInitialState(loadCredentials()),
  )

  useEffect(() => {
    saveCredentials(state.credentials)
  }, [state.credentials])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <ChatContext value={value}>{children}</ChatContext>
}
