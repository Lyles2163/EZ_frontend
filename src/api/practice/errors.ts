// src/api/practice/errors.ts
import { AuthError, BizError, HttpError } from '../request'

/**
 * 语义唯一的码 → 固定文案。40400 是三种缺失（科目 / 题目 / 作答记录）共用的码，
 * 前端分辨不出来，此时后端那句中文反而比"固定文案"更不可信（它说的可能是科目，
 * 而用户看到的界面里没有科目这个概念），所以统一成一句诚实的话。
 */
const FIXED: Record<number, string> = {
  40100: '登录状态异常，请重新登录',
  40300: '无权操作该作答',
  40400: '内容可能已更新，请刷新重试',
}

/** 一模多义的码：后端中文 msg 才带得出具体原因，直接展示 */
const SHOW_BACKEND_MESSAGE = new Set([40000, 40900])

export function errorText(err: unknown): string | null {
  // 401/403 由 request.ts 触发清令牌跳登录，页面再挂一条错误条就是错内容
  if (err instanceof AuthError) return null
  if (err instanceof BizError) {
    if (SHOW_BACKEND_MESSAGE.has(err.code)) return err.message || `操作失败（${err.code}）`
    const fixed = FIXED[err.code]
    if (fixed) return fixed
    return err.message || `操作失败（${err.code}）`
  }
  // HttpError 的两类都要原样给出：网关没起 / 超时是真实故障，
  // "××响应格式异常：某字段"是后端契约变了，这句话本身就是排查线索
  if (err instanceof HttpError) return err.message
  return '出现了未预期的问题，请稍后重试'
}
