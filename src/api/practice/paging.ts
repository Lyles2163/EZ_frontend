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

/**
 * 就地摘掉一行后重新收敛分页（错题本"已掌握"、收藏本"取消收藏"都走这里）。
 * 两个方向都要算：只改 total/pages 而留着旧的 hasNext，最后一页就会留下一个
 * "能点但必空"的下一页 —— 这条是被自己的测试抓出来的，不是预防性的。
 */
export function shrinkPage<T>(view: PageView<T>): PageView<T> {
  const total = Math.max(0, view.total - 1)
  const pages = Math.ceil(total / view.pageSize)
  return {
    ...view,
    total,
    pages,
    hasPrev: view.pageNum > 1,
    hasNext: pages > 0 && view.pageNum < pages,
  }
}
