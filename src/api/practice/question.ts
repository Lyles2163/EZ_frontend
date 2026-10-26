// src/api/practice/question.ts
import { request } from '../request'
import { buildQuery } from './http'
import { clampPageSize } from './paging'
import {
  parseAnswerSubmit, parseQuestionCurrent, parseQuestionPage, parseSelfJudge,
  type AnswerSubmitResult, type PageVO, type QuestionCurrent, type QuestionItem, type StatDelta,
} from './types'

export interface PageQuery { subjectId: number; pageNum?: number; pageSize?: number }

/**
 * 三个入参的互斥关系由调用方负责、由这里原样上送：
 * 给了 questionId 就不给 subjectId/mode，同时给后端一律 40000（QuestionReadServiceImpl:108-113）。
 * buildQuery 会把 undefined/null/空串整颗丢掉，所以"没给"真的是没给。
 */
export interface CurrentQuery { subjectId?: number; mode?: 1 | 3; questionId?: number }

export interface SubmitForm {
  subjectId: number; questionId: number;
  /** 整份 JSON 的文本，只能由 answer.ts 的 encodeUserAnswer 产出 */
  userAnswerJson: string; durationMs: number; mode: 1 | 3;
}

export interface SelfJudgeForm { subjectId: number; questionId: number; recordId: number; isCorrect: boolean }

export async function fetchQuestionPage(q: PageQuery): Promise<PageVO<QuestionItem>> {
  const query = { subjectId: q.subjectId, pageNum: q.pageNum ?? 1, pageSize: clampPageSize(q.pageSize) }
  return parseQuestionPage(await request<unknown>(`/practice/question/page${buildQuery(query)}`))
}

export async function fetchCurrent(q: CurrentQuery): Promise<QuestionCurrent> {
  const query = { subjectId: q.subjectId, mode: q.mode, questionId: q.questionId }
  return parseQuestionCurrent(await request<unknown>(`/practice/question/current${buildQuery(query)}`))
}

export async function submitAnswer(form: SubmitForm): Promise<AnswerSubmitResult> {
  return parseAnswerSubmit(await request<unknown>('/practice/answer/submit', { body: form }))
}

/** 只回 statDelta：自评的全部产出就是那份累计快照，页面用它覆盖本地统计 */
export async function selfJudge(form: SelfJudgeForm): Promise<StatDelta> {
  return parseSelfJudge(await request<unknown>('/practice/answer/self-judge', { body: form })).statDelta
}
