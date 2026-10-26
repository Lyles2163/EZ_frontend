// src/api/practice/__tests__/types.spec.ts
import { describe, expect, it } from 'vitest'
import { HttpError } from '../../request'
import * as F from './fixtures'
import {
  parseAnswerSubmit, parseFavoritePage, parseFavoriteToggle, parseMasterFlag, parseQuestionCurrent,
  parseQuestionPage, parseSelfJudge, parseSubjectList, parseWrongPage,
} from '../types'

describe('parseSubjectList', () => {
  it('真实样本整条通过', () => {
    const got = parseSubjectList(F.SUBJECT_LIST_OK)
    expect(got.length).toBe(2)
    expect(got[0]).toMatchObject({ id: 1, name: '语文', questionCount: 4, myAccuracy: 0.7 })
    expect(got[1].lastAnswerAt).toBe(1792740125000)
  })

  it('不是数组就抛，且报文指出是哪个接口', () => {
    expect(() => parseSubjectList({})).toThrowError(HttpError)
    expect(() => parseSubjectList({})).toThrow(/subject\/list/)
  })

  it('缺字段 / 改类型 / 塞 null 都抛', () => {
    expect(() => parseSubjectList([{ ...F.SUBJECT_LIST_OK[0], name: undefined }])).toThrow(/name/)
    expect(() => parseSubjectList([{ ...F.SUBJECT_LIST_OK[0], questionCount: '4' }])).toThrow(/questionCount/)
    // myAccuracy 是不可空的 double
    expect(() => parseSubjectList([{ ...F.SUBJECT_LIST_OK[0], myAccuracy: null }])).toThrow(/myAccuracy/)
  })

  it('lastAnswerAt 可空：null 与缺字段都留 null', () => {
    expect(parseSubjectList([{ ...F.SUBJECT_LIST_OK[0], lastAnswerAt: null }])[0].lastAnswerAt).toBeNull()
    const { lastAnswerAt, ...rest } = F.SUBJECT_LIST_OK[0]
    expect(parseSubjectList([rest])[0].lastAnswerAt).toBeNull()
  })

  it('description 可空时回空串而不是 undefined（模板直接插值）', () => {
    const { description, ...rest } = F.SUBJECT_LIST_OK[0]
    expect(parseSubjectList([rest])[0].description).toBe('')
  })
})

describe('parseQuestionCurrent', () => {
  it('未做完的样本：题目、选项、上次作答都在', () => {
    const got = parseQuestionCurrent(F.QUESTION_CURRENT_OK)
    expect(got.finished).toBe(false)
    expect(got.question?.options.length).toBe(4)
    expect(got.answerStatus).toBe(2)
    expect(got.lastUserAnswerJson).toBe('"A"')
    expect(got.pendingRecordId).toBeNull()
  })

  it('finished 形态：question 与 answerStatus 都是 null，也必须通过', () => {
    const got = parseQuestionCurrent(F.QUESTION_CURRENT_FINISHED)
    expect(got.finished).toBe(true)
    expect(got.question).toBeNull()
    expect(got.answerStatus).toBeNull()
  })

  it('score 恒 null，不参与校验也不报错', () => {
    expect(parseQuestionCurrent(F.QUESTION_CURRENT_OK).question?.score).toBeNull()
  })

  it('选项少一个 optionKey → 抛，报文里能看出是 options', () => {
    const bad = {
      ...F.QUESTION_CURRENT_OK,
      question: { ...F.QUESTION_CURRENT_OK.question, options: [{ content: '只有内容' }] },
    }
    expect(() => parseQuestionCurrent(bad)).toThrow(/options/)
  })

  it('tags 混进非字符串 → 抛', () => {
    const bad = {
      ...F.QUESTION_CURRENT_OK,
      question: { ...F.QUESTION_CURRENT_OK.question, tags: [1] },
    }
    expect(() => parseQuestionCurrent(bad)).toThrow(/tags/)
  })
})

describe('parseAnswerSubmit', () => {
  it('答错样本', () => {
    const got = parseAnswerSubmit(F.SUBMIT_WRONG_OK)
    expect(got.isCorrect).toBe(false)
    expect(got.statDelta).toEqual({ total: 3, correct: 2, wrong: 1, accuracy: 0.67 })
  })

  it('待自评样本：isCorrect 是 null 而不是 false', () => {
    const got = parseAnswerSubmit(F.SUBMIT_PENDING_OK)
    expect(got.isCorrect).toBeNull()
    expect(got.needSelfJudge).toBe(true)
  })

  it('statDelta 缺失 → 抛（它是"覆盖本地统计"的唯一依据，不能容错）', () => {
    const { statDelta, ...rest } = F.SUBMIT_WRONG_OK
    expect(() => parseAnswerSubmit(rest)).toThrow(/statDelta/)
  })
})

describe('分页三个 parse', () => {
  it('非空页', () => {
    expect(parseWrongPage(F.WRONG_PAGE_OK).list[0].questionId).toBe(7)
    expect(parseFavoritePage(F.FAVORITE_PAGE_OK).total).toBe(1)
    expect(parseQuestionPage(F.QUESTION_PAGE_OK).list[1].answerStatus).toBe(3)
  })

  it('空页：total=0 pages=0 list=[]', () => {
    const got = parseWrongPage(F.WRONG_PAGE_EMPTY)
    expect(got.list).toEqual([])
    expect(got.pages).toBe(0)
  })

  it('list 不是数组 → 抛', () => {
    expect(() => parseQuestionPage({ pageNum: 1, pageSize: 20, total: 0, pages: 0, list: null })).toThrow(/list/)
  })

  it('越界页的真 total 必须照抄回来，不许因为 list 空就归零', () => {
    const beyond = { pageNum: 3, pageSize: 20, total: 21, pages: 2, list: [] }
    expect(parseQuestionPage(beyond).total).toBe(21)
  })

  it('WrongItem 的可空字段（index/lastWrongAt/lastUserAnswerJson）允许 null', () => {
    const bare = {
      pageNum: 1, pageSize: 20, total: 1, pages: 1,
      list: [{
        questionId: 1, index: null, type: 1, titleBrief: 'x',
        wrongCount: 1, lastWrongAt: null, status: 1, lastUserAnswerJson: null,
      }],
    }
    const got = parseWrongPage(bare).list[0]
    expect(got.index).toBeNull()
    expect(got.lastWrongAt).toBeNull()
    expect(got.lastUserAnswerJson).toBeNull()
  })
})

describe('三个小 parse', () => {
  it('master 只认 boolean', () => {
    expect(parseMasterFlag(true)).toBe(true)
    expect(() => parseMasterFlag('true')).toThrowError(HttpError)
    expect(() => parseMasterFlag(null)).toThrowError(HttpError)
  })

  it('toggle 要 favorited', () => {
    expect(parseFavoriteToggle(F.FAVORITE_TOGGLE_OK).favorited).toBe(true)
    expect(() => parseFavoriteToggle({})).toThrow(/favorited/)
  })

  it('self-judge 要 statDelta', () => {
    expect(parseSelfJudge(F.SELF_JUDGE_OK).statDelta.total).toBe(11)
    expect(() => parseSelfJudge({})).toThrow(/statDelta/)
  })
})

describe('answerStatus 四态常量', () => {
  it('与后端 AnswerStatus 的四个值逐一对齐', async () => {
    const c = await import('../types')
    expect([c.ANSWER_UNANSWERED, c.ANSWER_CORRECT, c.ANSWER_WRONG, c.ANSWER_PENDING]).toEqual([0, 1, 2, 3])
  })
})
