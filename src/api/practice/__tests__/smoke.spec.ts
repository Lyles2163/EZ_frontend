// src/api/practice/__tests__/smoke.spec.ts
import { describe, expect, it } from 'vitest'

describe('测试床', () => {
  it('vitest 能 import 项目源码并解析 HttpError', async () => {
    const { HttpError } = await import('../../request')
    expect(new HttpError('x', 0).status).toBe(0)
  })

  it('dev 走 /gw 代理，测试必须落在同一条 BASE_URL 上', async () => {
    const { apiUrl } = await import('../../request')
    expect(apiUrl('/practice/subject/list')).toBe('/gw/practice/subject/list')
  })
})
