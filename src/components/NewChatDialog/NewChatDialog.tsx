import { useState, type FormEvent } from 'react'
import { normalizePhone, toChatId } from '../../utils/phone'
import { Modal } from '../ui/Modal'
import { TextField } from '../ui/TextField'
import styles from './NewChatDialog.module.css'

interface NewChatDialogProps {
  onCreate: (chatId: string) => void
  onClose: () => void
}

export function NewChatDialog({ onCreate, onClose }: NewChatDialogProps) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string>()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const normalized = normalizePhone(phone)
    if (!normalized) {
      setError(phone.trim() ? 'Введите номер целиком, вместе с кодом страны' : 'Введите номер')
      return
    }
    onCreate(toChatId(normalized))
  }

  return (
    <Modal title="Новый чат" onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Номер телефона"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="+7 900 123-45-67"
          hint="Номер, на котором есть WhatsApp"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            setError(undefined)
          }}
          error={error}
        />
        <button type="submit" className={styles.submit}>
          Начать чат
        </button>
      </form>
    </Modal>
  )
}
