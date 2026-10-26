// src/api/practice/answer.ts
/**
 * 题目语义层：作答值 ↔ 上送的 JSON 文本、answerStatus ↔ 答题卡四态、自评闸门判据。
 *
 * 这里的 encode 是全模块**唯一**能产出 userAnswerJson 的地方。
 * 后端把它直写 MySQL json 列，并用严格 parse 拒多值文档与非有限数
 * （段 2 的独立审查就是抓在这个上面），所以字符串绝不能在别处手工拼。
 */
import { HttpError } from '../request'
import type { AnswerSubmitResult } from './types'

export const TYPE_SINGLE = 1
export const TYPE_MULTI = 2
export const TYPE_JUDGE = 3
export const TYPE_BLANK = 4
export const TYPE_ESSAY = 5

export type AnswerValue = string | string[] | boolean | null

/**
 * 填空的两条渲染分支由 Task 2 的实测决定（见 spec 的更正段）：
 * 库里唯一那道填空是 `植物通过____作用…` / `["光合作用"]`，占位符数 == 槽数 → counted。
 * freeform 分支照旧实现，但样本量只有 1 道题，不足以把它当普适结论。
 */
export const BLANK_MODE: 'counted' | 'freeform' = 'counted'

const BLANK_MARKER = /_{2,}|（\s*）|\(\s*\)/g

/** counted 模式给出与槽数等长的空数组；数不出来返回 null，调用方退回自由文本。 */
export function blankSlots(title: string): string[] | null {
  if (BLANK_MODE !== 'counted') return null
  const found = title.match(BLANK_MARKER)
  return found && found.length ? found.map(() => '') : null
}

export function encodeUserAnswer(type: number, value: AnswerValue): string {
  switch (type) {
    case TYPE_SINGLE:
      if (typeof value !== 'string' || !value) throw new HttpError('单选题需要选择一个选项', 0)
      return JSON.stringify(value)
    case TYPE_MULTI: {
      if (!Array.isArray(value) || value.length === 0) throw new HttpError('多选题至少选择一个选项', 0)
      if (!value.every(v => typeof v === 'string' && v)) throw new HttpError('多选题的选项键不合法', 0)
      // 排序：["B","A"] 与 ["A","B"] 是同一个答案，判分口径不该跟着点击顺序走
      return JSON.stringify([...value].sort())
    }
    case TYPE_JUDGE:
      if (typeof value !== 'boolean') throw new HttpError('判断题需要选择"对"或"错"', 0)
      return JSON.stringify(value)
    case TYPE_BLANK: {
      if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
        throw new HttpError('填空题答案格式不合法', 0)
      }
      const trimmed = value.map(v => v.trim())
      if (!trimmed.some(v => v)) throw new HttpError('填空题至少填一个空', 0)
      return JSON.stringify(trimmed)
    }
    case TYPE_ESSAY:
      if (typeof value !== 'string' || !value.trim()) throw new HttpError('简答题请先作答', 0)
      return JSON.stringify(value.trim())
    default:
      throw new HttpError(`未知题型 ${String(type)}`, 0)
  }
}

/** 把 lastUserAnswerJson 解回控件态。坏数据一律回 null（当未作答），绝不抛。 */
export function decodeUserAnswer(type: number, json: string | null): AnswerValue {
  if (json === null || json === '') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')
  switch (type) {
    case TYPE_SINGLE:
      return typeof parsed === 'string' && parsed ? parsed : null
    case TYPE_MULTI:
      // 空数组回 null：[] 会被 encode 拒，回填成 [] 等于给一题注定失败的态
      return strings(parsed) && parsed.length ? parsed : null
    case TYPE_JUDGE:
      return typeof parsed === 'boolean' ? parsed : null
    case TYPE_BLANK:
      return strings(parsed) ? parsed : null
    case TYPE_ESSAY:
      return typeof parsed === 'string' ? parsed : null
    default:
      return null
  }
}

export type CardState = 'idle' | 'correct' | 'wrong' | 'pending'

export function cardState(status: number | null): CardState {
  switch (status) {
    case 1: return 'correct'
    case 2: return 'wrong'
    case 3: return 'pending'
    default: return 'idle'
  }
}

export function cardStateAfterSubmit(r: AnswerSubmitResult): CardState {
  // 顺序不能反：那一刻 isCorrect 是 null，`r.isCorrect ? … : 'wrong'` 会把待自评答成"错"
  if (r.needSelfJudge) return 'pending'
  return r.isCorrect ? 'correct' : 'wrong'
}

/**
 * 两个条件缺一不可：状态是待自评，且后端给了 recordId。
 * pendingRecordId 为 null 的题（考试来源的作答）没有自评入口，硬点只会吃一个 40000。
 */
export function canSelfJudge(status: number | null, pendingRecordId: number | null): boolean {
  return status === 3 && pendingRecordId !== null
}

/** 后端 validateSubmit 对负数回 40000"单题用时不能为负"；NaN/Infinity 也不能上送。 */
export function clampDuration(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.round(ms)
}
