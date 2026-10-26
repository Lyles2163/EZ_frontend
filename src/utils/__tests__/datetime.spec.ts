// src/utils/__tests__/datetime.spec.ts
import { describe, expect, it } from 'vitest'
import { formatDateTime } from '../datetime'

describe('formatDateTime', () => {
  it('epoch 毫秒 → 本地日期串（不写死完整格式：Intl 结果随 locale 变）', () => {
    const got = formatDateTime(1792805141000)
    expect(got).toContain('2026')
    expect(got).not.toBe('—')
  })

  it('null / NaN / Infinity 都回占位符，而不是 1970 或 Invalid Date', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime(Number.NaN)).toBe('—')
    expect(formatDateTime(Number.POSITIVE_INFINITY)).toBe('—')
  })
})
