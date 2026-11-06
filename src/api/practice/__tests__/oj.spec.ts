// src/api/practice/__tests__/oj.spec.ts
import { describe, expect, it } from 'vitest'
import { HttpError } from '../../request'
import {
  OJ_LANGUAGES,
  acceptRatePercent,
  formatBytesLimit,
  isTerminal,
  parseOjProblem,
  parseOjProblemList,
  parseOjSubmission,
  parseOjSubmit,
} from '../oj'

/** 后端 GET /practice/oj/problems 的真实响应 data */
const PROBLEM_LIST_OK = [
  { id: 1, title: 'A+B Problem', difficulty: 1, timeLimitMs: 2000, memoryLimitMb: 256,
    submitCount: 12, acceptedCount: 3, acceptRate: 0.25 },
]

/** 后端 GET /practice/oj/problem/1 的真实响应 data（templateCode 可能为 null） */
const PROBLEM_OK = {
  id: 1,
  subjectId: 0,
  title: 'A+B Problem',
  description: '读入两个整数，输出它们的和。',
  templateCode: 'import java.util.Scanner;\n',
  difficulty: 1,
  timeLimitMs: 2000,
  memoryLimitMb: 256,
  maxSourceBytes: 65536,
  submitCount: 12,
  acceptedCount: 3,
  acceptRate: 0.25,
  samples: [
    { seq: 1, inputData: '1 2\n', expectedOutput: '3\n' },
    { seq: 2, inputData: '10 20\n', expectedOutput: '30\n' },
  ],
}

/** 后端 POST /practice/oj/submit 的 data */
const SUBMIT_OK = { submissionId: 42 }

/** 后端 GET /practice/oj/submission/{id} 的 data；errorMsg 非终态时为 null */
const SUBMISSION_RUNNING = {
  id: 42, status: 'RUNNING', score: 0, total: 0, timeUsedMs: 0,
  errorMsg: null, createTime: '2026-11-04T13:53:43.676+00:00',
}

const SUBMISSION_CE = {
  id: 43, status: 'CE', score: 0, total: 4, timeUsedMs: 0,
  errorMsg: 'Main.java:1: error: not a statement', createTime: '2026-11-04T13:53:43.676+00:00',
}

describe('isTerminal', () => {
  it('PENDING / RUNNING 之外都算终态', () => {
    expect(isTerminal('PENDING')).toBe(false)
    expect(isTerminal('RUNNING')).toBe(false)
    expect(isTerminal('AC')).toBe(true)
    expect(isTerminal('WA')).toBe(true)
    expect(isTerminal('CE')).toBe(true)
  })

  it('后端将来新增的状态码：当成终态，避免前端无限轮询', () => {
    expect(isTerminal('JUDGING_V2')).toBe(true)
  })
})

describe('parseOjProblemList', () => {
  it('真实样本整条通过', () => {
    const got = parseOjProblemList(PROBLEM_LIST_OK)
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({ id: 1, title: 'A+B Problem', timeLimitMs: 2000 })
  })

  it('不是数组就抛，且报文指出是哪个接口', () => {
    expect(() => parseOjProblemList({})).toThrowError(HttpError)
    expect(() => parseOjProblemList({})).toThrow(/oj\/problems/)
  })

  it('缺字段 / 类型不对都抛', () => {
    expect(() => parseOjProblemList([{ ...PROBLEM_LIST_OK[0], title: undefined }])).toThrow(/title/)
    expect(() => parseOjProblemList([{ ...PROBLEM_LIST_OK[0], timeLimitMs: '2000' }])).toThrow(/timeLimitMs/)
  })
})

describe('parseOjProblem', () => {
  it('示例用例逐条解析', () => {
    const got = parseOjProblem(PROBLEM_OK)
    expect(got.samples).toHaveLength(2)
    expect(got.samples[0]).toEqual({ seq: 1, inputData: '1 2\n', expectedOutput: '3\n' })
  })

  it('templateCode 可空：null 与缺字段都留 null，模板回退由页面负责', () => {
    expect(parseOjProblem({ ...PROBLEM_OK, templateCode: null }).templateCode).toBeNull()
    const { templateCode, ...rest } = PROBLEM_OK
    expect(parseOjProblem(rest).templateCode).toBeNull()
  })

  it('description 缺省回空串，模板直接插值不会渲染出 undefined', () => {
    const { description, ...rest } = PROBLEM_OK
    expect(parseOjProblem(rest).description).toBe('')
  })

  it('samples 不是数组就抛', () => {
    expect(() => parseOjProblem({ ...PROBLEM_OK, samples: {} })).toThrow(/samples/)
  })
})

