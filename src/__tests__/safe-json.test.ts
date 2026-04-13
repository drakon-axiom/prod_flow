import { describe, it, expect } from 'vitest'
import { safeJsonParse } from '../utils/safe-json'

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    const result = safeJsonParse('{"key": "value"}')
    expect(result.data).toEqual({ key: 'value' })
    expect(result.error).toBeUndefined()
  })

  it('parses JSON arrays', () => {
    const result = safeJsonParse('[1, 2, 3]')
    expect(result.data).toEqual([1, 2, 3])
    expect(result.error).toBeUndefined()
  })

  it('returns error for invalid JSON', () => {
    const result = safeJsonParse('{bad json}')
    expect(result.data).toBeUndefined()
    expect(result.error).toBe('Invalid JSON format')
  })

  it('returns error for empty string', () => {
    const result = safeJsonParse('')
    expect(result.data).toBeUndefined()
    expect(result.error).toBe('Invalid JSON format')
  })

  it('parses primitive values', () => {
    expect(safeJsonParse('"hello"').data).toBe('hello')
    expect(safeJsonParse('42').data).toBe(42)
    expect(safeJsonParse('true').data).toBe(true)
    expect(safeJsonParse('null').data).toBe(null)
  })
})
