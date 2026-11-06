// src/composables/useRagKb.ts
/**
 * 知识库文档管理的状态持有处。页面只读它，不自己攒列表/上传态。
 *
 * 两个刻意的设计：
 * 1. 游标分页用 beforeId 而不是页码 —— 后端 list 接口就是这个契约（按 id 降序 + lt 游标），
 *    前端硬凑页码要么改后端要么自己缓存全量，都不值得。
 * 2. 上传是同步接口，要等 embedding 跑完才返回。所以 uploading 期间必须挡住重复提交，
 *    且上传成功后要刷新列表（新文档排在最前，正好在第一页）。
 */
import { computed, ref } from 'vue'
import { createSeqGuard } from '../api/practice/http'
import { errorText } from '../api/practice/errors'
import {
  deleteDocument,
  listChunks,
  listDocuments,
  reindexDocument,
  uploadDocument,
  type DocStatus,
  type RagChunk,
  type RagDoc,
  type UploadForm,
} from '../api/ragKb'

const PAGE_SIZE = 20

export function useRagKb() {
  const docs = ref<RagDoc[]>([])
  const loading = ref(false)
  const uploading = ref(false)
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)

  /** 状态筛选：'' 表示全部 */
  const statusFilter = ref<DocStatus | ''>('')
  /** 分页栈：每页第一条之前的游标。栈空表示在第一页 */
  const cursors = ref<Array<number | null>>([])

  const guard = createSeqGuard()

  /** 当前页的游标 = 栈顶；第一页是 null */
  const beforeId = computed<number | null>(() =>
    cursors.value.length ? cursors.value[cursors.value.length - 1] : null
  )
  const canPrev = computed(() => cursors.value.length > 0)
  /** 满页说明可能还有下一页（后端不返回 hasMore，只能用"是否满页"推断） */
  const canNext = computed(() => docs.value.length >= PAGE_SIZE)
  const pageNo = computed(() => cursors.value.length + 1)

  async function reload(): Promise<void> {
    const mine = guard.next()
    loading.value = true
    error.value = null
    try {
      const list = await listDocuments({
        status: statusFilter.value,
        beforeId: beforeId.value,
        limit: PAGE_SIZE,
      })
      // 过期响应整条丢弃：快速点上一页/下一页时，慢的那条回来会覆盖新页面
      if (!guard.isCurrent(mine)) return
      docs.value = list
    } catch (err) {
      if (guard.isCurrent(mine)) error.value = errorText(err)
    } finally {
      if (guard.isCurrent(mine)) loading.value = false
    }
  }

  /** 换筛选条件回到第一页：带着旧游标查新条件会得到空页 */
  function setStatusFilter(value: DocStatus | ''): void {
    statusFilter.value = value
    cursors.value = []
    void reload()
  }

  /** 下一页游标 = 本页最后一条的 id */
  function goNext(): void {
    if (!canNext.value) return
    const last = docs.value[docs.value.length - 1]
    if (!last) return
    cursors.value = [...cursors.value, last.id]
    void reload()
  }

  function goPrev(): void {
    if (!canPrev.value) return
    cursors.value = cursors.value.slice(0, -1)
    void reload()
  }

  async function upload(form: UploadForm): Promise<boolean> {
    if (uploading.value) return false
    uploading.value = true
    error.value = null
    notice.value = null
    try {
      const doc = await uploadDocument(form)
      notice.value = `「${doc.title || doc.fileName}」入库完成，切出 ${doc.chunkCount} 片`
      // 回第一页看新文档：它 id 最大，降序排在最前
      cursors.value = []
      statusFilter.value = ''
      await reload()
      return true
    } catch (err) {
      error.value = errorText(err)
      return false
    } finally {
      uploading.value = false
    }
  }

  async function remove(id: number): Promise<boolean> {
    error.value = null
    notice.value = null
    try {
      await deleteDocument(id)
      notice.value = '文档已删除，检索结果同步清理'
      // 就地移除：删一条就整页重拉会让列表闪一下，且可能因为游标错位少显示一条
      docs.value = docs.value.filter(d => d.id !== id)
      return true
    } catch (err) {
      error.value = errorText(err)
      return false
    }
  }

  async function reindex(id: number): Promise<boolean> {
    error.value = null
    notice.value = null
    try {
      const doc = await reindexDocument(id)
      notice.value = `「${doc.title || doc.fileName}」重放完成，累计 ${doc.chunkCount} 片可检索`
      // 只替换这一行：重放不改排序位置（id 不变），整页重拉没必要
      docs.value = docs.value.map(d => (d.id === id ? doc : d))
      return true
    } catch (err) {
      error.value = errorText(err)
      return false
    }
  }

  /** 切片明细：展开某文档时才拉，列表页不需要 */
  const chunksOf = ref<RagChunk[]>([])
  const chunksLoading = ref(false)
  const expandedId = ref<number | null>(null)

  async function toggleChunks(id: number): Promise<void> {
    if (expandedId.value === id) {
      expandedId.value = null
      chunksOf.value = []
      return
    }
    expandedId.value = id
    chunksOf.value = []
    chunksLoading.value = true
    error.value = null
    try {
      chunksOf.value = await listChunks(id)
    } catch (err) {
      error.value = errorText(err)
      expandedId.value = null
    } finally {
      chunksLoading.value = false
    }
  }

  return {
    docs,
    loading,
    uploading,
    error,
    notice,
    statusFilter,
    setStatusFilter,
    canPrev,
    canNext,
    pageNo,
    reload,
    goNext,
    goPrev,
    upload,
    remove,
    reindex,
    chunksOf,
    chunksLoading,
    expandedId,
    toggleChunks,
    pageSize: PAGE_SIZE,
  }
}

export type RagKb = ReturnType<typeof useRagKb>
