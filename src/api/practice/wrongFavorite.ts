// src/api/practice/wrongFavorite.ts
import { request } from '../request'
import { buildQuery } from './http'
import { clampPageSize } from './paging'
import {
  parseFavoritePage, parseFavoriteToggle, parseMasterFlag, parseWrongPage,
  type FavoriteItem, type PageVO, type WrongItem,
} from './types'

export interface WrongQuery { subjectId: number; status?: 1 | 2; pageNum?: number; pageSize?: number }
export interface FavoriteQuery { subjectId: number; pageNum?: number; pageSize?: number }

/** status 是"省略 = 全部"，所以 null/undefined 必须由 buildQuery 整颗丢掉，不能发 status= */
export async function fetchWrongPage(q: WrongQuery): Promise<PageVO<WrongItem>> {
  const query = {
    subjectId: q.subjectId, status: q.status,
    pageNum: q.pageNum ?? 1, pageSize: clampPageSize(q.pageSize),
  }
  return parseWrongPage(await request<unknown>(`/practice/wrong/page${buildQuery(query)}`))
}

/** 只有 questionId：科目归属从错题行来（后端 WrongMasterReq 就这一个字段） */
export async function markMastered(questionId: number): Promise<boolean> {
  return parseMasterFlag(await request<unknown>('/practice/wrong/master', { body: { questionId } }))
}

export async function fetchFavoritePage(q: FavoriteQuery): Promise<PageVO<FavoriteItem>> {
  const query = { subjectId: q.subjectId, pageNum: q.pageNum ?? 1, pageSize: clampPageSize(q.pageSize) }
  return parseFavoritePage(await request<unknown>(`/practice/favorite/page${buildQuery(query)}`))
}

/** 后端不看插入返回值、只回读真实状态，所以这里也只信响应里的 favorited */
export async function toggleFavorite(subjectId: number, questionId: number): Promise<boolean> {
  return parseFavoriteToggle(
    await request<unknown>('/practice/favorite/toggle', { body: { subjectId, questionId } }),
  ).favorited
}
