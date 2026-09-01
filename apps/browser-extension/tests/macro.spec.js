import { describe, expect, it } from 'vitest'
import { appendMacroEvent, finishMacro, macroStats, validateMacro } from '../src/macro.js'

function locator(label = 'Nome') {
  return {
    tag: 'input', type: 'text', id: '', name: 'name', ariaLabel: '', placeholder: '',
    label, question: label, text: '', ordinal: 0,
  }
}

function event(key, action) {
  return {
    page: {
      key,
      url: `https://forms.example.test/${key}`,
      title: `Etapa ${key}`,
      signature: key,
    },
    action,
  }
}

describe('portable browser macros', () => {
  it('deduplicates noisy field events while preserving page order', () => {
    const recording = { origin: 'https://forms.example.test', name: 'Cadastro', pages: [] }
    appendMacroEvent(recording, event('one', { kind: 'fill', locator: locator(), value: 'A' }))
    appendMacroEvent(recording, event('one', { kind: 'fill', locator: locator(), value: 'Ana' }))
    appendMacroEvent(recording, event('one', { kind: 'advance', locator: { ...locator('Próximo'), tag: 'button', name: '' } }))
    appendMacroEvent(recording, event('two', { kind: 'check', locator: { ...locator('Aceito'), type: 'checkbox' }, value: true }))

    expect(recording.pages).toHaveLength(2)
    expect(recording.pages[0].actions).toHaveLength(2)
    expect(recording.pages[0].actions[0].value).toBe('Ana')
    expect(finishMacro(recording)).toMatchObject({ name: 'Cadastro', origin: 'https://forms.example.test' })
  })

  it('validates a portable macro and reports fields separately from navigation', () => {
    const macro = validateMacro({
      schemaVersion: 1,
      id: 'macro-1',
      name: 'Inscrição',
      origin: 'https://forms.example.test',
      createdAt: 1,
      pages: [{
        key: 'one', url: 'https://forms.example.test/one', title: 'Etapa', signature: 'abc',
        actions: [
          { kind: 'fill', locator: locator(), value: 'Ana' },
          { kind: 'advance', locator: { ...locator('Próximo'), tag: 'button', name: '' } },
        ],
      }],
    })
    expect(macroStats(macro)).toEqual({ pages: 1, actions: 1 })
    expect(macro.pages[0].actions.map(action => action.kind)).toEqual(['fill'])
  })

  it('rejects cross-site pages and executable action types on import', () => {
    const base = {
      schemaVersion: 1, id: 'macro-1', name: 'Teste', origin: 'https://forms.example.test', createdAt: 1,
    }
    expect(() => validateMacro({ ...base, pages: [{
      key: 'x', url: 'https://evil.example/x', title: '', signature: '',
      actions: [{ kind: 'fill', locator: locator(), value: 'Ana' }],
    }] })).toThrow(/mesmo site/)
    expect(() => validateMacro({ ...base, pages: [{
      key: 'x', url: 'https://forms.example.test/x', title: '', signature: '',
      actions: [{ kind: 'script', locator: locator(), value: 'alert(1)' }],
    }] })).toThrow(/ação desconhecida/)
  })

  it('reports an empty recording as a capture problem instead of a size problem', () => {
    expect(() => validateMacro({
      schemaVersion: 1,
      id: 'empty',
      name: 'Vazia',
      origin: 'https://forms.example.test',
      createdAt: 1,
      pages: [],
    })).toThrow(/Nenhum campo compatível foi capturado/)
  })
})
