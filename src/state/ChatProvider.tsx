import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { ChatContext } from './chatContext'
import { chatReducer, createInitialState } from './chatReducer'
import { clearChats, loadChats, saveChats } from './chatsStorage'
import { loadCredentials, saveCredentials } from './credentialsStorage'

function init(): ReturnType<typeof createInitialState> {
  // Если вкладку просто перезагрузили — сразу пускаем в чат с сохранёнными данными и списком чатов
  const credentials = loadCredentials()
  return createInitialState(credentials, credentials ? loadChats(credentials.idInstance) : [])
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, null, init)
  const idInstance = state.credentials?.idInstance
  // Запоминаем, с каким инстансом были, чтобы при выходе стереть именно его список чатов
  const lastIdInstance = useRef(idInstance)

  useEffect(() => {
    saveCredentials(state.credentials)
  }, [state.credentials])

  useEffect(() => {
    if (idInstance) {
      lastIdInstance.current = idInstance
    } else if (lastIdInstance.current) {
      clearChats(lastIdInstance.current)
      lastIdInstance.current = undefined
    }
  }, [idInstance])

  useEffect(() => {
    if (idInstance) saveChats(idInstance, state.chats)
  }, [idInstance, state.chats])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <ChatContext value={value}>{children}</ChatContext>
}
