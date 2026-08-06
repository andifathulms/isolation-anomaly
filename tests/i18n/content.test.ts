import { describe as suite, expect, it } from 'vitest'
import { LOCALES } from '@/lib/i18n/locales'
import { dictionary } from '@/lib/i18n/dictionaries'
import {
  TRANSLATED_ANOMALY_IDS,
  TRANSLATED_SCENARIO_IDS,
  anomalyText,
  scenarioText,
} from '@/lib/i18n/content'
import { ANOMALIES, ANOMALY_IDS } from '@/lib/detect'
import { SCENARIOS } from '@/lib/scenarios'

/**
 * The second locale has to be a real second locale.
 *
 * Chrome translated and teaching content left in English would make Indonesian
 * decorative — a reader would get the labels in their language and the
 * explanations in someone else's. These tests fail when new content is added
 * without it.
 */

suite('the Indonesian locale is complete', () => {
  it('translates every anomaly in the catalogue', () => {
    const missing = ANOMALY_IDS.filter((id) => !TRANSLATED_ANOMALY_IDS.includes(id))
    expect(missing, `no Indonesian text for: ${missing.join(', ')}`).toEqual([])
  })

  it('translates every scenario in the library', () => {
    const missing = SCENARIOS.map((scenario) => scenario.id).filter(
      (id) => !TRANSLATED_SCENARIO_IDS.includes(id),
    )
    expect(missing, `no Indonesian text for: ${missing.join(', ')}`).toEqual([])
  })

  it('actually differs from the English, rather than copying it', () => {
    for (const id of ANOMALY_IDS) {
      const en = anomalyText('en', id)
      const id_ = anomalyText('id', id)
      expect(id_.definition, `${id} definition`).not.toBe(en.definition)
      expect(id_.stakes, `${id} stakes`).not.toBe(en.stakes)
    }
    for (const scenario of SCENARIOS) {
      const en = scenarioText('en', scenario)
      const id_ = scenarioText('id', scenario)
      expect(id_.framing, `${scenario.id} framing`).not.toBe(en.framing)
      expect(id_.lesson, `${scenario.id} lesson`).not.toBe(en.lesson)
    }
  })

  it('keeps database terminology in English in both locales', () => {
    // A reader who learns these words translated cannot then find them in the
    // vendor documentation or in an error message, so they must survive
    // untranslated in the Indonesian prose.
    const indonesian = [
      ...ANOMALY_IDS.map((id) => Object.values(anomalyText('id', id)).join(' ')),
      ...SCENARIOS.map((scenario) => Object.values(scenarioText('id', scenario)).join(' ')),
    ]
      .join(' ')
      .toLowerCase()

    for (const term of [
      'write skew',
      'dirty read',
      'snapshot isolation',
      'read committed',
      'repeatable read',
      'serializable',
      'commit',
      'rollback',
      'snapshot',
      'lock',
      'constraint',
    ]) {
      expect(indonesian, `"${term}" should appear untranslated`).toContain(term)
    }

    // The anomaly names themselves are terms, not prose.
    expect(anomalyText('id', 'write-skew').name).toBe('Write skew')
    expect(anomalyText('id', 'dirty-read').name).toBe('Dirty read')
    expect(anomalyText('id', 'phantom-read').name).toBe('Phantom read')
  })

  it('falls back to English rather than showing nothing', () => {
    const invented = {
      ...SCENARIOS[0]!,
      id: 'not-translated-yet',
      framing: 'An English framing.',
      lesson: 'An English lesson.',
      title: 'An English title.',
    }
    expect(scenarioText('id', invented).framing).toBe('An English framing.')
  })
})

suite('every dictionary key is filled in for every locale', () => {
  it('has no empty or missing strings', () => {
    for (const locale of LOCALES) {
      const dict = dictionary(locale)
      for (const [section, entries] of Object.entries(dict)) {
        for (const [key, value] of Object.entries(entries as Record<string, string>)) {
          expect(typeof value, `${locale}.${section}.${key}`).toBe('string')
          expect(value.trim().length, `${locale}.${section}.${key} is empty`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('gives the two locales the same shape, so nothing is quietly dropped', () => {
    const shape = (locale: (typeof LOCALES)[number]) =>
      Object.entries(dictionary(locale))
        .map(([section, entries]) => `${section}:${Object.keys(entries as object).sort().join(',')}`)
        .sort()
    expect(shape('id')).toEqual(shape('en'))
  })
})

suite('the catalogue keeps its untranslatable parts', () => {
  it('leaves the phenomenon notation and the label alone in both locales', () => {
    for (const id of ANOMALY_IDS) {
      // `w1[x] ... r2[x]` and `P1` are notation, not prose.
      expect(ANOMALIES[id].formal).toMatch(/[a-z]\d\[/)
      expect(ANOMALIES[id].label).toMatch(/^[A-Z]\d/)
    }
  })
})
