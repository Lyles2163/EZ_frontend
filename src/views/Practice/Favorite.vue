<!-- src/views/Practice/Favorite.vue -->
<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../../components/practice/EmptyState.vue'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import { useFavorite } from '../../composables/useFavorite'
import { useSubjects } from '../../composables/useSubjects'
import { formatDateTime } from '../../utils/datetime'

const router = useRouter()
const { current: currentSubject, ensure } = useSubjects()
const fav = useFavorite(() => currentSubject.value?.id ?? null)

/** 只有 total=0 才是真的没收藏：越界页的 list 也空，但那一页还有题 */
const isEmpty = computed(() => !fav.loading.value && fav.page.value.total === 0)

/**
 * 首屏与换科走同一个 watch：`immediate` 让"科目已经在缓存里"这种情况也发一次，
 * loadedFor 挡住重复的那一次 —— 少了它，ensure() 把 currentSubject 从 null 填成第一科时
 * watch 会再触发一次，首屏就打两次 favorite/page（浏览器网络面板实测到过，是这次修掉的）。
 */
let loadedFor: number | null = null

async function load(): Promise<void> {
  loadedFor = currentSubject.value?.id ?? null
  await fav.reload()
}

onMounted(() => { void ensure() })

watch(() => currentSubject.value?.id, id => {
  if (id !== null && id !== loadedFor) void load()
}, { immediate: true })

function redo(questionId: number): void {
  void router.push({ name: 'practice-drill', query: { questionId: String(questionId) } })
}
</script>

<template>
  <section class="fav">
    <header class="head">
      <h1 class="title">{{ currentSubject?.name ?? '未选题' }} · 收藏本</h1>
      <button class="ghost" type="button" :disabled="fav.loading.value" @click="fav.reload()">
        {{ fav.loading.value ? '加载中…' : '刷新' }}
      </button>
    </header>

    <ErrorBar v-if="fav.error.value" :message="fav.error.value" @dismiss="fav.error.value = null" />

    <EmptyState v-if="isEmpty" title="还没有收藏的题目" hint="在练习页右上点「收藏本题」就会进这里。" />

    <ul v-else class="list">
      <li v-for="r in fav.rows.value" :key="r.questionId" class="row glass-lite">
        <div class="main-col">
          <p class="line1">
            <span class="idx">第 {{ r.index ?? '—' }} 题</span>
            <span class="type">题型 {{ r.type }}</span>
          </p>
          <p class="brief">{{ r.titleBrief }}</p>
          <p class="meta">收藏于 {{ formatDateTime(r.createdAt) }}</p>
        </div>
        <div class="acts">
          <button class="ghost" type="button" @click="redo(r.questionId)">重做</button>
          <button class="primary" type="button" @click="fav.unfavorite(r.questionId)">取消收藏</button>
        </div>
      </li>
    </ul>

    <footer class="pager">
      <button class="ghost" type="button" :disabled="!fav.page.value.hasPrev"
              @click="fav.go(-1)">上一页</button>
      <span class="page-no">{{ fav.page.value.pageNum }} / {{ fav.page.value.pages || 1 }}</span>
      <button class="ghost" type="button" :disabled="!fav.page.value.hasNext"
              @click="fav.go(1)">下一页</button>
    </footer>
  </section>
</template>

<style scoped>
.fav { display: flex; flex-direction: column; gap: 14px; }
.head { display: flex; align-items: center; gap: 10px; }
.title { margin: 0; font-size: 17px; flex: 1; min-width: 0; }
.list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.row {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border: 1px solid var(--divider); border-radius: 12px;
}
.main-col { flex: 1; min-width: 0; }
.line1 { display: flex; gap: 10px; margin: 0 0 4px; font-size: 12px; color: var(--text-muted); }
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
