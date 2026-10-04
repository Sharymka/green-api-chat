import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { ChatContext } from './chatContext'
import { chatReducer, createInitialState } from './chatReducer'
import { clearChats, loadChats, saveChats } from './chatsStorage'
import {
  loadActiveChatId,
  loadCredentials,
  saveActiveChatId,
  saveCredentials,
} from './credentialsStorage'

function init(): ReturnType<typeof createInitialState> {
  // Если вкладку просто перезагрузили — сразу пускаем в чат с сохранёнными данными и списком чатов
  const credentials = loadCredentials()
  const state = createInitialState(
    credentials,
    credentials ? loadChats(credentials.idInstance) : [],
  )
  // И возвращаемся в чат, который был открыт до перезагрузки (если он ещё есть в списке)
  const activeChatId = loadActiveChatId()
  const exists = state.chats.some((chat) => chat.chatId === activeChatId)
  return exists ? { ...state, activeChatId } : state
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

  useEffect(() => {
    saveActiveChatId(state.activeChatId)
  }, [state.activeChatId])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <ChatContext value={value}>{children}</ChatContext>
}
