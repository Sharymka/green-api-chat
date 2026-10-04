import { describe, expect, it } from 'vitest'
import { findSettingsProblems } from './useInstanceSettingsCheck'

describe('findSettingsProblems', () => {
  it('правильные настройки — проблем нет', () => {
    expect(
      findSettingsProblems({ webhookUrl: '', incomingWebhook: 'yes', outgoingWebhook: 'yes' }),
    ).toEqual([])
  })

  it('находит каждую проблему', () => {
    const ids = findSettingsProblems({
      webhookUrl: 'https://example.com',
      incomingWebhook: 'no',
      outgoingWebhook: 'no',
    }).map((p) => p.id)
    expect(ids).toEqual(['webhookUrl', 'incomingWebhook', 'outgoingWebhook'])
  })

  it('отсутствующую настройку считает выключенной (так у нового инстанса)', () => {
    expect(findSettingsProblems({}).map((p) => p.id)).toEqual([
      'incomingWebhook',
      'outgoingWebhook',
    ])
  })
})
