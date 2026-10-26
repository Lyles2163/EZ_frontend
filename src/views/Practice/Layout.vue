<!-- src/views/Practice/Layout.vue -->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import { useSubjects } from '../../composables/useSubjects'
import { useTheme } from '../../composables/useTheme'

const NAV = [
  { name: 'practice-subject', label: '科目总览' },
  { name: 'practice-drill', label: '练习' },
  { name: 'practice-wrong', label: '错题本' },
  { name: 'practice-favorite', label: '收藏本' },
] as const

const route = useRoute()
const router = useRouter()
const theme = useTheme()
const { subjects, loading, error, reload, ensure, store } = useSubjects()

onMounted(ensure)

const activeName = computed(() => String(route.name ?? ''))

/**
 * 子路由是一张一张接的（Task 10/13/14），而 RouterLink 指向不存在的路由名会当场抛。
 * 所以只渲染已注册的那几条 —— 这也是"每步绿就提交"能成立的前提。
 */
const navItems = computed(() => NAV.filter(item => router.hasRoute(item.name)))

// 后端给的 icon 是 "icon-chinese" 这类类名 token，仓库里没有对应资源
const ICONS: Record<string, string> = { chinese: '语', math: '数' }

function subjectIcon(subjectKey: string, name: string): string {
  return ICONS[subjectKey] ?? name.slice(0, 1)
}

function pickSubject(id: number): void {
  store.setSubject(id)
  void router.push({ name: 'practice-drill' })
}

function dismissError(): void {
  error.value = null
}
</script>

<template>
  <div class="practice-shell" :class="{ dark: theme === 'dark' }">
    <aside class="sb">
      <div class="sb-brand">刷题</div>

      <nav class="sb-nav">
        <RouterLink
            v-for="item in navItems"
            :key="item.name"
            class="sb-item"
            :class="{ 'sb-item--on': activeName === item.name }"
            :to="{ name: item.name }"
        >{{ item.label }}</RouterLink>
      </nav>

      <div class="sb-subjects">
        <p class="sb-label">科目</p>
        <button
            v-for="s in subjects"
            :key="s.id"
            class="sb-subject"
            :class="{ 'sb-subject--on': store.currentSubjectId === s.id }"
            type="button"
            @click="pickSubject(s.id)"
        >
          <span class="sb-icon">{{ subjectIcon(s.subjectKey, s.name) }}</span>
          <span class="sb-name">{{ s.name }}</span>
          <span class="sb-count">{{ s.questionCount }}</span>
        </button>
        <button v-if="!loading && subjects.length" class="sb-item" type="button" @click="reload">
          重新加载科目
        </button>
      </div>
    </aside>

    <main class="main">
      <ErrorBar v-if="error" :message="error" @dismiss="dismissError" />
      <div class="page-area"><RouterView /></div>
    </main>
  </div>
</template>

<style scoped>
.practice-shell {
  /* 全局令牌里没有状态色（App.vue 只有黑白灰 + glass），四态配色只能本模块自定义。
     硬编码值只允许出现在这一处，其它组件一律 var() 取。 */
  --p-idle: var(--bg-elevated);
  --p-correct: #16a34a;
  --p-wrong: #dc2626;
  --p-pending: #d97706;
  --p-error-bg: rgba(220, 38, 38, 0.08);
  --p-error-fg: #b91c1c;

  position: fixed;
  inset: 0;
  display: flex;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 14px;
}
.practice-shell.dark {
  --p-correct: #4ade80;
  --p-wrong: #f87171;
  --p-pending: #fbbf24;
  --p-error-bg: rgba(248, 113, 113, 0.12);
  --p-error-fg: #fca5a5;
}

.sb {
  width: 220px; flex: none; padding: 14px 10px;
  border-right: 1px solid var(--divider);
  display: flex; flex-direction: column; gap: 16px; overflow: auto;
}
.sb-brand { font-size: 16px; font-weight: 600; padding: 0 8px; }
.sb-nav { display: flex; flex-direction: column; gap: 2px; }
.sb-item {
  display: block; padding: 8px 10px; border: 0; border-radius: 8px;
  background: transparent; color: var(--text-secondary);
  font: inherit; text-align: left; text-decoration: none; cursor: pointer;
}
.sb-item:hover { background: var(--glass-bg-hover); color: var(--text-primary); }
.sb-item--on { background: var(--glass-bg); color: var(--text-primary); font-weight: 600; }
.sb-label { margin: 0 0 6px; padding: 0 10px; font-size: 12px; color: var(--text-muted); }
.sb-subjects { display: flex; flex-direction: column; gap: 2px; }
.sb-subject {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border: 0; border-radius: 8px;
  background: transparent; color: var(--text-secondary); font: inherit;
  text-align: left; cursor: pointer;
}
.sb-subject:hover { background: var(--glass-bg-hover); }
.sb-subject--on { background: var(--glass-bg); color: var(--text-primary); }
.sb-icon {
  flex: none; width: 20px; height: 20px; display: grid; place-items: center;
  border-radius: 6px; background: var(--glass-bg); font-size: 11px;
}
.sb-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-count { flex: none; font-size: 12px; color: var(--text-muted); }

.main { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 14px; gap: 12px; }
.page-area { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: auto; }

@media (max-width: 767px) {
  .practice-shell { flex-direction: column; }
  .sb {
    width: 100%; flex-direction: row; flex-wrap: wrap; gap: 8px;
    border-right: 0; border-bottom: 1px solid var(--divider);
  }
  .sb-brand, .sb-label, .sb-subjects { display: none; }
  .sb-nav { flex-direction: row; }
}
</style>
