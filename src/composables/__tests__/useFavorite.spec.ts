// src/composables/__tests__/useFavorite.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as F from '../../api/practice/__tests__/fixtures'
import { useFavorite } from '../useFavorite'

type Cell = Record<string, unknown>
let pagePayload: unknown = F.FAVORITE_PAGE_OK
let togglePayload: unknown = { favorited: false }
let urls: string[] = []
let bodies: string[] = []

function stubFetch(): void {
  urls = []
  bodies = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url)
    urls.push(path)
    bodies.push(typeof init?.body === 'string' ? init.body : '')
    let data: unknown
    if (path.includes('/favorite/page')) data = pagePayload
    else if (path.includes('/favorite/toggle')) data = togglePayload
    else throw new Error(`未预期的请求：${path}`)
    return new Response(JSON.stringify({ code: 1, msg: 'success', data }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }))
}

beforeEach(() => {
  pagePayload = F.FAVORITE_PAGE_OK
  togglePayload = { favorited: false }
  stubFetch()
})
afterEach(() => { vi.unstubAllGlobals() })

describe('加载', () => {
  it('reload 填列表与分页视图', async () => {
    const fav = useFavorite(() => 1)
    await fav.reload()
    expect(fav.rows.value.length).toBe(1)
    expect(fav.page.value.total).toBe(1)
    expect(fav.page.value.pages).toBe(1)
    expect([fav.page.value.hasPrev, fav.page.value.hasNext]).toEqual([false, false])
    expect(fav.loading.value).toBe(false)
    expect(fav.error.value).toBeNull()
  })

  it('没有科目时不发请求，直接给一句可关闭的提示', async () => {
    const fav = useFavorite(() => null)
    await fav.reload()
    expect(urls.length).toBe(0)
    expect(fav.error.value).toBe('请先选择一个科目')
    expect(fav.loading.value).toBe(false)
  })

  it('查询串只带 subjectId/pageNum/pageSize（这接口没有 status）', async () => {
    const fav = useFavorite(() => 1)
    await fav.reload()
    expect(urls[0]).toContain('/practice/favorite/page?subjectId=1&pageNum=1&pageSize=20')
  })

  it('越界页：list 空但 total>0 时不算空、翻页判据照旧', async () => {
    pagePayload = { pageNum: 3, pageSize: 20, total: 41, pages: 3, list: [] }
    const fav = useFavorite(() => 1)
    await fav.reload()
    expect(fav.rows.value.length).toBe(0)
    expect(fav.page.value.total).toBe(41)
    expect(fav.page.value.hasPrev).toBe(true)
    expect(fav.page.value.hasNext).toBe(false)
  })
})

describe('取消收藏', () => {
  it('就地摘行，total 减 1 且 pages 与 hasNext 一起收敛', async () => {
    pagePayload = {
      pageNum: 1, pageSize: 20, total: 21, pages: 2,
      list: [F.FAVORITE_PAGE_OK.list![0], { ...F.FAVORITE_PAGE_OK.list![0]!, questionId: 9 }] as Cell[],
    }
    const fav = useFavorite(() => 1)
    await fav.reload()
    expect(fav.page.value.hasNext).toBe(true)

    await fav.unfavorite(1)

    expect(fav.rows.value.map(r => r.questionId)).toEqual([9])
    expect(fav.page.value.total).toBe(20)
    expect(fav.page.value.pages).toBe(1)
    expect(fav.page.value.hasNext).toBe(false)
  })

  it('请求体是 { subjectId, questionId }（subjectId 从当前科目来，行里没有）', async () => {
    const fav = useFavorite(() => 2)
    await fav.reload()
    await fav.unfavorite(1)
    expect(JSON.parse(bodies[bodies.length - 1])).toEqual({ subjectId: 2, questionId: 1 })
  })

  it('后端回 favorited=true 时什么都不改（这次点击其实又把它收藏回来了）', async () => {
    togglePayload = { favorited: true }
    const fav = useFavorite(() => 1)
    await fav.reload()
    await fav.unfavorite(1)
    expect(fav.rows.value.length).toBe(1)
    expect(fav.page.value.total).toBe(1)
  })

  it('翻页只按 pages：越界的那一页根本不发请求', async () => {
    pagePayload = { pageNum: 1, pageSize: 20, total: 21, pages: 2, list: [F.FAVORITE_PAGE_OK.list![0]] }
    const fav = useFavorite(() => 1)
    await fav.reload()
    const before = urls.length
    fav.go(1)
    expect(fav.page.value.pageNum).toBe(2)
    fav.go(1)
    expect(fav.page.value.pageNum).toBe(2)
    expect(urls.length).toBe(before + 1)
  })

  it('迟到的旧响应不许覆盖新结果', async () => {
    const slow = {
      pageNum: 1, pageSize: 20, total: 5, pages: 1,
      list: Array.from({ length: 5 }, (_, i) => ({ ...F.FAVORITE_PAGE_OK.list![0]!, questionId: 200 + i })),
    }
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = String(url)
      urls.push(path)
      n += 1
      const data = n === 1 ? slow : F.FAVORITE_PAGE_OK
      await new Promise(resolve => setTimeout(resolve, n === 1 ? 30 : 0))
      return new Response(JSON.stringify({ code: 1, msg: 'success', data }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }))

    const fav = useFavorite(() => 1)
    const first = fav.reload()           // 慢的 5 行
    const second = fav.reload()          // 快的 1 行，才是"当前"
    await Promise.all([first, second])
    await vi.waitFor(() => expect(fav.rows.value.length).toBe(1))

    await new Promise(resolve => setTimeout(resolve, 60))
    expect(fav.rows.value.length).toBe(1)
    expect(fav.page.value.total).toBe(1)
  })

  it('失败时按码给文案：40000 用后端原话、40400 用固定话术，都不崩', async () => {
    for (const [code, msg, want] of [
      [40000, 'subjectId 不能为空', 'subjectId 不能为空'],
      [40400, '题目不存在', '内容可能已更新，请刷新重试'],
    ] as [number, string, string][]) {
      vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(
        JSON.stringify({ code, msg, data: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )))
      const fav = useFavorite(() => 1)
      await fav.unfavorite(1)
      expect(fav.error.value).toBe(want)
      expect(fav.rows.value.length).toBe(0)
    }
  })
})
