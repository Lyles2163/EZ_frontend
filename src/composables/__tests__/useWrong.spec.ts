// src/composables/__tests__/useWrong.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as F from '../../api/practice/__tests__/fixtures'
import { useWrong } from '../useWrong'

type Cell = Record<string, unknown>
let pagePayload: unknown = F.WRONG_PAGE_OK
let masterPayload: unknown = true
let urls: string[] = []

function stubFetch(): void {
  urls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = String(url)
    urls.push(path)
    let data: unknown
    if (path.includes('/wrong/page')) data = pagePayload
    else if (path.includes('/wrong/master')) data = masterPayload
    else throw new Error(`未预期的请求：${path}`)
    return new Response(JSON.stringify({ code: 1, msg: 'success', data }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }))
}

beforeEach(() => {
  pagePayload = F.WRONG_PAGE_OK
  masterPayload = true
  stubFetch()
})
afterEach(() => { vi.unstubAllGlobals() })

describe('加载与筛选', () => {
  it('reload 填列表与分页视图', async () => {
    const wrong = useWrong(() => 2)
    await wrong.reload()
    expect(wrong.rows.value.length).toBe(1)
    expect(wrong.page.value.total).toBe(1)
    expect(wrong.page.value.hasNext).toBe(false)
    expect(wrong.loading.value).toBe(false)
  })

  it('status 为 null 时串里没有 status=（"全部"是省略而不是 0）', async () => {
    const wrong = useWrong(() => 2)
    await wrong.reload()
    expect(urls[0]).toContain('/practice/wrong/page?subjectId=2&pageNum=1&pageSize=20')
    expect(urls[0]).not.toContain('status=')
  })

  it('切筛选回第 1 页并带上 status=2', async () => {
    const wrong = useWrong(() => 2)
    wrong.page.value = { ...wrong.page.value, pageNum: 3 }
    await wrong.setStatus(2)
    expect(wrong.page.value.pageNum).toBe(1)
    expect(urls[urls.length - 1]).toContain('status=2')
    expect(urls[urls.length - 1]).toContain('pageNum=1')
  })

  it('已掌握的行带 mastered 标记（status=2）', async () => {
    pagePayload = {
      pageNum: 1, pageSize: 20, total: 1, pages: 1,
      list: [{ ...F.WRONG_PAGE_OK.list![0], status: 2 } as Cell],
    }
    const wrong = useWrong(() => 2)
    await wrong.reload()
    expect(wrong.rows.value[0].mastered).toBe(true)
  })
})

describe('标记已掌握', () => {
  it('就地摘行，total 减 1 且 pages 一起重算', async () => {
    pagePayload = {
      pageNum: 1, pageSize: 20, total: 21, pages: 2,
      list: [F.WRONG_PAGE_OK.list![0], { ...F.WRONG_PAGE_OK.list![0]!, questionId: 8 }] as Cell[],
    }
    const wrong = useWrong(() => 2)
    await wrong.reload()
    expect(wrong.rows.value.length).toBe(2)

    await wrong.master(7)

    expect(wrong.rows.value.map(r => r.questionId)).toEqual([8])
    expect(wrong.page.value.total).toBe(20)
    expect(wrong.page.value.pages).toBe(1)
    expect(wrong.page.value.hasNext).toBe(false)
  })

  it('后端回 false 时什么都不改（那条已经不在未掌握了）', async () => {
    masterPayload = false
    const wrong = useWrong(() => 2)
    await wrong.reload()
    await wrong.master(7)
    expect(wrong.rows.value.length).toBe(1)
    expect(wrong.page.value.total).toBe(1)
  })

  it('翻页只按 pages：越界的那一页根本不发请求', async () => {
    pagePayload = { pageNum: 1, pageSize: 20, total: 21, pages: 2, list: [F.WRONG_PAGE_OK.list![0]] }
    const wrong = useWrong(() => 2)
    await wrong.reload()
    const before = urls.length
    wrong.go(1)          // 1 → 2，合法
    expect(wrong.page.value.pageNum).toBe(2)
    wrong.go(1)          // 2 → 3，越界：不许打接口
    expect(wrong.page.value.pageNum).toBe(2)
    expect(urls.length).toBe(before + 1)
  })

  it('迟到的旧响应不许覆盖新结果', async () => {
    const slow = {
      pageNum: 1, pageSize: 20, total: 5, pages: 1,
      list: Array.from({ length: 5 }, (_, i) => ({ ...F.WRONG_PAGE_OK.list![0]!, questionId: 100 + i })),
    }
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = String(url)
      urls.push(path)
      n += 1
      const data = n === 1 ? slow : F.WRONG_PAGE_OK
      await new Promise(resolve => setTimeout(resolve, n === 1 ? 30 : 0))
      return new Response(JSON.stringify({ code: 1, msg: 'success', data }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }))

    const wrong = useWrong(() => 2)
    const first = wrong.reload()        // 慢的那条：5 行
    wrong.setStatus(1)                  // 快的那条：1 行，是"当前"
    await first
    await vi.waitFor(() => expect(wrong.rows.value.length).toBe(1))

    // 再等一拍：慢响应此时早已返回，若它把状态写回去就会变成 5 行
    await new Promise(resolve => setTimeout(resolve, 60))
    expect(wrong.rows.value.length).toBe(1)
    expect(wrong.page.value.total).toBe(1)
    expect(wrong.status.value).toBe(1)
  })
})
