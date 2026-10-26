// src/api/practice/__tests__/answer.spec.ts
import { describe, expect, it } from 'vitest'
import { HttpError } from '../../request'
import * as F from './fixtures'
import { parseAnswerSubmit } from '../types'
import {
  BLANK_MODE, blankSlots, canSelfJudge, cardState, cardStateAfterSubmit, clampDuration,
  decodeUserAnswer, encodeUserAnswer, TYPE_BLANK, TYPE_ESSAY, TYPE_JUDGE, TYPE_MULTI, TYPE_SINGLE,
} from '../answer'

describe('encodeUserAnswer：输出是整份 JSON 的文本', () => {
  it('单选 → "A"（含引号）', () => {
    expect(encodeUserAnswer(TYPE_SINGLE, 'A')).toBe('"A"')
  })
  it('多选 → 归一排序', () => {
    expect(encodeUserAnswer(TYPE_MULTI, ['B', 'A'])).toBe('["A","B"]')
  })
  it('判断 → true / false', () => {
    expect(encodeUserAnswer(TYPE_JUDGE, true)).toBe('true')
    expect(encodeUserAnswer(TYPE_JUDGE, false)).toBe('false')
  })
  it('填空 → 空位保留为 ""，逐个 trim', () => {
    expect(encodeUserAnswer(TYPE_BLANK, [' apple ', ''])).toBe('["apple",""]')
  })
  it('简答 → 整段字符串', () => {
    expect(encodeUserAnswer(TYPE_ESSAY, '我的作答')).toBe('"我的作答"')
  })
  it('空作答一律抛，绝不发 ""：后端"答案不能为空"是 40000', () => {
    expect(() => encodeUserAnswer(TYPE_SINGLE, '')).toThrowError(HttpError)
    expect(() => encodeUserAnswer(TYPE_MULTI, [])).toThrowError(HttpError)
    expect(() => encodeUserAnswer(TYPE_BLANK, ['', '   '])).toThrowError(HttpError)
    expect(() => encodeUserAnswer(TYPE_ESSAY, '   ')).toThrowError(HttpError)
    expect(() => encodeUserAnswer(TYPE_JUDGE, null)).toThrowError(HttpError)
  })
  it('多选里混进空串也拒', () => {
    expect(() => encodeUserAnswer(TYPE_MULTI, ['A', ''])).toThrowError(HttpError)
  })
  it('未知题型抛，不返回 undefined', () => {
    expect(() => encodeUserAnswer(99, 'A')).toThrow(/未知题型/)
  })
  it('编码结果是合法单值文档，拼上第二个值就不是（后端与 MySQL 都拒多值）', () => {
    const encoded = encodeUserAnswer(TYPE_SINGLE, 'A')
    expect(JSON.parse(encoded)).toBe('A')
    expect(() => JSON.parse(encoded + ' "B"')).toThrow()
  })
})

describe('decodeUserAnswer：坏数据不能打死答题页', () => {
  it('五题型正向', () => {
    expect(decodeUserAnswer(TYPE_SINGLE, '"A"')).toBe('A')
    expect(decodeUserAnswer(TYPE_MULTI, '["A","B"]')).toEqual(['A', 'B'])
    expect(decodeUserAnswer(TYPE_JUDGE, 'true')).toBe(true)
    expect(decodeUserAnswer(TYPE_BLANK, '["a",""]')).toEqual(['a', ''])
    expect(decodeUserAnswer(TYPE_ESSAY, '"我的作答"')).toBe('我的作答')
  })
  it('null / 空串 → null', () => {
    expect(decodeUserAnswer(TYPE_SINGLE, null)).toBeNull()
    expect(decodeUserAnswer(TYPE_SINGLE, '')).toBeNull()
  })
  it('畸形 JSON → null 而不是抛', () => {
    expect(decodeUserAnswer(TYPE_SINGLE, '{坏掉了')).toBeNull()
  })
  it('类型不符 → null', () => {
    expect(decodeUserAnswer(TYPE_SINGLE, '3')).toBeNull()
    expect(decodeUserAnswer(TYPE_MULTI, '"A"')).toBeNull()
    expect(decodeUserAnswer(TYPE_JUDGE, '"true"')).toBeNull()
    expect(decodeUserAnswer(TYPE_ESSAY, ['A'] as unknown as string)).toBeNull()
  })
  it('多选的空数组回 null 而不是 []（[] 会被 encode 拒，别留个必失败的态）', () => {
    expect(decodeUserAnswer(TYPE_MULTI, '[]')).toBeNull()
  })
})

