// src/api/practice/__tests__/http.spec.ts
import { describe, expect, it } from 'vitest'
import { buildQuery, createSeqGuard } from '../http'

describe('buildQuery', () => {
  it('跳过 null / undefined：subjectId 与 questionId 互斥靠这个保证', () => {
    expect(buildQuery({ subjectId: 1, mode: undefined, questionId: null })).toBe('?subjectId=1')
  })

  it('空串同样跳过（"?questionId=" 这种半截参数会被后端 40000 拒）', () => {
    expect(buildQuery({ subjectId: '', questionId: 7 })).toBe('?questionId=7')
  })

  it('没有参数时回空串，不发出 "?"', () => {
    expect(buildQuery({})).toBe('')
  })

  it('数字与布尔都转字符串并做 URL 编码', () => {
    expect(buildQuery({ a: 1, b: true, c: 'x y' })).toBe('?a=1&b=true&c=x%20y')
  })

  it('mode=0 这种"看起来是空"的合法值不能被丢掉', () => {
    expect(buildQuery({ mode: 0 })).toBe('?mode=0')
  })
})

describe('createSeqGuard：切科目 / 翻页的竞态', () => {
  it('后发先至：旧 token 的迟到响应必须被判为过期', () => {
    const g = createSeqGuard()
    const first = g.next()
    const second = g.next()
    expect(g.isCurrent(first)).toBe(false)
    expect(g.isCurrent(second)).toBe(true)
  })

  it('没发过请求时任何 token 都不算当前', () => {
    expect(createSeqGuard().isCurrent(1)).toBe(false)
  })

  it('两个 guard 各自独立（答题卡与当前题并发，共用一个会把答题卡清空）', () => {
    const card = createSeqGuard()
    const flow = createSeqGuard()
    const cardToken = card.next()
    flow.next()
    expect(card.isCurrent(cardToken)).toBe(true)
  })
})
