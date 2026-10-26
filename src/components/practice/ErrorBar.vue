<!-- src/components/practice/ErrorBar.vue -->
<script setup lang="ts">
defineProps<{ message: string }>()
const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="p-error" role="alert">
    <span class="p-error__text">{{ message }}</span>
    <button class="p-error__x" type="button" aria-label="关闭提示" @click="emit('dismiss')">×</button>
  </div>
</template>

<style scoped>
.p-error {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 10px;
  background: var(--p-error-bg); color: var(--p-error-fg);
  border: 1px solid var(--divider);
}
.p-error__text { flex: 1; min-width: 0; font-size: 13px; line-height: 1.5; }
.p-error__x {
  flex: none; width: 24px; height: 24px; border: 0; border-radius: 6px;
  background: transparent; color: inherit; font-size: 16px; line-height: 1; cursor: pointer;
}
.p-error__x:hover { background: var(--divider); }
</style>
