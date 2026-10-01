import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'
import { IconButton } from './IconButton'
import styles from './Modal.module.css'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Модальное окно на нативном <dialog>. Браузер сам держит фокус внутри окна,
 * затемняет страницу под ним и закрывает его по Esc — нам остаётся только открыть окно
 * и вернуть фокус на кнопку, с которой его открыли.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  // Храним свежий onClose в ref, чтобы не пересоздавать подписку на клики при каждой отрисовке
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialog.showModal()
    // Браузер сам ставит фокус на первую кнопку («Закрыть»), а удобнее сразу печатать в поле
    dialog.querySelector<HTMLElement>('input, textarea')?.focus()

    // Клик мимо окна попадает в сам <dialog> (в его затемнённую подложку) — закрываем.
    // С клавиатуры то же самое делает Esc, поэтому это лишь дополнительный способ для мышки.
    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) onCloseRef.current()
    }
    dialog.addEventListener('click', handleClick)

    return () => {
      dialog.removeEventListener('click', handleClick)
      dialog.close()
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="modal-title"
      // Esc: не даём браузеру закрыть окно самому — закрываем через состояние React
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id="modal-title" className={styles.title}>
            {title}
          </h2>
          <IconButton label="Закрыть" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </header>
        {children}
      </div>
    </dialog>
  )
}
