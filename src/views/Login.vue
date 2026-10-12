<script setup lang="ts">
import { computed } from 'vue'
import CodeSlots from '../components/login/CodeSlots.vue'
import ElectricBorder from '../components/login/ElectricBorder.vue'
import SlideCommit from '../components/login/SlideCommit.vue'
import { useTheme } from '../composables/useTheme'
import { useLogin } from '../composables/useLogin'

const theme = useTheme()
const login = useLogin()
const {
  tab,
  form,
  captcha,
  captchaStatus,
  remember,
  cooldown,
  error,
  notice,
  isLogin,
  submit,
  requestCode,
  onCodeChange,
  switchTab,
} = login

// SlideCommit / CodeSlots / ElectricBorder 默认是深色皮肤，这里按当前主题把色值当 props 传进去，组件内部零改动
// electric 对应 --primary-500 的两套值；以后接用户自定义主题色时改这一处即可
const palette = computed(() =>
  theme.value === 'dark'
    ? { track: '#27272a', handle: '#fafafa', slot: '#27272a', digit: '#fafafa', accent: '#09090b', ink: '#fafafa', electric: '#fafafa' }
    : { track: '#e4e4e7', handle: '#18181b', slot: '#e4e4e7', digit: '#18181b', accent: '#ffffff', ink: '#18181b', electric: '#18181b' },
)

const commitLabel = computed(() => (isLogin.value ? '滑动登录' : '滑动注册'))
const doneLabel = computed(() => (isLogin.value ? '登录成功' : '注册成功'))
const errorLabel = computed(() => (isLogin.value ? '登录失败' : '注册失败'))
const cooldownText = computed(() => `${cooldown.value}s 后可重取`)
const passwordPlaceholder = computed(() => (isLogin.value ? '请输入密码' : '8-64 位'))
</script>

<template>
  <div class="login-page">
    <ElectricBorder class="login-frame" :color="palette.electric" :border-radius="20">
      <section class="login-card" aria-labelledby="login-title">
        <header class="card-head">
          <h1 id="login-title">EZ-Up</h1>
          <p class="card-sub">{{ isLogin ? '登录后继续你的刷题与 AI 对话' : '创建一个账号，开始刷题' }}</p>
        </header>

        <div class="tabs" role="tablist" aria-label="登录方式">
          <button
              class="tab"
              role="tab"
              :aria-selected="isLogin"
              :data-active="isLogin ? '' : undefined"
              @click="switchTab('login')"
          >
            登录
          </button>
          <button
              class="tab"
              role="tab"
              :aria-selected="!isLogin"
              :data-active="!isLogin ? '' : undefined"
              @click="switchTab('register')"
          >
            注册
          </button>
        </div>

        <div class="fields">
          <label class="field">
            <span class="field-label">用户名</span>
            <input
                v-model="form.username"
                class="input"
                type="text"
                autocomplete="username"
                placeholder="4-20 位字母、数字或下划线"
            />
          </label>

          <label class="field">
            <span class="field-label">密码</span>
            <input
                v-model="form.password"
                class="input"
                type="password"
                :autocomplete="isLogin ? 'current-password' : 'new-password'"
                :placeholder="passwordPlaceholder"
            />
          </label>

          <template v-if="isLogin">
            <div class="field">
              <div class="field-head">
                <span class="field-label">验证码</span>
                <span class="dev-tag" title="后端还没有验证码接口，这一步只在浏览器里校验">开发占位</span>
                <button
                    class="link-btn"
                    :disabled="cooldown > 0"
                    @click="requestCode"
                >
                  {{ captcha ? (cooldown > 0 ? cooldownText : '重新获取') : '获取验证码' }}
                </button>
              </div>

              <div v-if="captcha" class="captcha-row">
                <span class="captcha-hint">题面</span>
                <output class="captcha-code">{{ captcha.challenge }}</output>
                <CodeSlots
                    :length="6"
                    :value="form.captchaCode"
                    :status="captchaStatus"
                    :slot-size="40"
                    :gap="6"
                    :radius="10"
                    :accent-color="palette.accent"
                    :ink-color="palette.ink"
                    :slot-color="palette.slot"
                    :digit-color="palette.digit"
                    aria-label="六位数字验证码"
                    @change="onCodeChange"
                />
              </div>
            </div>

            <label class="remember">
              <input v-model="remember" type="checkbox" />
              <span>记住我（不勾则关闭标签页后失效）</span>
            </label>
          </template>
        </div>

        <p v-if="error" class="banner banner-error">{{ error }}</p>
        <p v-if="notice" class="banner banner-ok">{{ notice }}</p>

        <div class="commit">
          <SlideCommit
              :label="commitLabel"
              :done-label="doneLabel"
              :error-label="errorLabel"
              :width="280"
              :height="52"
              :radius="26"
              :track-color="palette.track"
              :handle-color="palette.handle"
              :on-confirm="submit"
          />
        </div>

        <footer class="card-foot">
          <button class="link-btn" @click="switchTab(isLogin ? 'register' : 'login')">
            {{ isLogin ? '还没有账号？去注册' : '已有账号？去登录' }}
          </button>
        </footer>
      </section>
    </ElectricBorder>
  </div>
</template>

<style scoped>
.login-page {
  min-height: calc(100vh - 96px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px 48px;
  box-sizing: border-box;
  /* ElectricBorder 的 canvas 每边外扩 60px，窄屏会撑出横向滚动条。
     用 clip 而非 hidden —— 只有 clip 能让 overflow-y 保持 visible，不裁切超高的卡片 */
  overflow-x: clip;
}

/* 宽度约束必须放在 frame 上：ElectricBorder 根节点自身没有宽度，
   卡片的 width:100% 会在 shrink-to-fit 的包裹层里塌陷 */
.login-frame {
  width: 100%;
  max-width: 420px;
}

.login-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 28px;
  border-radius: 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow: 0 16px 40px var(--glass-shadow), inset 0 1px 0 var(--glass-highlight);
}

.card-head h1 {
  margin: 0;
  font-size: clamp(20px, 5vw, 24px);
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.card-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--divider);
}

.tab {
  appearance: none;
  border: 0;
  background: transparent;
  border-radius: 999px;
  padding: 9px 0;
  font: inherit;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.tab[data-active] {
  background: var(--primary-500);
  color: var(--primary-contrast);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 13px;
  font: inherit;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--glass-border-strong);
  border-radius: 12px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input:focus-visible {
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--divider);
}

.dev-tag {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

.link-btn {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  margin-left: auto;
  font: inherit;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.link-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.captcha-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.captcha-code {
  min-width: 66px;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--text-primary);
  background: var(--divider);
}

.remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.remember input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--primary-500);
}

.banner {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.45;
}

.banner-error {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.12);
}

.banner-ok {
  color: #15803d;
  background: rgba(34, 197, 94, 0.14);
}

.commit {
  display: flex;
  justify-content: center;
  padding: 2px 0;
}

.card-foot {
  display: flex;
  justify-content: center;
}

@media (max-width: 767px) {
  .login-page {
    min-height: calc(100vh - 80px);
    padding-top: 8px;
  }
  .login-card {
    padding: 22px 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tab,
  .input,
  .link-btn {
    transition: none;
  }
}
</style>
