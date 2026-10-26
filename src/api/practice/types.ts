// src/api/practice/types.ts
/**
 * 练习侧 9 个接口的响应契约。字段逐个对齐后端 VO
 * （ezPracticeExercises/PracticeModule/src/main/java/org/leon/practicemodule/pojo/vo/），
 * 可空性按真实语义而不是按名字猜。
 *
 * 为什么运行时校验：request<T> 的泛型是纯断言，编译期之后不做任何检查。
 * 后端改字段名只会让页面把 undefined 渲染进答题卡 —— 那是"静默错"，
 * 而这里是唯一能在第一时间把它变成一条带接口名与字段名报文的地方。
 */
import { HttpError } from '../request'

export const ANSWER_UNANSWERED = 0
export const ANSWER_CORRECT = 1
export const ANSWER_WRONG = 2
/** 库里是 is_correct = -1；逐题练习的待自评靠 self-judge 回填，考试侧没有那个入口 */
export const ANSWER_PENDING = 3

export interface SubjectItem {
  id: number; name: string; subjectKey: string; icon: string; description: string;
  questionCount: number; myTotal: number; myCorrect: number;
  /** 0~1 的比值，两位小数；没答过题时 0 */
  myAccuracy: number;
  /** epoch 毫秒；未答过题时 null */
  lastAnswerAt: number | null;
}

export interface QuestionOption { optionKey: string; content: string }

export interface Question {
  questionId: number; subjectId: number; type: number; typeName: string; title: string;
  options: QuestionOption[]; difficulty: number | null; tags: string[];
  /** 按 (sort_order, id) 全序的位置序号，不是 sort_order；题目不在列表里时 null */
  index: number | null;
  /** qb_question 没有 score 列，实测恒 null；不许依赖 */
  score: number | null;
}

/** 没有 title：后端在答题态刻意不给题干，题干只能从 question/current 拿 */
export interface QuestionItem {
  index: number; questionId: number; type: number; difficulty: number | null;
  tags: string[]; answerStatus: number; favorited: boolean;
}

export interface QuestionCurrent {
  finished: boolean;
  question: Question | null;
  /** finished=true 时这一项也是 null */
  answerStatus: number | null;
  lastUserAnswerJson: string | null;
  /** 只有最近一条作答 answer_mode IN (1,3) 且 is_correct=-1 才非 null */
  pendingRecordId: number | null;
}

/** 累计快照，不是增量（后端 StatDeltaVO 的 javadoc 自己写着） */
export interface StatDelta { total: number; correct: number; wrong: number; accuracy: number }

export interface AnswerSubmitResult {
  recordId: number;
  /** 待自评时是 null，不是 false */
  isCorrect: boolean | null;
  correctAnswerJson: string; analysis: string; needSelfJudge: boolean;
  statDelta: StatDelta;
  wrongCount: number; wrongMastered: boolean;
}

export interface WrongItem {
  questionId: number; index: number | null; type: number; titleBrief: string;
  wrongCount: number; lastWrongAt: number | null; status: number; lastUserAnswerJson: string | null;
}

export interface FavoriteItem {
  questionId: number; index: number | null; type: number; titleBrief: string; createdAt: number | null;
}

/** AI 模块那边叫 items/nextCursor，这两个形状不许混着写 */
export interface PageVO<T> { pageNum: number; pageSize: number; total: number; pages: number; list: T[] }

type Obj = Record<string, unknown>

function describeValue(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function shape(where: string, detail: string): never {
  throw new HttpError(`${where} 响应格式异常：${detail}`, 0)
}

export function asObject(value: unknown, where: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    shape(where, `期望对象，实得 ${describeValue(value)}`)
  }
  return value as Obj
}

export function needNum(o: Obj, key: string, where: string): number {
  const v = o[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) shape(where, `${key} 期望数字，实得 ${describeValue(v)}`)
  return v as number
}

export function optNum(o: Obj, key: string, where: string): number | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    shape(where, `${key} 期望数字或 null，实得 ${describeValue(v)}`)
  }
  return v as number
}