describe('答题卡四态', () => {
  it('answerStatus → 态', () => {
    expect(cardState(0)).toBe('idle')
    expect(cardState(1)).toBe('correct')
    expect(cardState(2)).toBe('wrong')
    expect(cardState(3)).toBe('pending')
    expect(cardState(null)).toBe('idle')
  })
  it('提交后迁移：待自评优先于 isCorrect（那一刻它是 null，不是 false）', () => {
    expect(cardStateAfterSubmit(parseAnswerSubmit(F.SUBMIT_WRONG_OK))).toBe('wrong')
    expect(cardStateAfterSubmit(parseAnswerSubmit(F.SUBMIT_PENDING_OK))).toBe('pending')
  })
})

describe('canSelfJudge：闸门要两个条件同时成立', () => {
  it('3 + pendingRecordId → 可以', () => expect(canSelfJudge(3, 22)).toBe(true))
  it('3 + null（考试来源的题）→ 不可以', () => expect(canSelfJudge(3, null)).toBe(false))
  it('非 3 一律不可以', () => {
    expect(canSelfJudge(2, 22)).toBe(false)
    expect(canSelfJudge(0, null)).toBe(false)
    expect(canSelfJudge(null, 22)).toBe(false)
  })
})

describe('clampDuration：后端拒负数', () => {
  it('负数归 0，正常值原样，NaN 归 0', () => {
    expect(clampDuration(-5000)).toBe(0)
    expect(clampDuration(1200)).toBe(1200)
    expect(clampDuration(Number.NaN)).toBe(0)
    expect(clampDuration(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('blankSlots：填空槽数的唯一来源', () => {
  it('BLANK_MODE 是 Task 2 定下的两个值之一', () => {
    expect(['counted', 'freeform']).toContain(BLANK_MODE)
  })

  // 数不出来就回 null，让调用方退回自由文本。两种模式下都必须成立 ——
  // 它钉的是"数不出来时不许猜一个槽数"：猜错就是答案长度错，后端逐位比对会静默判错。
  it('没有占位符 → null', () => {
    expect(blankSlots('这是一道没有占位符的题干')).toBeNull()
  })

  // Task 2 实测 blankMode='counted'（库里唯一那道填空 1 个占位符 == 1 个槽），
  // 所以 freeform 那条 it.skipIf 当下是跳过的：保留它是为了数据形态一变时测试先叫。
  it.skipIf(BLANK_MODE !== 'counted')('counted：两个下划线占位符 → 两个空槽', () => {
    expect(blankSlots('根据内容填空：___ 与 ___ 。')).toEqual(['', ''])
  })

  it.skipIf(BLANK_MODE !== 'counted')('counted：括号形态的占位符也算', () => {
    expect(blankSlots('填（ ）和 ( )')).toEqual(['', ''])
  })

  it.skipIf(BLANK_MODE !== 'counted')('counted：库里那道真实填空题给一个槽', () => {
    expect(blankSlots('植物通过____作用将光能转化为化学能。')).toEqual([''])
  })

  it.skipIf(BLANK_MODE !== 'freeform')('freeform：一律 null，槽数交给单框按行切', () => {
    expect(blankSlots('根据内容填空：___ 与 ___ 。')).toBeNull()
  })
})
