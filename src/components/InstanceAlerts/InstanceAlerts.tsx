import { useState } from 'react'
import { useChat } from '../../state/chatContext'
import { instanceStateMessage } from '../../utils/instanceState'
import { formatPhone, phoneFromChatId } from '../../utils/phone'
import { CloseIcon } from '../ui/icons'
import { IconButton } from '../ui/IconButton'
import styles from './InstanceAlerts.module.css'

/** Как показать разрешённого собеседника: номер телефона или просто «группа». */
function describeChat(chatId: string): string {
  return chatId.endsWith('@g.us') ? 'группа' : formatPhone(phoneFromChatId(chatId))
}

/**
 * Плашки о том, что мешает переписке со стороны GREEN-API:
 * инстанс отключили от WhatsApp (stateInstanceChanged) или закончился лимит тарифа (quotaExceeded).
 */
export function InstanceAlerts() {
  const { state } = useChat()
  const [quotaHidden, setQuotaHidden] = useState(false)
  const { instanceState, quota } = state

  return (
    <>
      {instanceState !== 'authorized' && (
        <section className={styles.alert} data-tone="danger" role="alert">
          <h2 className={styles.title}>WhatsApp отключён от GREEN-API</h2>
          <p>{instanceStateMessage(instanceState)}</p>
          <p>
            Откройте инстанс в{' '}
            <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
              личном кабинете
            </a>
            . Когда подключение восстановится, эта плашка исчезнет сама.
          </p>
        </section>
      )}

      {quota && !quotaHidden && (
        <section className={styles.alert} data-tone="warning" aria-labelledby="quota-title">
          <header className={styles.header}>
            <h2 id="quota-title" className={styles.title}>
              Закончился лимит тарифа GREEN-API
            </h2>
            <IconButton label="Скрыть предупреждение о лимите" onClick={() => setQuotaHidden(true)}>
              <CloseIcon width={18} height={18} />
            </IconButton>
          </header>
          <p>
            {quota.total
              ? `На бесплатном тарифе за месяц можно переписываться с ${quota.total} собеседниками, и все они уже заняты.`
              : 'На бесплатном тарифе число собеседников в месяц ограничено, и лимит исчерпан.'}{' '}
            Сообщения другим номерам не доходят.
          </p>
          {quota.allowedChatIds.length > 0 && (
            <p>Доступны только: {quota.allowedChatIds.map(describeChat).join(', ')}.</p>
          )}
          <p>
            Сменить тариф можно в{' '}
            <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
              личном кабинете
            </a>
            .
          </p>
        </section>
      )}
    </>
  )
}