export function needStr(o: Obj, key: string, where: string): string {
  const v = o[key]
  if (typeof v !== 'string') shape(where, `${key} 期望字符串，实得 ${describeValue(v)}`)
  return v
}

export function optStr(o: Obj, key: string, where: string): string | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') shape(where, `${key} 期望字符串或 null，实得 ${describeValue(v)}`)
  return v
}

export function needBool(o: Obj, key: string, where: string): boolean {
  const v = o[key]
  if (typeof v !== 'boolean') shape(where, `${key} 期望布尔，实得 ${describeValue(v)}`)
  return v
}

export function optBool(o: Obj, key: string, where: string): boolean | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== 'boolean') shape(where, `${key} 期望布尔或 null，实得 ${describeValue(v)}`)
  return v
}

export function needArray(o: Obj, key: string, where: string): unknown[] {
  const v = o[key]
  if (!Array.isArray(v)) shape(where, `${key} 期望数组，实得 ${describeValue(v)}`)
  return v
}

function needStringArray(o: Obj, key: string, where: string): string[] {
  return needArray(o, key, where).map(item => {
    if (typeof item !== 'string') shape(where, `${key} 的元素期望字符串，实得 ${describeValue(item)}`)
    return item
  })
}

interface RawPage { pageNum: number; pageSize: number; total: number; pages: number; rawList: unknown[] }

function parsePage(data: unknown, where: string): RawPage {
  const o = asObject(data, where)
  return {
    pageNum: needNum(o, 'pageNum', where), pageSize: needNum(o, 'pageSize', where),
    // 越界页后端照回"真 total + 空 list"，所以 total/pages 一律照抄，不按 list 长度推
    total: needNum(o, 'total', where), pages: needNum(o, 'pages', where),
    rawList: needArray(o, 'list', where),
  }
}

function assemble<T>(page: RawPage, list: T[]): PageVO<T> {
  return { pageNum: page.pageNum, pageSize: page.pageSize, total: page.total, pages: page.pages, list }
}

export function parseSubjectList(data: unknown): SubjectItem[] {
  const where = 'GET /practice/subject/list'
  if (!Array.isArray(data)) shape(where, `期望数组，实得 ${describeValue(data)}`)
  return (data as unknown[]).map(raw => {
    const o = asObject(raw, where)
    return {
      id: needNum(o, 'id', where), name: needStr(o, 'name', where),
      subjectKey: needStr(o, 'subjectKey', where), icon: needStr(o, 'icon', where),
      description: optStr(o, 'description', where) ?? '',
      questionCount: needNum(o, 'questionCount', where), myTotal: needNum(o, 'myTotal', where),
      myCorrect: needNum(o, 'myCorrect', where), myAccuracy: needNum(o, 'myAccuracy', where),
      lastAnswerAt: optNum(o, 'lastAnswerAt', where),
    }
  })
}

function parseQuestion(value: unknown, where: string): Question {
  const o = asObject(value, where)
  const options = needArray(o, 'options', where).map(raw => {
    const item = asObject(raw, `${where}.options`)
    return {
      optionKey: needStr(item, 'optionKey', `${where}.options`),
      content: needStr(item, 'content', `${where}.options`),
    }
  })
  return {
    questionId: needNum(o, 'questionId', where), subjectId: needNum(o, 'subjectId', where),
    type: needNum(o, 'type', where), typeName: needStr(o, 'typeName', where),
    title: needStr(o, 'title', where), options,
    difficulty: optNum(o, 'difficulty', where),
    tags: needStringArray(o, 'tags', where),
    index: optNum(o, 'index', where), score: optNum(o, 'score', where),
  }
}

export function parseQuestionPage(data: unknown): PageVO<QuestionItem> {
  const where = 'GET /practice/question/page'
  const page = parsePage(data, where)
  const list = page.rawList.map(raw => {
    const o = asObject(raw, where)
    return {
      index: needNum(o, 'index', where), questionId: needNum(o, 'questionId', where),
      type: needNum(o, 'type', where), difficulty: optNum(o, 'difficulty', where),
      tags: needStringArray(o, 'tags', where),
      answerStatus: needNum(o, 'answerStatus', where), favorited: needBool(o, 'favorited', where),
    }
  })
  return assemble(page, list)
}

