// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject, PT_BR_DICTIONARIES, PT_BR_LABEL, PT_BR_LOCALE } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Mount the language pack beside a live locale runtime for a browser that asks for the given tags. */
async function bench(...languages: string[]) {
  vi.stubGlobal('navigator', { languages, language: languages[0] ?? '' })
  const ctx = new Context()
  const locale = new LocaleRuntime(ctx)
  locale.register('common', 'zh', { retry: '重试' })
  locale.register('common', 'en', { retry: 'Retry', onlyEn: 'English only' })
  ctx.provide('locale', locale)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { locale, fiber }
}

describe('Brazilian Portuguese language pack', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('adds pt-BR with English fallback and selects it for a Brazilian browser', async () => {
    const { locale, fiber } = await bench('pt-BR', 'en-US')
    expect(locale.getLocale().locales).toContainEqual({ id: PT_BR_LOCALE, label: PT_BR_LABEL, fallback: 'en' })
    expect(locale.getLocale().active).toBe(PT_BR_LOCALE)
    const t = locale.bind('common')
    expect(t('retry')).toBe(PT_BR_DICTIONARIES['common']?.['retry'])
    // A key the pack does not carry falls back to English; the typed key map omits this test-only key.
    expect(locale.bind('common' as string)('onlyEn')).toBe('English only')
    await fiber.dispose()
  })

  it('resolves a bare Portuguese browser tag to pt-BR', async () => {
    const { locale, fiber } = await bench('pt')
    expect(locale.getLocale().active).toBe(PT_BR_LOCALE)
    await fiber.dispose()
  })

  it('removes the language and its dictionaries on dispose', async () => {
    const { locale, fiber } = await bench('pt-BR')
    await fiber.dispose()
    expect(locale.getLocale().locales.map(entry => entry.id)).not.toContain(PT_BR_LOCALE)
    expect(locale.getLocale().active).toBe('en')
    // The namespace is free again for a rival pack.
    expect(() => locale.register('common', PT_BR_LOCALE, { retry: 'Tentar de novo' })).not.toThrow()
  })

  it('ships no empty translation', () => {
    for (const [namespace, dictionary] of Object.entries(PT_BR_DICTIONARIES)) {
      for (const [key, value] of Object.entries(dictionary)) {
        // An empty value is legitimate only where the English source is empty.
        if (value === '') expect(`${namespace}:${key}`).toBe('chat:message.stepProcess.sharedPrefix')
      }
    }
  })
})
