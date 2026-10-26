// src/composables/__tests__/useDrill.spec.ts
/**
 * useDrill 是流程层，计划本来只让它靠浏览器实跑验收。
 * 这里用打桩 fetch + 纯 vue 响应式把它测起来，因为三件事恰好是"浏览器看不出来但会静默错"的：
 * 裁定七的隐藏条件、三个 seq guard 的并发、statDelta 是覆盖不是相加 —— 全都能在 node 里证。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as F from '../../api/practice/__tests__/fixtures'
import { useDrill } from '../useDrill'

let submitPayload: unknown = F.SUBMIT_WRONG_OK

function stubFetch(): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = String(url)
    let data: unknown = null
    if (path.includes('/question/page')) data = F.QUESTION_PAGE_OK
    else if (path.includes('/question/current')) data = F.QUESTION_CURRENT_OK
    else if (path.includes('/answer/submit')) data = submitPayload
    else if (path.includes('/answer/self-judge')) data = F.SELF_JUDGE_OK
    else if (path.includes('/favorite/toggle')) data = F.FAVORITE_TOGGLE_OK
    else throw new Error(`未预期的请求：${path}`)
    return new Response(JSON.stringify({ code: 1, msg: 'success', data }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }))
}

function subjectOne(): number | null { return 1 }

beforeEach(() => { submitPayload = F.SUBMIT_WRONG_OK; stubFetch() })
afterEach(() => { vi.unstubAllGlobals() })

describe('进页面的两条并发请求', () => {
  it('答题卡与当前题各自落地（一个 guard 会让答题卡永远空）', async () => {
    const drill = useDrill(subjectOne)
    await Promise.all([drill.loadCard(), drill.open({ kind: 'mode', mode: 1 })])

    expect(drill.cardCells.value.length).toBe(2)
    expect(drill.cardCells.value[1].state).toBe('pending')
    expect(drill.question.value?.questionId).toBe(7)
    expect(drill.loading.value).toBe(false)
  })

  it('重做流回填上次作答，坏数据退回默认初值而不是打死页面', async () => {
    const drill = useDrill(subjectOne)
    await drill.open({ kind: 'question', questionId: 7 })
    expect(drill.model.value).toBe('A')          // lastUserAnswerJson 是 "\"A\""
    expect(drill.answerStatus.value).toBe(2)
  })
})

describe('提交后的状态收敛', () => {
  it('答错：解析立刻可见，答题卡那一格变红', async () => {
    const drill = useDrill(subjectOne)
    await drill.loadCard()
    await drill.open({ kind: 'question', questionId: 7 })
    drill.model.value = 'A'
    await drill.submit()

    expect(drill.result.value?.isCorrect).toBe(false)
    expect(drill.showAnswer.value).toBe(true)
    expect(drill.canJudge.value).toBe(false)
    expect(drill.cardCells.value.find(c => c.questionId === 7)?.state).toBe('wrong')
    expect(drill.stat.value).toEqual(F.SUBMIT_WRONG_OK.statDelta)
  })

  it('空作答在前端就拦住，不打后端', async () => {
    const drill = useDrill(subjectOne)
    await drill.open({ kind: 'question', questionId: 7 })
    drill.model.value = null
    const callsBefore = vi.mocked(fetch).mock.calls.length
    await drill.submit()

    expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore)
    expect(drill.error.value).toContain('选择一个选项')
  })

  it('提交期间切了题，这份结果不许落到新题上，按钮也不许卡在"提交中…"', async () => {
    const drill = useDrill(subjectOne)
    await drill.open({ kind: 'question', questionId: 7 })
    drill.model.value = 'A'

    const submitting = drill.submit()
    await drill.open({ kind: 'mode', mode: 1 })    // 抢在提交返回前切走
    await submitting

    expect(drill.result.value).toBeNull()
    expect(drill.busy.value).toBe(false)
  })
})

describe('裁定七：简答题的参考答案先藏着', () => {
  it('needSelfJudge 时 showAnswer=false，自评后才展开', async () => {
    submitPayload = F.SUBMIT_PENDING_OK
    const drill = useDrill(subjectOne)
    await drill.loadCard()
    await drill.open({ kind: 'question', questionId: 7 })
    drill.model.value = '我的简答'
    await drill.submit()

    // 后端那一刻确实把答案给了（这条断言钉的是"屏幕不渲染"而不是"后端没给"）
    expect(drill.result.value?.correctAnswerJson).toBe('"我的简答"')
    expect(drill.showAnswer.value).toBe(false)
    expect(drill.canJudge.value).toBe(true)
    expect(drill.cardCells.value.find(c => c.questionId === 7)?.state).toBe('pending')

    await drill.judge(true)
    expect(drill.showAnswer.value).toBe(true)
    expect(drill.canJudge.value).toBe(false)
    expect(drill.judgedTip.value).toBe('已记录自评：答对')
    expect(drill.cardCells.value.find(c => c.questionId === 7)?.state).toBe('correct')
    expect(drill.stat.value).toEqual(F.SELF_JUDGE_OK.statDelta)
  })

  it('刷新后来自评：没有 result 可展开，但态与统计照样收敛', async () => {
    const drill = useDrill(subjectOne)
    await drill.loadCard()
    // 直接造出"待自评 + pendingRecordId"的刷新态
    await drill.open({ kind: 'question', questionId: 7 })
    drill.answerStatus.value = 3
    drill.pendingRecordId.value = 22

    expect(drill.canJudge.value).toBe(true)
    await drill.judge(false)

    expect(drill.result.value).toBeNull()
    expect(drill.showAnswer.value).toBe(false)
    expect(drill.judgedTip.value).toBe('已记录自评：答错')
    expect(drill.answerStatus.value).toBe(2)
  })
})

describe('收藏以后端返回值为准', () => {
  it('toggle 回 true 就写 true，不乐观翻转', async () => {
    const drill = useDrill(subjectOne)
    await drill.loadCard()
    await drill.open({ kind: 'question', questionId: 7 })
    expect(drill.favorited.value).toBe(false)

    await drill.toggleFav()
    expect(drill.favorited.value).toBe(true)
  })
})