export function parseQuestionCurrent(data: unknown): QuestionCurrent {
  const where = 'GET /practice/question/current'
  const o = asObject(data, where)
  const rawQuestion = o.question
  if (rawQuestion !== undefined && rawQuestion !== null && typeof rawQuestion !== 'object') {
    shape(where, `question 期望对象或 null，实得 ${describeValue(rawQuestion)}`)
  }
  return {
    finished: needBool(o, 'finished', where),
    question: rawQuestion ? parseQuestion(rawQuestion, where) : null,
    answerStatus: optNum(o, 'answerStatus', where),
    lastUserAnswerJson: optStr(o, 'lastUserAnswerJson', where),
    pendingRecordId: optNum(o, 'pendingRecordId', where),
  }
}

function parseStatDelta(o: Obj, where: string): StatDelta {
  // 缺字段与"给了但不是对象"都要在报文里点名 statDelta：它是"覆盖本地统计"的唯一依据，
  // 报文只说"期望对象"就查不出是哪一个字段坏了
  const raw = o.statDelta
  if (raw === undefined || raw === null) shape(where, `statDelta 期望对象，实得 ${describeValue(raw)}`)
  const s = asObject(raw, where)
  return {
    total: needNum(s, 'total', where), correct: needNum(s, 'correct', where),
    wrong: needNum(s, 'wrong', where), accuracy: needNum(s, 'accuracy', where),
  }
}

export function parseAnswerSubmit(data: unknown): AnswerSubmitResult {
  const where = 'POST /practice/answer/submit'
  const o = asObject(data, where)
  return {
    recordId: needNum(o, 'recordId', where),
    isCorrect: optBool(o, 'isCorrect', where),
    correctAnswerJson: needStr(o, 'correctAnswerJson', where),
    analysis: optStr(o, 'analysis', where) ?? '',
    needSelfJudge: needBool(o, 'needSelfJudge', where),
    statDelta: parseStatDelta(o, where),
    wrongCount: needNum(o, 'wrongCount', where),
    wrongMastered: needBool(o, 'wrongMastered', where),
  }
}

export function parseSelfJudge(data: unknown): { statDelta: StatDelta } {
  const where = 'POST /practice/answer/self-judge'
  return { statDelta: parseStatDelta(asObject(data, where), where) }
}

export function parseWrongPage(data: unknown): PageVO<WrongItem> {
  const where = 'GET /practice/wrong/page'
  const page = parsePage(data, where)
  const list = page.rawList.map(raw => {
    const o = asObject(raw, where)
    return {
      questionId: needNum(o, 'questionId', where), index: optNum(o, 'index', where),
      type: needNum(o, 'type', where), titleBrief: needStr(o, 'titleBrief', where),
      wrongCount: needNum(o, 'wrongCount', where), lastWrongAt: optNum(o, 'lastWrongAt', where),
      status: needNum(o, 'status', where), lastUserAnswerJson: optStr(o, 'lastUserAnswerJson', where),
    }
  })
  return assemble(page, list)
}

export function parseFavoritePage(data: unknown): PageVO<FavoriteItem> {
  const where = 'GET /practice/favorite/page'
  const page = parsePage(data, where)
  const list = page.rawList.map(raw => {
    const o = asObject(raw, where)
    return {
      questionId: needNum(o, 'questionId', where), index: optNum(o, 'index', where),
      type: needNum(o, 'type', where), titleBrief: needStr(o, 'titleBrief', where),
      createdAt: optNum(o, 'createdAt', where),
    }
  })
  return assemble(page, list)
}

export function parseFavoriteToggle(data: unknown): { favorited: boolean } {
  const where = 'POST /practice/favorite/toggle'
  return { favorited: needBool(asObject(data, where), 'favorited', where) }
}

/** Result<Boolean>：data 本身就是布尔 */
export function parseMasterFlag(data: unknown): boolean {
  const where = 'POST /practice/wrong/master'
  if (typeof data !== 'boolean') shape(where, `期望布尔，实得 ${describeValue(data)}`)
  return data
}
