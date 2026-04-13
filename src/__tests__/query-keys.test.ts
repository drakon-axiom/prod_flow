import { describe, it, expect } from 'vitest'
import { queryKeys } from '../lib/query-keys'

describe('queryKeys', () => {
  it('generates unique keys per domain', () => {
    expect(queryKeys.ingredients.all).not.toEqual(queryKeys.formulas.all)
    expect(queryKeys.runs.all).not.toEqual(queryKeys.queue.all)
  })

  it('generates detail keys with ID', () => {
    const key = queryKeys.formulas.detail('abc-123')
    expect(key).toEqual(['formulas', 'abc-123'])
  })

  it('detail keys are prefixed by all key', () => {
    const all = queryKeys.ingredients.all
    const detail = queryKeys.ingredients.detail('xyz')
    expect(detail[0]).toBe(all[0])
  })
})
