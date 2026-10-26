// src/composables/useSubjects.ts
import { computed, ref } from 'vue'
import { fetchSubjects } from '../api/practice/subject'
import { createSeqGuard } from '../api/practice/http'
import { errorText } from '../api/practice/errors'
import type { SubjectItem } from '../api/practice/types'
import { usePracticeStore } from '../stores/practice'

// 模块作用域：Layout、Subject、Drill、Wrong、Favorite 五个地方都要科目列表。
// 各自一份 ref 就会各发一次请求、各持一份数据，切页面时还会出现"侧栏已换、卡片没换"。
const subjects = ref<SubjectItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const guard = createSeqGuard()

export function useSubjects() {
  const store = usePracticeStore()
  const current = computed(() =>
    subjects.value.find(s => s.id === store.currentSubjectId) ?? null)

  async function reload(): Promise<void> {
    const mine = guard.next()
    loading.value = true
    error.value = null
    try {
      const list = await fetchSubjects()
      if (!guard.isCurrent(mine)) return
      subjects.value = list
      // 存的科目可能已被停用或不在启用列表里（后端对停用科目回 40900），
      // 抱着坏 id 反复打接口不如直接回落到第一科
      if (!list.some(s => s.id === store.currentSubjectId) && list.length > 0) {
        store.setSubject(list[0].id)
      }
    } catch (err) {
      if (guard.isCurrent(mine)) error.value = errorText(err) ?? '科目列表加载失败'
    } finally {
      if (guard.isCurrent(mine)) loading.value = false
    }
  }

  /** 首次进入才拉；来回切页面不重复打接口（照 AI Layout 里会话列表的做法） */
  async function ensure(): Promise<void> {
    if (subjects.value.length === 0 && !loading.value) await reload()
  }

  return { subjects, current, loading, error, reload, ensure, store }
}
