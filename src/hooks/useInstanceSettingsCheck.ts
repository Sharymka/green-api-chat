import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../api/errors'
import { getSettings, setSettings, type InstanceSettings } from '../api/greenApi'
import { useChat } from '../state/chatContext'

export interface SettingsProblem {
  id: 'webhookUrl' | 'incomingWebhook' | 'outgoingWebhook'
  text: string
}

/** Какие настройки мешают чату работать в реальном времени. */
export function findSettingsProblems(settings: InstanceSettings): SettingsProblem[] {
  const problems: SettingsProblem[] = []
  if (settings.webhookUrl) {
    problems.push({
      id: 'webhookUrl',
      text: 'Указан webhookUrl — уведомления уходят на него, и новые сообщения сюда не придут.',
    })
  }
  if (settings.incomingWebhook !== 'yes') {
    problems.push({
      id: 'incomingWebhook',
      text: 'Выключены уведомления о входящих сообщениях — ответы появятся только после перезагрузки страницы.',
    })
  }
  if (settings.outgoingWebhook !== 'yes') {
    problems.push({
      id: 'outgoingWebhook',
      text: 'Выключены уведомления о статусах — не будет отметок «доставлено» и «прочитано».',
    })
  }
  return problems
}

/** Что нужно поменять, чтобы всё заработало. Остальные настройки инстанса не трогаем. */
const REQUIRED_SETTINGS: InstanceSettings = {
  webhookUrl: '',
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
}

export type FixState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'error'; message: string }

/**
 * После входа проверяет настройки инстанса (getSettings). Сразу после создания инстанса
 * все уведомления в GREEN-API выключены, и без подсказки легко не понять,
 * почему ответы не приходят. Предлагает исправить настройки одной кнопкой (setSettings).
 */
/** Как часто перепроверять настройки, пока вкладка открыта. */
const RECHECK_INTERVAL_MS = 5 * 60 * 1000

/** «Отпечаток» набора проблем: если человек скрыл предупреждение, не показываем его снова, пока проблемы те же. */
const problemsKey = (problems: SettingsProblem[]) => problems.map((p) => p.id).join(',')

export function useInstanceSettingsCheck() {
  const { state } = useChat()
  const { credentials } = state
  const [problems, setProblems] = useState<SettingsProblem[]>([])
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const [fix, setFix] = useState<FixState>({ status: 'idle' })

  // Настройки могут поменять в личном кабинете, пока приложение открыто, а уведомления об этом
  // GREEN-API не присылает (а с заданным webhookUrl в очередь вообще ничего не придёт).
  // Поэтому спрашиваем сами: при входе, при возвращении во вкладку и раз в 5 минут
  useEffect(() => {
    if (!credentials) return
    const controller = new AbortController()

    const check = () => {
      getSettings(credentials, controller.signal)
        .then((settings) => {
          const found = findSettingsProblems(settings)
          setProblems(found)
          // Всё исправилось — сбрасываем «сохранено», чтобы при новой проблеме снова предложить кнопку
          if (found.length === 0) setFix({ status: 'idle' })
        })
        // Проверка — лишь подсказка: если не удалась, чат всё равно работает
        .catch(() => {})
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }

    check()
    const timer = setInterval(check, RECHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [credentials])

  const fixSettings = useCallback(async () => {
    if (!credentials) return
    setFix({ status: 'saving' })
    try {
      const saved = await setSettings(credentials, REQUIRED_SETTINGS)
      setFix(
        saved
          ? { status: 'saved' }
          : { status: 'error', message: 'GREEN-API не сохранил настройки' },
      )
    } catch (error) {
      setFix({ status: 'error', message: getErrorMessage(error) })
    }
  }, [credentials])

  const dismiss = useCallback(() => setDismissedKey(problemsKey(problems)), [problems])

  const visible = problemsKey(problems) === dismissedKey ? [] : problems
  return { problems: visible, fix, fixSettings, dismiss }
}
