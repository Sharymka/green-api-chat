import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { MAX_MESSAGE_LENGTH, validateMessage } from '../../utils/validation'
import { SendIcon } from '../ui/icons'
import styles from './Composer.module.css'

interface ComposerProps {
  onSend: (text: string) => void
}

/** Сколько строк поле может вырасти, прежде чем появится прокрутка. */
const MAX_ROWS = 6
/** С какой длины показывать счётчик символов. */
const COUNTER_FROM = MAX_MESSAGE_LENGTH - 1000

export function Composer({ onSend }: ComposerProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Открыли чат — ставим курсор в поле, чтобы сразу печатать.
  // Для каждого чата поле создаётся заново (key в ChatPane), поэтому текст из другого чата сюда не попадёт
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Поле растёт вместе с текстом, но не больше MAX_ROWS строк
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * MAX_ROWS + 20)}px`
  }, [text])

  function submit() {
    const validationError = validateMessage(text)
    if (validationError) {
      // Пустое сообщение просто не отправляем, ругаемся только на слишком длинное
      if (text.trim()) setError(validationError)
      return
    }
    onSend(text.trim())
    setText('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter — отправить, Shift+Enter — новая строка.
    // isComposing: пока человек набирает текст через IME (например, японский), Enter не трогаем
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submit()
  }

  const canSend = text.trim().length > 0

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="composer-input" className="visually-hidden">
          Сообщение
        </label>
        <textarea
          ref={textareaRef}
          id="composer-input"
          className={styles.input}
          rows={1}
          placeholder="Введите сообщение"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(undefined)
          }}
          onKeyDown={handleKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'composer-error' : undefined}
        />
        {(error || text.length > COUNTER_FROM) && (
          <p id="composer-error" className={styles.hint} data-error={error ? true : undefined}>
            {error ??
              `${text.length.toLocaleString('ru-RU')} / ${MAX_MESSAGE_LENGTH.toLocaleString('ru-RU')}`}
          </p>
        )}
      </div>
      <button
        type="submit"
        className={styles.send}
        aria-label="Отправить"
        title="Отправить"
        disabled={!canSend}
      >
        <SendIcon />
      </button>
    </form>
  )
}
