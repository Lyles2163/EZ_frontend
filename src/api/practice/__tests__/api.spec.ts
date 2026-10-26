// src/api/practice/__tests__/api.spec.ts
/**
 * 打桩 globalThis.fetch 而不是 mock 掉 request.ts：
 * 那样信封解包、code!==1 转 BizError、401 收口这些真实链路都一起被验到了，
 * 而 mock 模块会把它们整段跳过 —— 取数层最容易接错的恰恰是这几步。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BizError, HttpError } from '../../request'
import * as F from './fixtures'
import { fetchCurrent, fetchQuestionPage, selfJudge, submitAnswer } from '../question'
import { fetchSubjects } from '../subject'
import { fetchFavoritePage, fetchWrongPage, markMastered, toggleFavorite } from '../wrongFavorite'

let calls: { url: string; init?: RequestInit }[] = []

function respond(data: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({ code: 1, msg: 'success', data }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }))
}

function respondRaw(body: unknown, status = 200): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    })
  }))
}

function bodyOf(index = 0): unknown {
  return JSON.parse(String(calls[index].init?.body))
}

beforeEach(() => { calls = [] })
afterEach(() => { vi.unstubAllGlobals() })

describe('GET 拼 URL', () => {
  it('subject/list 不带 query', async () => {
    respond(F.SUBJECT_LIST_OK)
    const got = await fetchSubjects()
    expect(calls[0].url).toBe('/gw/practice/subject/list')
    expect(got[0].name).toBe('语文')
  })

  it('question/page 三个参数都进 query', async () => {
    respond(F.QUESTION_PAGE_OK)
    await fetchQuestionPage({ subjectId: 1, pageNum: 2, pageSize: 100 })
    expect(calls[0].url).toBe('/gw/practice/question/page?subjectId=1&pageNum=2&pageSize=100')
  })

  it('question/page 省略分页参数时由取数层定死默认值', async () => {
    respond(F.QUESTION_PAGE_OK)
    await fetchQuestionPage({ subjectId: 1 })
    expect(calls[0].url).toBe('/gw/practice/question/page?subjectId=1&pageNum=1&pageSize=20')
  })

  it('question/page 的 pageSize 超 100 被夹住（后端会 40000）', async () => {
    respond(F.QUESTION_PAGE_OK)
    await fetchQuestionPage({ subjectId: 1, pageSize: 5000 })
    expect(calls[0].url).toContain('pageSize=100')
  })

  it('current 只给 questionId：subjectId 绝不出现（同时给会被后端 40000 拒）', async () => {
    respond(F.QUESTION_CURRENT_OK)
    await fetchCurrent({ questionId: 7 })
    expect(calls[0].url).toBe('/gw/practice/question/current?questionId=7')
  })

  it('current 给 subjectId + mode=3', async () => {
    respond(F.QUESTION_CURRENT_OK)
    await fetchCurrent({ subjectId: 2, mode: 3 })
    expect(calls[0].url).toBe('/gw/practice/question/current?subjectId=2&mode=3')
  })

  it('current 省略 mode 时串里不出现 mode=（后端要的是"没给"，不是空值）', async () => {
    respond(F.QUESTION_CURRENT_OK)
    await fetchCurrent({ subjectId: 2 })
    expect(calls[0].url).toBe('/gw/practice/question/current?subjectId=2')
  })

  it('wrong/page 省略 status 时串里没有 status=', async () => {
    respond(F.WRONG_PAGE_OK)
    await fetchWrongPage({ subjectId: 1 })
    expect(calls[0].url).toBe('/gw/practice/wrong/page?subjectId=1&pageNum=1&pageSize=20')
  })

  it('wrong/page 给 status=1 就带上', async () => {
    respond(F.WRONG_PAGE_OK)
    await fetchWrongPage({ subjectId: 1, status: 1, pageNum: 2, pageSize: 20 })
    expect(calls[0].url).toBe('/gw/practice/wrong/page?subjectId=1&status=1&pageNum=2&pageSize=20')
  })

  it('favorite/page 三个参数', async () => {
    respond(F.FAVORITE_PAGE_OK)
    await fetchFavoritePage({ subjectId: 1 })
    expect(calls[0].url).toBe('/gw/practice/favorite/page?subjectId=1&pageNum=1&pageSize=20')
  })
})

describe('POST 带上 JSON body', () => {
  it('submit 的 body 就是后端 DTO 的五个键', async () => {
    respond(F.SUBMIT_WRONG_OK)
    const got = await submitAnswer({
      subjectId: 2, questionId: 7, userAnswerJson: '"A"', durationMs: 1200, mode: 1,
    })
    expect(calls[0].url).toBe('/gw/practice/answer/submit')
    expect(calls[0].init?.method).toBe('POST')
    expect(bodyOf()).toEqual({
      subjectId: 2, questionId: 7, userAnswerJson: '"A"', durationMs: 1200, mode: 1,
    })
    expect(got.statDelta.total).toBe(3)
  })

  it('userAnswerJson 原样上送，取数层不许再包一层 JSON', async () => {
    respond(F.SUBMIT_PENDING_OK)
    await submitAnswer({
      subjectId: 1, questionId: 5, userAnswerJson: '["apple",""]', durationMs: 0, mode: 3,
    })
    expect((bodyOf() as Record<string, unknown>).userAnswerJson).toBe('["apple",""]')
  })

  it('self-judge 返回 statDelta 本体（不是整个 data）', async () => {
    respond(F.SELF_JUDGE_OK)
    const got = await selfJudge({ subjectId: 1, questionId: 6, recordId: 22, isCorrect: true })
    expect(got).toEqual(F.SELF_JUDGE_OK.statDelta)
    expect(bodyOf()).toEqual({ subjectId: 1, questionId: 6, recordId: 22, isCorrect: true })
  })

  it('master 只有 questionId 一个键，data 就是布尔', async () => {
    respond(true)
    expect(await markMastered(7)).toBe(true)
    expect(bodyOf()).toEqual({ questionId: 7 })
  })

  it('toggle 回 favorited 布尔本体', async () => {
    respond(F.FAVORITE_TOGGLE_OK)
    expect(await toggleFavorite(1, 1)).toBe(true)
    expect(bodyOf()).toEqual({ subjectId: 1, questionId: 1 })
  })
})

describe('信封与校验都在路上', () => {
  it('code!=1 → BizError，带原始 code 与后端中文', async () => {
    respondRaw({ code: 40000, msg: 'subjectId 与 questionId 只能给一个', data: null })
    await expect(fetchCurrent({ subjectId: 1, questionId: 7 })).rejects.toBeInstanceOf(BizError)
    await expect(fetchCurrent({ subjectId: 1, questionId: 7 })).rejects.toThrow(/只能给一个/)
  })

  it('后端字段改名 → 形状校验抛 HttpError，而不是让 undefined 溜进页面', async () => {
    respond([{ ...F.SUBJECT_LIST_OK[0], name: undefined }])
    await expect(fetchSubjects()).rejects.toThrowError(HttpError)
    await expect(fetchSubjects()).rejects.toThrow(/name/)
  })

  it('list 变成 null 也拦得住', async () => {
    respond({ ...F.FAVORITE_PAGE_OK, list: null })
    await expect(fetchFavoritePage({ subjectId: 1 })).rejects.toThrow(/list/)
  })

  it('data 整个为 null（后端忘给）也要抛，不是回空数组', async () => {
    respond(null)
    await expect(fetchSubjects()).rejects.toThrowError(HttpError)
  })
})
