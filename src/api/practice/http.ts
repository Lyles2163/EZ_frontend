// src/api/practice/http.ts
/** 请求管道层的两个小工具：query 串拼装与"过期响应丢弃"。 */

export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    // null / undefined / 空串一律丢掉：question/current 的 subjectId 与 questionId 互斥，
    // 留下 "?questionId=" 这种半截参数等于"两个都给了"，后端一律 40000。
    if (value === null || value === undefined || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

export interface SeqGuard {
  next(): number
  isCurrent(token: number): boolean
}

/**
 * 切科目 / 切模式 / 翻页都会让在途请求过期，而 request.ts 不接受 AbortSignal。
 * 所以用序号判定：回来的那张票不是最新就整条丢掉（不写状态、不清 loading）。
 *
 * 一个 guard 只管一条并发链：答题卡与当前题同时进入页面，共用一个的话
 * 后发的那条会把先发的判成过期，答题卡永远是空的。
 */
export function createSeqGuard(): SeqGuard {
  let seq = 0
  return {
    next: () => ++seq,
    isCurrent: (token: number) => seq > 0 && token === seq,
  }
}
