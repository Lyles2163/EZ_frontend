// src/composables/useWrong.ts
import { computed, ref } from 'vue'
import { fetchWrongPage, markMastered } from '../api/practice/wrongFavorite'
import { createSeqGuard } from '../api/practice/http'
import { errorText } from '../api/practice/errors'
import { clampPageSize, normalizePage, shrinkPage, type PageView } from '../api/practice/paging'
import type { WrongItem } from '../api/practice/types'

/** null = 全部；后端只认 1/2，其它一律 40000（WrongBookServiceImpl:52-54） */
export type WrongFilter = 1 | 2 | null

const SIZE = 20

export function useWrong(getSubjectId: () => number | null) {
  const raw = ref<WrongItem[]>([])
  const page = ref<PageView<WrongItem>>({
    pageNum: 1, pageSize: SIZE, total: 0, pages: 0, list: [], hasPrev: false, hasNext: false,
  })
  const status = ref<WrongFilter>(null)
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
      const vo = await fetchWrongPage({
        subjectId, status: status.value ?? undefined,
        pageNum: page.value.pageNum, pageSize: clampPageSize(page.value.pageSize),
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

  function setStatus(value: WrongFilter): void {
    status.value = value
    // 换筛选条件还停在第 3 页 = 一屏空白，必须回第 1 页
    page.value = { ...page.value, pageNum: 1 }
    void reload()
  }

  /** 成功后本地摘掉那一行并收敛 total/pages：整页重拉会让用户以为没生效 */
  async function master(questionId: number): Promise<void> {
    const mine = guard.next()
    error.value = null
    try {
      const ok = await markMastered(questionId)
      if (!guard.isCurrent(mine)) return
      if (ok) {
        raw.value = raw.value.filter(r => r.questionId !== questionId)
        page.value = shrinkPage(page.value)
      }
    } catch (err) {
      if (guard.isCurrent(mine)) error.value = errorText(err)
    }
  }

  const rows = computed(() => raw.value.map(r => ({ ...r, mastered: r.status === 2 })))

  return { rows, page, status, loading, error, reload, master, setStatus, go }
}
