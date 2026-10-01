import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getErrorMessage } from '../../api/errors'
import { getStateInstance, type Credentials, type InstanceState } from '../../api/greenApi'
import { useChat } from '../../state/chatContext'
import { loadChats } from '../../state/chatsStorage'
import {
  normalizeCredentials,
  validateCredentials,
  type CredentialsErrors,
} from '../../utils/validation'
import { Spinner } from '../ui/Spinner'
import { TextField } from '../ui/TextField'
import styles from './LoginScreen.module.css'

const EMPTY: Credentials = { idInstance: '', apiTokenInstance: '', apiUrl: '' }

/** Почему не пускаем, если инстанс отвечает, но не готов к работе. */
function stateMessage(state: InstanceState): string {
  switch (state) {
    case 'notAuthorized':
      return 'Инстанс не авторизован: отсканируйте QR-код в личном кабинете GREEN-API'
    case 'blocked':
      return 'Инстанс заблокирован'
    case 'starting':
      return 'Инстанс запускается, попробуйте через пару минут'
    case 'yellowCard':
      return 'Отправка сообщений с этого номера временно ограничена WhatsApp'
    default:
      return `Инстанс сейчас недоступен (статус: ${state})`
  }
}

export function LoginScreen() {
  const { dispatch } = useChat()
  const [values, setValues] = useState<Credentials>(EMPTY)
  const [errors, setErrors] = useState<CredentialsErrors>({})
  const [formError, setFormError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const idInstanceRef = useRef<HTMLInputElement>(null)
  const tokenRef = useRef<HTMLInputElement>(null)
  const apiUrlRef = useRef<HTMLInputElement>(null)
  // Если ушли с экрана во время проверки — обрываем запрос
  const abortRef = useRef<AbortController>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const setField = (field: keyof Credentials) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    // Ошибку поля убираем, как только человек начал его исправлять
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)

    const fieldErrors = validateCredentials(values)
    setErrors(fieldErrors)
    // Переводим фокус на первое поле с ошибкой, чтобы сразу было видно, что исправить
    const firstInvalid = [
      fieldErrors.idInstance && idInstanceRef,
      fieldErrors.apiTokenInstance && tokenRef,
      fieldErrors.apiUrl && apiUrlRef,
    ].find(Boolean)
    if (firstInvalid) {
      firstInvalid.current?.focus()
      return
    }

    const credentials = normalizeCredentials(values)
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      // Проверяем данные сразу, а не при первой отправке сообщения
      const state = await getStateInstance(credentials, controller.signal)
      if (state !== 'authorized') {
        setFormError(stateMessage(state))
        return
      }
      dispatch({ type: 'loggedIn', credentials, chats: loadChats(credentials.idInstance) })
    } catch (error) {
      if (!controller.signal.aborted) setFormError(getErrorMessage(error))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.banner} aria-hidden="true" />
      <section className={styles.card} aria-labelledby="login-title">
        <h1 id="login-title" className={styles.title}>
          Вход в GREEN-API Chat
        </h1>
        <p className={styles.subtitle}>
          Все три значения есть на странице инстанса в{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            личного кабинета GREEN-API
          </a>
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <TextField
            ref={idInstanceRef}
            label="ID инстанса"
            hint="idInstance в личном кабинете"
            name="idInstance"
            inputMode="numeric"
            autoComplete="off"
            placeholder="7107000000"
            value={values.idInstance}
            onChange={(e) => setField('idInstance')(e.target.value)}
            error={errors.idInstance}
            disabled={loading}
          />
          <TextField
            ref={tokenRef}
            label="API-токен"
            hint="apiTokenInstance в личном кабинете"
            name="apiTokenInstance"
            type={showToken ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={values.apiTokenInstance}
            onChange={(e) => setField('apiTokenInstance')(e.target.value)}
            error={errors.apiTokenInstance}
            disabled={loading}
            addon={
              <button
                type="button"
                className={styles.toggle}
                onClick={() => setShowToken((v) => !v)}
                aria-pressed={showToken}
                aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}
              >
                {showToken ? 'Скрыть' : 'Показать'}
              </button>
            }
          />
          <TextField
            ref={apiUrlRef}
            label="Адрес API"
            name="apiUrl"
            type="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://7107.api.greenapi.com"
            hint="apiUrl в личном кабинете"
            value={values.apiUrl}
            onChange={(e) => setField('apiUrl')(e.target.value)}
            error={errors.apiUrl}
            disabled={loading}
          />

          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading && <Spinner />}
            {loading ? 'Проверяем…' : 'Войти'}
          </button>
        </form>
      </section>
    </main>
  )
}
