import { createContext, useContext, type Dispatch } from 'react'
import type { ChatAction, ChatState } from './chatReducer'

export interface ChatContextValue {
  state: ChatState
  dispatch: Dispatch<ChatAction>
}

export const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext)
  if (!value) throw new Error('useChat можно вызывать только внутри <ChatProvider>')
  return value
}
