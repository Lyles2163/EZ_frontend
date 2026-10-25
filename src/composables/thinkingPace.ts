// src/composables/thinkingPace.ts
/**
 * 思考行逐行放出来时的间隔算法。单独成文件、且不做任何副作用，
 * 是为了让这条"追平"规则能在 Node 里被用例钉住（useChat 本体要 Vue + Vite 变量，跑不了）。
 */

/** 队列里只剩一两条时的基准节奏（毫秒）。 */
export const PUMP_BASE_MS = 220
/** 积压很多时也不许快过这个值：再快就退化成"整块一起出现"，正是要解决的问题。 */
export const PUMP_MIN_MS = 40

/**
 * `pending` 是队列里还没放出来的行数。规则：`base / (pending - 1)`，夹在 `[min, base]`。
 * 于是积压 6 条时约 44ms 一条（快速追平），排空过程中又回到 220ms 的正常节奏。
 */
export function nextPumpDelay(
  pending: number,
  base: number = PUMP_BASE_MS,
  min: number = PUMP_MIN_MS
): number {
  if (pending <= 1) return base
  return Math.min(Math.max(Math.round(base / (pending - 1)), min), base)
}
