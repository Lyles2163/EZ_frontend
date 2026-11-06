// src/api/practice/oj.ts
/**
 * 在线判题（OJ）的响应契约与调用。
 * 字段对齐 ezPracticeExercises/PracticeModule/.../oj/pojo/vo/ 下的 record，
 * 校验风格与 ./types.ts 一致：泛型只是编译期断言，真正兜底的是这里的运行时检查。
 */
import { HttpError, request } from '../request'
import { asObject, needArray, needNum, needStr, optNum, optStr } from './types'

/** 后端 oj_submission.status 的全部取值；PENDING/RUNNING 之外都是终态 */
export const OJ_STATUSES = ['PENDING', 'RUNNING', 'AC', 'WA', 'TLE', 'MLE', 'CE', 'RE', 'SE'] as const
export type OjStatus = (typeof OJ_STATUSES)[number]

/**
 * 只有请求还没落地/正在判时才需要继续轮询。
 * 判题状态可能出现后端新增取值，这里用"排除法"而不是白名单：
 * 未知状态一律当成终态，避免前端对着一个永远不变的状态死循环轮询。
 */
export function isTerminal(status: string): boolean {
  return status !== 'PENDING' && status !== 'RUNNING'
}

export const OJ_STATUS_TEXT: Record<string, string> = {
  PENDING: '排队中',
  RUNNING: '判题中',
  AC: '通过',
  WA: '答案错误',
  TLE: '超时',
  MLE: '内存超限',
  CE: '编译错误',
  RE: '运行错误',
  SE: '系统错误',
}

/** 判题结果四态配色，与 Practice/Layout.vue 里定义的状态色变量对应 */
export const OJ_STATUS_TONE: Record<string, 'idle' | 'correct' | 'wrong' | 'pending'> = {
  PENDING: 'pending',
  RUNNING: 'pending',
  AC: 'correct',
  WA: 'wrong',
  TLE: 'wrong',
  MLE: 'wrong',
  CE: 'wrong',
  RE: 'wrong',
  SE: 'wrong',
}

export interface OjLanguageOption {
  code: string
  label: string
  /** 切语言时贴进编辑器的起步模板，避免用户从空白的 "class Main" 开始猜类名 */
  starter: string
}

/**
 * 判题器按文件名 + 编译命令识别语言（后端 JudgeLanguage），
 * 所以这里每个模板都必须是「Main.java / main.py / main.cpp」这一套约定的形状。
 */
export const OJ_LANGUAGES: OjLanguageOption[] = [
  {
    code: 'java',
    label: 'Java 17',
    starter: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        // 从标准输入读，向标准输出打印
    }
}
`,
  },
  {
    code: 'python3',
    label: 'Python 3.11',
    starter: `import sys

data = sys.stdin.read().split()
# 从标准输入读，向标准输出打印
`,
  },
  {
    code: 'cpp',
    label: 'C++17',
    starter: `#include <iostream>

