import { LoginScreen } from './components/LoginScreen/LoginScreen'
import { MessengerScreen } from './components/MessengerScreen/MessengerScreen'
import { useChat } from './state/chatContext'

function App() {
  const { state } = useChat()
  return state.credentials ? <MessengerScreen /> : <LoginScreen />
}

export default App
