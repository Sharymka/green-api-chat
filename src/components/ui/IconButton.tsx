import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import styles from './IconButton.module.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Подпись обязательна: без неё скринридер прочитает просто «кнопка». */
  label: string
  /** Цвет иконки: обычный серый или зелёный акцент. */
  tone?: 'default' | 'accent'
  children: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({
  label,
  tone = 'default',
  children,
  className,
  ref,
  ...props
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={[styles.button, styles[tone], className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  )
}
