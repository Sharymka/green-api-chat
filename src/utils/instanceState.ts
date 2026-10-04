import type { InstanceState } from '../api/greenApi'

/** Что сказать человеку, если инстанс есть, но к работе не готов. */
export function instanceStateMessage(state: InstanceState): string {
  switch (state) {
    case 'notAuthorized':
      return 'Инстанс не авторизован: отсканируйте QR-код в личном кабинете GREEN-API'
    case 'blocked':
      return 'Инстанс заблокирован'
    case 'starting':
      return 'Инстанс запускается, попробуйте через пару минут'
    case 'yellowCard':
    case 'suspended':
      return 'Отправка сообщений с этого номера временно ограничена WhatsApp'
    default:
      return `Инстанс сейчас недоступен (статус: ${state})`
  }
}
