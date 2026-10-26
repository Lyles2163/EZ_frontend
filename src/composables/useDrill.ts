// src/composables/useDrill.ts
import { computed, ref } from 'vue'
import {
  fetchCurrent, fetchQuestionPage, selfJudge as selfJudgeApi, submitAnswer,
  type CurrentQuery, type SubmitForm,
} from '../api/practice/question'
import { toggleFavorite } from '../api/practice/wrongFavorite'
import { createSeqGuard } from '../api/practice/http'
import { errorText } from '../api/practice/errors'
import { clampPageSize, normalizePage } from '../api/practice/paging'
import {
  canSelfJudge, cardState, cardStateAfterSubmit, clampDuration, decodeUserAnswer,
  encodeUserAnswer, initialModel, type AnswerValue, type CardState,
} from '../api/practice/answer'
import {
  ANSWER_CORRECT, ANSWER_PENDING, ANSWER_WRONG,
  type AnswerSubmitResult, type Question, type QuestionCurrent, type StatDelta,
} from '../api/practice/types'

export type DrillTarget = { kind: 'mode'; mode: 1 | 3 } | { kind: 'question'; questionId: number }

export interface DrillCardCell {
  index: number
  questionId: number
  state: CardState
}

interface RawCell { index: number; questionId: number; answerStatus: number; favorited: boolean }

/**
 * 三个独立的 seq guard，不是一个。
 * 进页面时 loadCard 与 open 是**并发**的两条请求，共用一个 guard 的话后发的那条
 * 会把先发的判成过期 —— 表现是"答题卡永远空，而单测照样绿"。
 */
