// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { apply, CurupiraBrandMark, CurupiraBrandName, inject, PALETTE_LAYER, PALETTE_SOURCE } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'

afterEach(() => {
  cleanup()
})

const HOLES = [
  'sidebar.brand.mark',
  'sidebar.brand.name',
  'conversation.hero.brand.mark',
] as const

async function bench(declare = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  const disposeLayer = vi.fn()
  const overrideTokens = vi.fn((_source: unknown, _tokens: unknown) => disposeLayer)
  ctx.provide('theme', { overrideTokens } as never)
  const declareHoles = () => slots.register({
    name: 'root',
    children: Object.fromEntries(HOLES.map(name => [name, { kind: 'single', scope: 'root' }])),
  } as never, () => null)
  const disposeHoles = declare ? declareHoles() : undefined
  return { ctx, slots, overrideTokens, disposeLayer, declareHoles, disposeHoles }
}

describe('CurupiraCode browser-brand plugin', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('declares only the services it uses', () => {
    expect(inject).toEqual(['slots', 'theme'])
  })

  it('fills every brand slot before or after declaration and removes them on teardown', async () => {
    const before = await bench()
    const fiber = before.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(1)

    before.disposeHoles?.()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(0)
    before.declareHoles()
    await Promise.resolve()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(1)

    await fiber.dispose()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(0)

    const after = await bench(false)
    await after.ctx.plugin({ inject: [...inject], apply }).await()
    after.declareHoles()
    await Promise.resolve()
    for (const hole of HOLES) expect(after.slots.entries(hole)).toHaveLength(1)
  })

  it('mounts the forest palette for both schemes and releases it on teardown', async () => {
    const subject = await bench()
    const fiber = subject.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(subject.overrideTokens).toHaveBeenCalledWith(PALETTE_SOURCE, PALETTE_LAYER)
    expect(PALETTE_LAYER['--dsw-static-deepseek-500']).toEqual({ light: 'rgb(58, 148, 89)', dark: 'rgb(58, 148, 89)' })
    expect(PALETTE_LAYER['--dsw-static-amber-500']).toEqual({ light: 'rgb(214, 160, 74)', dark: 'rgb(214, 160, 74)' })
    await fiber.dispose()
    expect(subject.disposeLayer).toHaveBeenCalledOnce()
  })

  it('renders the mark at each requested size with a gradient owned by each instance', () => {
    const marks = render(<><CurupiraBrandMark size={24} /><CurupiraBrandMark size={24} className="hero" /></>)
    const svgs = [...marks.container.querySelectorAll('svg')]
    expect(svgs.map(svg => svg.getAttribute('width'))).toEqual(['24', '24'])
    expect(svgs[1]?.getAttribute('class')).toBe('hero')
    const ids = svgs.map(svg => svg.querySelector('linearGradient')?.id)
    expect(new Set(ids).size).toBe(2)
    expect(svgs[0]?.querySelector('path')?.getAttribute('stroke')).toBe(`url(#${ids[0] ?? ''})`)
  })

  it('renders the name as one accessible wordmark', () => {
    const name = render(<CurupiraBrandName />)
    expect(name.getByRole('img', { name: 'CurupiraCode' })).toBeTruthy()
  })
})
