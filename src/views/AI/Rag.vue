<script setup lang="ts">
type KnowledgeBase = {
  name: string
  docs: number
  updated: string
}

const bases: KnowledgeBase[] = [
  { name: '课程讲义', docs: 24, updated: '2026-09-28' },
  { name: '真题解析', docs: 132, updated: '2026-09-30' },
  { name: '个人笔记', docs: 7, updated: '2026-10-06' }
]
</script>

<template>
  <section class="page">
    <header class="page-head">
      <h2 class="page-title">RAG</h2>
      <p class="page-desc">管理用于检索增强的知识库。</p>
    </header>

    <ul class="list">
      <li v-for="item in bases" :key="item.name" class="row">
        <div class="row-text">
          <p class="row-name">{{ item.name }}</p>
          <p class="row-meta">{{ item.docs }} 个文档 · 更新于 {{ item.updated }}</p>
        </div>
      </li>
    </ul>

    <p class="empty">新建知识库与向量索引功能开发中。</p>
  </section>
</template>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 32px 40px;
}
.page-head {
  max-width: 900px;
  margin: 0 auto 24px;
}
.page-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
}
.page-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.list {
  max-width: 900px;
  margin: 0 auto;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--sb-bg);
}
.row-name {
  margin: 0 0 3px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.row-meta {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.empty {
  max-width: 900px;
  margin: 20px auto 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
