// src/api/practice/paging.ts
import type { PageVO } from './types'

/** 后端 PracticePages 的硬上限：超过直接 40000，所以宁可前端先夹住。 */
export const PAGE_SIZE_MAX = 100
export const DEFAULT_PAGE_SIZE = 20

export function clampPageSize(size?: number | null): number {
  if (size === null || size === undefined || !Number.isFinite(size)) return DEFAULT_PAGE_SIZE
  const int = Math.floor(size)
  if (int <= 0) return DEFAULT_PAGE_SIZE
  return Math.min(int, PAGE_SIZE_MAX)
}

export interface PageView<T> extends PageVO<T> {
  hasPrev: boolean
  hasNext: boolean
}

/**
 * 越界页后端照回"真 total + 空 list"（QuestionReadServiceImpl:69-72），
 * 所以两个方向的判据都只看 pageNum/pages，绝不能看 list 长度 ——
 * 把空 list 当"没有题"，用户就会在一个还有题的科目上看到空页。
 */
export function normalizePage<T>(vo: PageVO<T>): PageView<T> {
  return {
    ...vo,
    hasPrev: vo.pageNum > 1,
    hasNext: vo.pages > 0 && vo.pageNum < vo.pages,
  }
}
