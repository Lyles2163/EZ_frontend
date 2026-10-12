<script setup lang="ts">
import { ref } from 'vue'
import GenerateForm from '../../components/AI/images/GenerateForm.vue'
import RecordList from '../../components/AI/images/RecordList.vue'
import ResultGallery from '../../components/AI/images/ResultGallery.vue'
import { useImageStudio } from '../../composables/useImageStudio'

const studio = useImageStudio()

type Tab = 'records' | 'generate' | 'results'
const tab = ref<Tab>('generate')

const narrowTabs: { key: Tab; label: string }[] = [
  { key: 'records', label: '记录' },
  { key: 'generate', label: '生成' },
  { key: 'results', label: '结果' }
]

const onCreate = () => {
  studio.resetForm()
  tab.value = 'generate'
}

const onSelect = (id: string) => {
  studio.selectRecord(id)
  tab.value = 'results'
}
</script>

<template>
  <div class="studio-wrap">
    <p v-if="studio.error.value" class="banner">{{ studio.error.value }}</p>

    <nav class="tabs">
      <button
          v-for="item in narrowTabs"
          :key="item.key"
          class="tab"
          :data-on="tab === item.key ? '' : undefined"
          @click="tab = item.key"
      >
        {{ item.label }}
      </button>
    </nav>

    <div class="studio">
      <div class="pane" :class="{ 'pane-on': tab === 'records' }">
        <RecordList
            :records="studio.records.value"
            :active-id="studio.activeId.value"
            :checked-ids="studio.checkedIds.value"
            :all-checked="studio.allChecked.value"
            :loading="studio.loading.value"
            @create="onCreate"
            @select="onSelect"
            @toggle="studio.toggleChecked"
            @toggle-all="studio.toggleCheckedAll"
            @remove="studio.removeChecked"
        />
      </div>

      <div class="pane" :class="{ 'pane-on': tab === 'generate' }">
        <GenerateForm
            v-model="studio.form"
            :submitting="studio.submitting.value"
            @submit="studio.generate"
            @attach="studio.attachFiles"
            @remove-reference="studio.removeReference"
        />
      </div>

      <div class="pane" :class="{ 'pane-on': tab === 'results' }">
        <ResultGallery :record="studio.activeRecord.value" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.studio-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.banner {
  margin: 0;
  padding: 8px 20px;
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  font-size: 12px;
}
.dark .banner { color: #fca5a5; }

.tabs { display: none; }

.studio {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px 380px minmax(0, 1fr);
}
.pane { min-width: 0; display: flex; }
.pane > * { flex: 1; min-width: 0; }

/* 中屏：压缩记录栏与表单栏 */
@media (max-width: 1279px) {
  .studio { grid-template-columns: 248px 336px minmax(0, 1fr); }
}

/* 窄屏：三栏退化为标签页 */
@media (max-width: 1099px) {
  .tabs {
    display: flex;
    gap: 6px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
  }
  .tab {
    padding: 5px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .tab[data-on] {
    border-color: var(--text);
    background: var(--text);
    color: var(--main-bg);
    font-weight: 600;
  }

  .studio { grid-template-columns: 1fr; }
  .pane { display: none; }
  .pane.pane-on { display: flex; }

  /* 单栏时去掉分栏边框 */
  .pane :deep(.col) { border-right: 0; }
}
</style>