export function useDrill(getSubjectId: () => number | null) {
  const target = ref<DrillTarget>({ kind: 'mode', mode: 1 })
  const mode = computed<1 | 3>(() => (target.value.kind === 'mode' ? target.value.mode : 1))

  const rawCells = ref<RawCell[]>([])
  const question = ref<Question | null>(null)
  const answerStatus = ref<number | null>(null)
  const pendingRecordId = ref<number | null>(null)
  const model = ref<AnswerValue>(null)
  const result = ref<AnswerSubmitResult | null>(null)
  const revealed = ref(false)
  const judgedTip = ref<string | null>(null)
  const finished = ref(false)
  const loading = ref(false)
  const busy = ref(false)
  const judging = ref(false)
  const error = ref<string | null>(null)
  const stat = ref<StatDelta | null>(null)
  const favorited = ref(false)

  const cardGuard = createSeqGuard()
  const flowGuard = createSeqGuard()
  const favGuard = createSeqGuard()
  let startAt = Date.now()

  const cardCells = computed<DrillCardCell[]>(() =>
    rawCells.value.map(c => ({ index: c.index, questionId: c.questionId, state: cardState(c.answerStatus) })))

  const currentId = computed(() => question.value?.questionId ?? null)

  const canJudge = computed(() =>
    result.value !== null
      ? result.value.needSelfJudge
      : canSelfJudge(answerStatus.value, pendingRecordId.value))

  /**
   * 裁定七：待自评且还没判完时，参考答案与解析都不渲染。
   * 后端那一刻是**给了** correctAnswerJson 的（AnswerServiceImpl 无条件 set），
   * 所以这条只能靠这里守住；改成 v-if="result" 就等于把裁定七擦掉。
   */
  const showAnswer = computed(() => {
    if (!result.value) return false
    return !result.value.needSelfJudge || revealed.value
  })

  function applyCurrent(cur: QuestionCurrent): void {
    finished.value = cur.finished
    pendingRecordId.value = cur.pendingRecordId
    const current = cur.question
    question.value = current
    answerStatus.value = cur.answerStatus
    // 上次作答优先；坏数据（decode 回 null）退回该题型的默认初值
    model.value = current
      ? decodeUserAnswer(current.type, cur.lastUserAnswerJson) ?? initialModel(current.type, current.title)
      : null
    result.value = null
    revealed.value = false
    judgedTip.value = null
    favorited.value = current
      ? rawCells.value.some(c => c.questionId === current.questionId && c.favorited)
      : false
    startAt = Date.now()
  }

  function patchCell(questionId: number, state: CardState): void {
    const back: Record<CardState, number> = { idle: 0, correct: 1, wrong: 2, pending: ANSWER_PENDING }
    rawCells.value = rawCells.value.map(c =>
      c.questionId === questionId ? { ...c, answerStatus: back[state] } : c)
  }

  async function loadCard(): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null) { error.value = '请先选择一个科目'; return }
    const mine = cardGuard.next()
    try {
      const vo = await fetchQuestionPage({ subjectId, pageNum: 1, pageSize: clampPageSize(100) })
      if (!cardGuard.isCurrent(mine)) return
      const page = normalizePage(vo)
      rawCells.value = page.list.map(item => ({
        index: item.index, questionId: item.questionId,
        answerStatus: item.answerStatus, favorited: item.favorited,
      }))
    } catch (err) {
      if (cardGuard.isCurrent(mine)) error.value = errorText(err)
    }
  }

  async function open(next: DrillTarget): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null) { error.value = '请先选择一个科目'; return }
    target.value = next
    const mine = flowGuard.next()
    loading.value = true
    // 换题就是一次新的开始：上一题那次提交的响应会被 flowGuard 丢掉，
    // 它的 finally 也就再也不会把 busy 归零 —— 不在这里清，按钮会永远停在"提交中…"
    busy.value = false
    error.value = null
    try {
      // 参数形态由判别式决定：重做流只给 questionId，两个都给后端回 40000
      const query: CurrentQuery = next.kind === 'question'
        ? { questionId: next.questionId }
        : { subjectId, mode: next.mode }
      const cur = await fetchCurrent(query)
      if (!flowGuard.isCurrent(mine)) return
      applyCurrent(cur)
    } catch (err) {
      if (flowGuard.isCurrent(mine)) error.value = errorText(err)
    } finally {
      if (flowGuard.isCurrent(mine)) loading.value = false
    }
  }

  async function submit(): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null || !question.value) return
    const questionId = question.value.questionId
    let userAnswerJson: string
    try {
      userAnswerJson = encodeUserAnswer(question.value.type, model.value)
    } catch (err) {
      // 空作答在前端就拦住，不打后端（后端那句"答案不能为空"是 40000）
      error.value = errorText(err) ?? '请先作答'
      return
    }
    const form: SubmitForm = {
      subjectId, questionId, userAnswerJson,
      durationMs: clampDuration(Date.now() - startAt), mode: mode.value,
    }
    const mine = flowGuard.next()
    busy.value = true
    error.value = null
    try {
      const got = await submitAnswer(form)
      if (!flowGuard.isCurrent(mine)) return
      result.value = got
      revealed.value = !got.needSelfJudge
      stat.value = got.statDelta          // 累计快照，覆盖而不是相加
      patchCell(questionId, cardStateAfterSubmit(got))
    } catch (err) {
      if (flowGuard.isCurrent(mine)) error.value = errorText(err)
    } finally {
      if (flowGuard.isCurrent(mine)) busy.value = false
    }
  }

  /**
   * recordId 有两个来源：本轮 submit 的返回，或刷新后 current 的 pendingRecordId。
   * 参考答案与解析只在 answer/submit 的响应里给（question/current 是答题态、不含真值），
   * 所以刷新后来自评只能更新态与统计，没有答案可展开 —— 靠 judgedTip 给反馈。
   */
  async function judge(isCorrect: boolean): Promise<void> {
    const subjectId = getSubjectId()
    const recordId = result.value?.recordId ?? pendingRecordId.value
    if (subjectId === null || !question.value || recordId === null) return
    const questionId = question.value.questionId
    const mine = flowGuard.next()
    judging.value = true
    error.value = null
    try {
      const got = await selfJudgeApi({ subjectId, questionId, recordId, isCorrect })
      if (!flowGuard.isCurrent(mine)) return
      stat.value = got
      pendingRecordId.value = null
      answerStatus.value = isCorrect ? ANSWER_CORRECT : ANSWER_WRONG
      patchCell(questionId, isCorrect ? 'correct' : 'wrong')
      judgedTip.value = isCorrect ? '已记录自评：答对' : '已记录自评：答错'
      if (result.value) {
        // 本轮提交过才有答案与解析可展开，措辞也从"请自评"收敛成结果
        result.value = { ...result.value, isCorrect, needSelfJudge: false }
        revealed.value = true
      }
    } catch (err) {
      if (flowGuard.isCurrent(mine)) error.value = errorText(err)
    } finally {
      if (flowGuard.isCurrent(mine)) judging.value = false
    }
  }

  async function toggleFav(): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null || !question.value) return
    const questionId = question.value.questionId
    const mine = favGuard.next()
    try {
      const now = await toggleFavorite(subjectId, questionId)
      if (!favGuard.isCurrent(mine)) return
      favorited.value = now
      rawCells.value = rawCells.value.map(c =>
        c.questionId === questionId ? { ...c, favorited: now } : c)
    } catch (err) {
      if (favGuard.isCurrent(mine)) error.value = errorText(err)
    }
  }

  return {
    target, mode, cardCells, question, answerStatus, model, result, revealed, judgedTip,
    finished, loading, busy, judging, error, stat, favorited, canJudge, showAnswer,
    currentId, pendingRecordId, loadCard, open, submit, judge, toggleFav,
  }
}
