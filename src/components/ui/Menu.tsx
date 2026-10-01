import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MoreIcon } from './icons'
import { IconButton } from './IconButton'
import styles from './Menu.module.css'

export interface MenuItem {
  label: string
  icon?: ReactNode
  /** danger — красный пункт, например «Выйти». */
  tone?: 'default' | 'danger'
  onSelect: () => void
}

interface MenuProps {
  label: string
  items: MenuItem[]
}

/**
 * Меню «⋮», как в шапке WhatsApp. Открывается по кнопке, закрывается по Esc, по клику мимо
 * и после выбора пункта. Стрелками вверх/вниз можно ходить по пунктам.
 */
export function Menu({ label, items }: MenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // При открытии ставим фокус на первый пункт — так меню сразу можно листать стрелками
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus()
  }, [open])

  // Клик в любом месте мимо меню закрывает его
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent) {
    const focusable = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null)
    const index = focusable.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusable[(index + 1) % focusable.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusable[(index - 1 + focusable.length) % focusable.length]?.focus()
    } else if (event.key === 'Tab') {
      // Tab уводит фокус из меню — значит, меню больше не нужно
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <IconButton
        ref={buttonRef}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </IconButton>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          className={styles.menu}
          onKeyDown={handleKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              type="button"
              role="menuitem"
              className={styles.item}
              data-tone={item.tone}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
