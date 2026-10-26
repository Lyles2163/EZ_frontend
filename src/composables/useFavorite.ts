// src/composables/useFavorite.ts
import { computed, ref } from 'vue'
import { fetchFavoritePage, toggleFavorite } from '../api/practice/wrongFavorite'
import { createSeqGuard } from '../api/practice/http'
import { errorText } from '../api/practice/errors'
import { clampPageSize, normalizePage, shrinkPage, type PageView } from '../api/practice/paging'
import type { FavoriteItem } from '../api/practice/types'

const SIZE = 20

export function useFavorite(getSubjectId: () => number | null) {
  const raw = ref<FavoriteItem[]>([])
  const page = ref<PageView<FavoriteItem>>({
    pageNum: 1, pageSize: SIZE, total: 0, pages: 0, list: [], hasPrev: false, hasNext: false,
  })
  const loading = ref(false)
  const error = ref<string | null>(null)
  const guard = createSeqGuard()

  async function reload(): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null) { error.value = '请先选择一个科目'; return }
    const mine = guard.next()
    loading.value = true
    error.value = null
    try {
      const vo = await fetchFavoritePage({
        subjectId, pageNum: page.value.pageNum, pageSize: clampPageSize(page.value.pageSize),
      })
      if (!guard.isCurrent(mine)) return
      raw.value = vo.list
      page.value = normalizePage(vo)
    } catch (err) {
      if (guard.isCurrent(mine)) error.value = errorText(err)
    } finally {
      if (guard.isCurrent(mine)) loading.value = false
    }
  }

  function go(delta: number): void {
    const next = page.value.pageNum + delta
    if (next < 1 || next > page.value.pages) return
    page.value = { ...page.value, pageNum: next }
    void reload()
  }

  /**
   * 收藏是同一个 toggle：后端不看写入返回值、只回读真实状态，所以这里只信 favorited=false
   * 那一次。回 true 说明这次点击把它又收藏回去了（行本来就不在库里），本地什么都不动。
   */
  async function unfavorite(questionId: number): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null) { error.value = '请先选择一个科目'; return }
    const mine = guard.next()
    error.value = null
    try {
      const stillFavorited = await toggleFavorite(subjectId, questionId)
      if (!guard.isCurrent(mine)) return
      if (!stillFavorited) {
        raw.value = raw.value.filter(r => r.questionId !== questionId)
        page.value = shrinkPage(page.value)
      }
    } catch (err) {
      if (guard.isCurrent(mine)) error.value = errorText(err)
    }
  }

  // 只读视图：页面不许往 raw 上写，本地变更只有 reload / unfavorite 两个入口
  const rows = computed(() => raw.value)

  return { rows, page, loading, error, reload, go, unfavorite }
}
