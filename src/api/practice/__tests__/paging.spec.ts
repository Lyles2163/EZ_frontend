// src/api/practice/__tests__/paging.spec.ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_MAX, clampPageSize, normalizePage, shrinkPage, type PageView } from '../paging'

describe('clampPageSize：后端超 100 直接 40000', () => {
  it('常量就是后端的口径', () => {
    expect(PAGE_SIZE_MAX).toBe(100)
    expect(DEFAULT_PAGE_SIZE).toBe(20)
  })

  it('夹到上限、非法值回默认', () => {
    expect(clampPageSize(101)).toBe(100)
    expect(clampPageSize(100)).toBe(100)
    expect(clampPageSize(0)).toBe(20)
    expect(clampPageSize(-5)).toBe(20)
    expect(clampPageSize(null)).toBe(20)
    expect(clampPageSize(undefined)).toBe(20)
    expect(clampPageSize(Number.NaN)).toBe(20)
    expect(clampPageSize(15.5)).toBe(15)
  })
})

describe('normalizePage：越界页的真相是 total，不是空 list', () => {
  it('第一页有下一页', () => {
    const got = normalizePage({ pageNum: 1, pageSize: 20, total: 21, pages: 2, list: [1] })
    expect(got.hasPrev).toBe(false)
    expect(got.hasNext).toBe(true)
  })

  it('最后一页', () => {
    const got = normalizePage({ pageNum: 2, pageSize: 20, total: 21, pages: 2, list: [1] })
    expect(got.hasNext).toBe(false)
    expect(got.hasPrev).toBe(true)
  })

  it('越界页：list 空但 pages 说明有题 → 判据只看 pages', () => {
    const got = normalizePage({ pageNum: 3, pageSize: 20, total: 21, pages: 2, list: [] })
    expect(got.hasNext).toBe(false)
    expect(got.hasPrev).toBe(true)
    expect(got.total).toBe(21)
  })

  it('空库：pages=0 → 两个方向都 false', () => {
    const got = normalizePage({ pageNum: 1, pageSize: 20, total: 0, pages: 0, list: [] })
    expect(got.hasPrev).toBe(false)
    expect(got.hasNext).toBe(false)
  })

  it('原始五个字段原样透出（不许把 total 改算成 list.length）', () => {
    const got = normalizePage({ pageNum: 4, pageSize: 100, total: 305, pages: 4, list: [] })
    expect([got.pageNum, got.pageSize, got.total, got.pages, got.list]).toEqual([4, 100, 305, 4, []])
  })
})

describe('shrinkPage：就地摘一行后四个量一起收敛', () => {
  function view(pageNum: number, total: number, rows: number[]): PageView<number> {
    return {
      ...normalizePage({ pageNum, pageSize: 20, total, pages: Math.ceil(total / 20), list: rows }),
    }
  }

  it('第 1 页摘到只剩 1 页：旧的 hasNext=true 必须被重算成 false', () => {
    const before = view(1, 21, [1, 2])
    expect(before.hasNext).toBe(true)
    const got = shrinkPage(before)
    expect(got.total).toBe(20)
    expect(got.pages).toBe(1)
    expect(got.hasPrev).toBe(false)
    expect(got.hasNext).toBe(false)
  })

  it('第一页摘掉唯一一行：0 页时两个方向都 false（不是 0.05 页）', () => {
    const got = shrinkPage(view(1, 1, [1]))
    expect(got.total).toBe(0)
    expect(got.pages).toBe(0)
    expect([got.hasPrev, got.hasNext]).toEqual([false, false])
  })

  it('total 不许减成负数，其余字段原样保留', () => {
    const got = shrinkPage(view(1, 0, []))
    expect(got.total).toBe(0)
    expect(got.pageNum).toBe(1)
    expect(got.pageSize).toBe(20)
    expect(got.list).toEqual([])
  })
})
