<!-- src/components/practice/EmptyState.vue -->
<script setup lang="ts">
withDefaults(defineProps<{ title: string; hint?: string }>(), { hint: '' })
</script>

<template>
  <div class="p-empty">
    <p class="p-empty__title">{{ title }}</p>
    <p v-if="hint" class="p-empty__hint">{{ hint }}</p>
    <div v-if="$slots.default" class="p-empty__action"><slot /></div>
  </div>
</template>

<style scoped>
.p-empty {
  display: grid; place-items: center; gap: 6px;
  padding: 48px 20px; text-align: center;
}
.p-empty__title { margin: 0; font-size: 15px; color: var(--text-secondary); }
.p-empty__hint { margin: 0; font-size: 13px; color: var(--text-muted); }
</style>
