<!-- src/views/Practice/Wrong.vue -->
<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../../components/practice/EmptyState.vue'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import { useSubjects } from '../../composables/useSubjects'
import { useWrong, type WrongFilter } from '../../composables/useWrong'
import { formatDateTime } from '../../utils/datetime'

const router = useRouter()
const { current: currentSubject, ensure } = useSubjects()
const wrong = useWrong(() => currentSubject.value?.id ?? null)

const FILTERS: { value: WrongFilter; label: string }[] = [
  { value: null, label: '全部' },
  { value: 1, label: '未掌握' },
  { value: 2, label: '已掌握' },
]

/** 只有 total=0 才是"这个筛选下真的没有"：越界页的 list 也是空的，但那一页还有题 */
const isEmpty = computed(() => !wrong.loading.value && wrong.page.value.total === 0)

onMounted(async () => {
  await ensure()
  if (currentSubject.value) await wrong.reload()
})

// 侧栏换科时组件不重挂，不监听就会停在上一科的错题上（和 Drill.vue 同一个坑）
watch(() => currentSubject.value?.id, () => void wrong.reload())

function redo(questionId: number): void {
  void router.push({ name: 'practice-drill', query: { questionId: String(questionId) } })
}
</script>

<template>
  <section class="wrong">
    <header class="head">
      <h1 class="title">{{ currentSubject?.name ?? '未选题' }} · 错题本</h1>
      <div class="filters">
        <button v-for="f in FILTERS" :key="f.label" class="chip"
                :class="{ 'chip--on': wrong.status.value === f.value }"
                type="button" @click="wrong.setStatus(f.value)">{{ f.label }}</button>
      </div>
    </header>

    <ErrorBar v-if="wrong.error.value" :message="wrong.error.value"
              @dismiss="wrong.error.value = null" />

    <EmptyState v-if="isEmpty"
                title="这个筛选下没有错题"
                hint="答错的题会进这里；重做对了以后可以标成已掌握。" />

    <ul v-else class="list">
      <li v-for="r in wrong.rows.value" :key="r.questionId" class="row glass-lite">
        <div class="main-col">
          <p class="line1">
            <span class="idx">第 {{ r.index ?? '—' }} 题</span>
            <span class="type">题型 {{ r.type }}</span>
            <span class="count">错 {{ r.wrongCount }} 次</span>
            <span v-if="r.mastered" class="ok">已掌握</span>
          </p>
          <p class="brief">{{ r.titleBrief }}</p>
          <p class="meta">上次答错：{{ formatDateTime(r.lastWrongAt) }}</p>
        </div>
        <div class="acts">
          <button class="ghost" type="button" @click="redo(r.questionId)">重做</button>
          <button v-if="!r.mastered" class="primary" type="button"
                  @click="wrong.master(r.questionId)">已掌握</button>
        </div>
      </li>
    </ul>

    <footer class="pager">
      <button class="ghost" type="button" :disabled="!wrong.page.value.hasPrev"
              @click="wrong.go(-1)">上一页</button>
      <span class="page-no">{{ wrong.page.value.pageNum }} / {{ wrong.page.value.pages || 1 }}</span>
      <button class="ghost" type="button" :disabled="!wrong.page.value.hasNext"
              @click="wrong.go(1)">下一页</button>
    </footer>
  </section>
</template>

<style scoped>
.wrong { display: flex; flex-direction: column; gap: 14px; }
.head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.title { margin: 0; font-size: 17px; flex: 1; min-width: 0; }
.filters { display: flex; gap: 6px; }
.chip {
  padding: 7px 13px; border: 1px solid var(--divider); border-radius: 999px;
  background: var(--p-idle); color: var(--text-secondary); font: inherit; cursor: pointer;
}
.chip--on { border-color: var(--primary-500); color: var(--text-primary); font-weight: 600; }
.list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.row {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border: 1px solid var(--divider); border-radius: 12px;
}
.main-col { flex: 1; min-width: 0; }
.line1 { display: flex; gap: 10px; margin: 0 0 4px; font-size: 12px; color: var(--text-muted); }
.ok { color: var(--p-correct); }
.brief { margin: 0; font-size: 14px; }
.meta { margin: 4px 0 0; font-size: 12px; color: var(--text-muted); }
.acts { display: flex; gap: 8px; flex: none; }
.ghost, .primary {
  padding: 7px 13px; border-radius: 9px; font: inherit; cursor: pointer;
  border: 1px solid var(--divider); background: var(--p-idle); color: var(--text-secondary);
}
.primary { background: var(--primary-500); border-color: var(--primary-500); color: var(--primary-contrast); }
.ghost:disabled { opacity: .6; cursor: default; }
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; }
.page-no { font-size: 12px; color: var(--text-muted); }
</style>