int main() {
    long long a = 0;
    // 从标准输入读，向标准输出打印
    return 0;
}
`,
  },
]

export interface OjProblemItem {
  id: number
  title: string
  difficulty: number
  timeLimitMs: number
  memoryLimitMb: number
  /** 该题总提交次数（全站口径，不是当前用户） */
  submitCount: number
  /** 其中判为 AC 的次数；同一人多次 AC 各算一次 */
  acceptedCount: number
  /** 0~1，两位小数。等于 acceptedCount / submitCount，提交数为 0 时是 0 */
  acceptRate: number
}

export interface OjSample {
  seq: number
  inputData: string
  expectedOutput: string
}

export interface OjProblem {
  id: number
  subjectId: number
  title: string
  description: string
  /** 库里可能为空：没写模板时前端用语言自带的起步模板 */
  templateCode: string | null
  difficulty: number
  timeLimitMs: number
  memoryLimitMb: number
  /** 源码字节上限，后端 oj.sandbox.max-source-bytes；超了提交会被拒 */
  maxSourceBytes: number
  submitCount: number
  acceptedCount: number
  acceptRate: number
  /** 后端只下发 is_sample=1 的用例，隐藏用例不会出现在这里 */
  samples: OjSample[]
}

export const OJ_DIFFICULTY_TEXT: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' }

/** 通过率展示成一位小数百分比：0.375 -> "37.5%" */
export function acceptRatePercent(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return '0.0%'
  return `${(rate * 100).toFixed(1)}%`
}

/** 字节上限换成 KB/MB 文案；配置成 0 或负数表示不限 */
export function formatBytesLimit(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '不限'
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export interface OjSubmission {
  id: number
  status: string
  score: number
  total: number
  timeUsedMs: number
  errorMsg: string | null
  createTime: string | null
}

export interface OjSubmitForm {
  problemId: number
  language: string
  sourceCode: string
}

function badShape(where: string, detail: string): never {
  // 与 ./types.ts 的 shape() 同款报文：接口名 + 字段名 + 实得类型，
  // 这三个信息是排查"后端改了字段名"的最短路径
  throw new HttpError(`${where} 响应格式异常：${detail}`, 0)
}

function describeValue(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function parseProblemItem(raw: unknown, where: string): OjProblemItem {
  const o = asObject(raw, where)
  return {
    id: needNum(o, 'id', where),
    title: needStr(o, 'title', where),
    difficulty: needNum(o, 'difficulty', where),
    timeLimitMs: needNum(o, 'timeLimitMs', where),
    memoryLimitMb: needNum(o, 'memoryLimitMb', where),
    // 统计是"增量展示"：后端还没升级时不至于让整页解析失败，退化成 0
    submitCount: optNum(o, 'submitCount', where) ?? 0,
    acceptedCount: optNum(o, 'acceptedCount', where) ?? 0,
    acceptRate: optNum(o, 'acceptRate', where) ?? 0,
  }
}

export function parseOjProblemList(data: unknown): OjProblemItem[] {
  const where = 'GET /practice/oj/problems'
  if (!Array.isArray(data)) {
    // Result.data 本身就是数组，不能用 needArray（那是取对象字段的）
    badShape(where, `期望数组，实得 ${describeValue(data)}`)
  }
  return (data as unknown[]).map(raw => parseProblemItem(raw, where))
}

export function parseOjProblem(data: unknown): OjProblem {
  const where = 'GET /practice/oj/problem/{id}'
  const o = asObject(data, where)
  const rawSamples = needArray(o, 'samples', where)
  return {
    id: needNum(o, 'id', where),
    subjectId: needNum(o, 'subjectId', where),
    title: needStr(o, 'title', where),
    description: optStr(o, 'description', where) ?? '',
    templateCode: optStr(o, 'templateCode', where),
    difficulty: needNum(o, 'difficulty', where),
    timeLimitMs: needNum(o, 'timeLimitMs', where),
    memoryLimitMb: needNum(o, 'memoryLimitMb', where),
    maxSourceBytes: optNum(o, 'maxSourceBytes', where) ?? 65536,
    submitCount: optNum(o, 'submitCount', where) ?? 0,
    acceptedCount: optNum(o, 'acceptedCount', where) ?? 0,
    acceptRate: optNum(o, 'acceptRate', where) ?? 0,
    samples: rawSamples.map(raw => {
      const s = asObject(raw, `${where}.samples`)
      return {
        seq: needNum(s, 'seq', `${where}.samples`),
        inputData: optStr(s, 'inputData', `${where}.samples`) ?? '',
        expectedOutput: needStr(s, 'expectedOutput', `${where}.samples`),
      }
    }),
  }
}

export function parseOjSubmit(data: unknown): { submissionId: number } {
  const where = 'POST /practice/oj/submit'
  return { submissionId: needNum(asObject(data, where), 'submissionId', where) }
}

export function parseOjSubmission(data: unknown): OjSubmission {
  const where = 'GET /practice/oj/submission/{id}'
  const o = asObject(data, where)
  return {
    id: needNum(o, 'id', where),
    status: needStr(o, 'status', where),
    score: optNum(o, 'score', where) ?? 0,
    total: optNum(o, 'total', where) ?? 0,
    timeUsedMs: optNum(o, 'timeUsedMs', where) ?? 0,
    errorMsg: optStr(o, 'errorMsg', where),
    createTime: optStr(o, 'createTime', where),
  }
}

export async function fetchOjProblems(): Promise<OjProblemItem[]> {
  return parseOjProblemList(await request<unknown>('/practice/oj/problems'))
}

export async function fetchOjProblem(id: number): Promise<OjProblem> {
  return parseOjProblem(await request<unknown>(`/practice/oj/problem/${id}`))
}

export async function submitOjSolution(form: OjSubmitForm): Promise<{ submissionId: number }> {
  return parseOjSubmit(await request<unknown>('/practice/oj/submit', { body: form }))
}

export async function fetchOjSubmission(id: number): Promise<OjSubmission> {
  return parseOjSubmission(await request<unknown>(`/practice/oj/submission/${id}`))
}
