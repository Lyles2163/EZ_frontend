<script setup lang="ts">
type PluginItem = {
  name: string
  desc: string
  installed: boolean
}

const plugins: PluginItem[] = [
  { name: 'Web Search',      desc: '联网检索最新资料并给出来源链接。', installed: true  },
  { name: 'Code Interpreter', desc: '在沙箱中运行 Python，处理数据与绘图。', installed: false },
  { name: 'Data Analysis',   desc: '上传表格文件，自动生成分析结论。',   installed: false },
  { name: 'PDF Reader',      desc: '解析文档内容并进行问答。',          installed: false }
]
</script>

<template>
  <section class="page">
    <header class="page-head">
      <h2 class="page-title">Plugins</h2>
      <p class="page-desc">启用插件以扩展模型能力。</p>
    </header>

    <ul class="list">
      <li v-for="item in plugins" :key="item.name" class="row">
        <div class="row-text">
          <p class="row-name">{{ item.name }}</p>
          <p class="row-desc">{{ item.desc }}</p>
        </div>
        <button class="row-btn" :data-installed="item.installed ? '' : undefined">
          {{ item.installed ? '已启用' : '启用' }}
        </button>
      </li>
    </ul>
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
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--sb-bg);
}
.row-text { flex: 1; min-width: 0; }
.row-name {
  margin: 0 0 3px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.row-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.row-btn {
  flex-shrink: 0;
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.row-btn:hover { background: var(--sb-hover); }
.row-btn[data-installed] {
  border-color: transparent;
  background: var(--text);
  color: var(--main-bg);
}
</style>
