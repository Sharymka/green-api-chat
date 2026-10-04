import type { FixState, SettingsProblem } from '../../hooks/useInstanceSettingsCheck'
import { CloseIcon } from '../ui/icons'
import { IconButton } from '../ui/IconButton'
import { Spinner } from '../ui/Spinner'
import styles from './SettingsWarning.module.css'

interface SettingsWarningProps {
  problems: SettingsProblem[]
  fix: FixState
  onFix: () => void
  onDismiss: () => void
}

/** Предупреждение о настройках инстанса, из-за которых сообщения не приходят в реальном времени. */
export function SettingsWarning({ problems, fix, onFix, onDismiss }: SettingsWarningProps) {
  if (problems.length === 0) return null

  return (
    <section className={styles.warning} aria-labelledby="settings-warning-title">
      <header className={styles.header}>
        <h2 id="settings-warning-title" className={styles.title}>
          Проверьте настройки инстанса
        </h2>
        <IconButton label="Скрыть предупреждение" onClick={onDismiss}>
          <CloseIcon width={18} height={18} />
        </IconButton>
      </header>

      <ul className={styles.list}>
        {problems.map((problem) => (
          <li key={problem.id}>{problem.text}</li>
        ))}
      </ul>

      {fix.status === 'saved' ? (
        <output className={styles.result}>
          Настройки сохранены. GREEN-API применит их в течение 5 минут — после этого сообщения
          начнут приходить сами.
        </output>
      ) : (
        <>
          <button
            type="button"
            className={styles.fix}
            onClick={onFix}
            disabled={fix.status === 'saving'}
          >
            {fix.status === 'saving' && <Spinner />}
            {fix.status === 'saving' ? 'Сохраняем…' : 'Исправить настройки'}
          </button>
          <p className={styles.hint}>
            Или поменяйте их сами в{' '}
            <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
              личном кабинете
            </a>
            .
          </p>
          {fix.status === 'error' && (
            <p className={styles.error} role="alert">
              Не получилось: {fix.message}
            </p>
          )}
        </>
      )}
    </section>
  )
}
