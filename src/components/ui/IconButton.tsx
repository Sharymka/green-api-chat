import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './IconButton.module.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Подпись обязательна: без неё скринридер прочитает просто «кнопка». */
  label: string
  /** Цвет иконки: обычный серый или зелёный акцент. */
  tone?: 'default' | 'accent'
  children: ReactNode
}

export function IconButton({
  label,
  tone = 'default',
  children,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
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