describe('parseOjSubmit', () => {
  it('取出 submissionId', () => {
    expect(parseOjSubmit(SUBMIT_OK)).toEqual({ submissionId: 42 })
  })

  it('缺 submissionId 就抛', () => {
    expect(() => parseOjSubmit({})).toThrow(/submissionId/)
  })
})

describe('parseOjSubmission', () => {
  it('判题中：errorMsg 为 null', () => {
    expect(parseOjSubmission(SUBMISSION_RUNNING)).toMatchObject({
      id: 42, status: 'RUNNING', errorMsg: null,
    })
  })

  it('编译错误：errorMsg 原样带出，供页面直接展示', () => {
    const got = parseOjSubmission(SUBMISSION_CE)
    expect(got.status).toBe('CE')
    expect(got.score).toBe(0)
    expect(got.total).toBe(4)
    expect(got.errorMsg).toContain('not a statement')
  })

  it('数值字段缺失时回 0，不让 undefined 进模板', () => {
    const got = parseOjSubmission({ id: 1, status: 'AC' })
    expect(got.score).toBe(0)
    expect(got.total).toBe(0)
    expect(got.timeUsedMs).toBe(0)
  })
})

describe('OJ 统计与限制的展示格式化', () => {
  it('acceptRatePercent：0.375 -> 37.5%，0 与非法值一律 0.0%', () => {
    expect(acceptRatePercent(0.375)).toBe('37.5%')
    expect(acceptRatePercent(1)).toBe('100.0%')
    expect(acceptRatePercent(0)).toBe('0.0%')
    // 后端若给出 NaN/Infinity，页面上不能出现 "NaN%"
    expect(acceptRatePercent(Number.NaN)).toBe('0.0%')
    expect(acceptRatePercent(-1)).toBe('0.0%')
  })

  it('formatBytesLimit：65536 -> 64 KB，0 表示不限', () => {
    expect(formatBytesLimit(65536)).toBe('64 KB')
    expect(formatBytesLimit(2 * 1024 * 1024)).toBe('2 MB')
    expect(formatBytesLimit(0)).toBe('不限')
  })

  it('parseOjProblemList 取到统计三件套', () => {
    const got = parseOjProblemList(PROBLEM_LIST_OK)[0]
    expect(got.submitCount).toBe(12)
    expect(got.acceptedCount).toBe(3)
    expect(got.acceptRate).toBe(0.25)
  })

  it('旧后端没有统计字段时退化为 0，不让整页解析失败', () => {
    const { submitCount, acceptedCount, acceptRate, ...withoutStats } = PROBLEM_LIST_OK[0]
    const got = parseOjProblemList([withoutStats])[0]
    expect(got.submitCount).toBe(0)
    expect(got.acceptedCount).toBe(0)
    expect(got.acceptRate).toBe(0)
  })

  it('parseOjProblem 取到代码长度限制与统计', () => {
    const got = parseOjProblem(PROBLEM_OK)
    expect(got.maxSourceBytes).toBe(65536)
    expect(got.submitCount).toBe(12)
    expect(got.acceptedCount).toBe(3)
    expect(got.acceptRate).toBe(0.25)
  })

  it('缺 maxSourceBytes 时回落到默认 64 KB，限制区不会显示 undefined', () => {
    const { maxSourceBytes, ...rest } = PROBLEM_OK
    expect(parseOjProblem(rest).maxSourceBytes).toBe(65536)
  })
})

describe('OJ_LANGUAGES', () => {
  it('语言码与后端 JudgeLanguage 保持一致', () => {
    expect(OJ_LANGUAGES.map(l => l.code)).toEqual(['java', 'python3', 'cpp'])
  })

  it('每个模板都非空：切语言不能把编辑器清成空串', () => {
    for (const lang of OJ_LANGUAGES) {
      expect(lang.starter.trim().length).toBeGreaterThan(0)
    }
  })

  it('Java 模板的类名必须是 Main：判题器按 Main.java 编译', () => {
    const java = OJ_LANGUAGES.find(l => l.code === 'java')
    expect(java?.starter).toContain('public class Main')
  })
})
