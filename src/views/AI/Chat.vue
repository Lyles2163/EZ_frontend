<script setup lang="ts">
import { computed, ref } from 'vue'
import PromptBar from '../../components/AI/PromptBar.vue'
import type { PromptBarSendDetail } from '../../components/AI/PromptBar.vue'
import { useTheme } from '../../composables/useTheme'

const theme = useTheme()
const busy = ref(false)

const promptColors = computed(() => {
  if (theme.value === 'light') {
    return {
      background: '#ffffff',
      color: '#0d0d0d',
      menuBackground: '#ffffff',
      sparkColor: '#8ab4ff',
    }
  }
  return {
    background: '#2a2a2a',
    color: '#ececec',
    menuBackground: '#2a2a2a',
    sparkColor: '#6ea8ff',
  }
})

const send = async (text: string, detail: PromptBarSendDetail) => {
  busy.value = true
  try {
    console.log('send:', text, detail)
    await new Promise(r => setTimeout(r, 800))
  } finally {
    busy.value = false
  }
}

const stop = () => {
  busy.value = false
}

const attach = (): string[] => {
  return []
}

const dictate = (): string => {
  return ''
}

const onEffortChange = (effort: string) => {
  console.log('effort:', effort)
}
</script>

<template>
  <section class="chat-area">
    <h1 class="greeting">Where should<br />we begin?</h1>

    <div class="prompt-wrap">
      <PromptBar
          placeholder="问点什么"
          :busy="busy"
          :onAttach="attach"
          :onDictate="dictate"
          :background="promptColors.background"
          :color="promptColors.color"
          :menuBackground="promptColors.menuBackground"
          :sparkColor="promptColors.sparkColor"
          :sparkBoost="1"
          :width="680"
          :radius="26"
          :maxRows="5"
          :morphDuration="240"
          :squash="0.12"
          :tilt="8"
          :pressScale="0.96"
          @send="send"
          @stop="stop"
          @effortChange="onEffortChange"
      />
    </div>
  </section>
</template>

<style scoped>
.chat-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 0 24px 40px;
}

.greeting {
  margin: 0;
  font-size: clamp(24px, 2.6vw, 32px);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.02em;
  text-align: center;
}

/* 关键：不要给 height，让 PromptBar 自己撑开 */
.prompt-wrap {
  width: 100%;
  max-width: 680px;
}

@media (max-width: 767px) {
  .chat-area {
    justify-content: flex-start;
    padding: 48px 16px 24px;
    gap: 20px;
  }

  .greeting {
    font-size: 24px;
  }
}
</style>
