// src/composables/useLogin.ts
/**
 * 登录/注册页的唯一状态owner：表单、校验、验证码 mock、冷却计时，
 * 以及把 submit 交给 SlideCommit 的 onConfirm 来驱动按钮动画。
 */
import { computed, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CAPTCHA_LENGTH, fetchCaptcha, register, type CaptchaChallenge } from '../api/auth'
import { BizError } from '../api/request'
import { resolveRedirect, useAuthStore } from '../stores/auth'

export type LoginTab = 'login' | 'register'
export type CaptchaStatus = 'idle' | 'error' | 'success'

// 后端 @Valid 因缺 spring-boot-starter-validation 实际不生效，这两条只能在前端兜住
const USERNAME_RE = /^[a-zA-Z0-9_]{4,20}$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 64
const COOLDOWN_SECONDS = 60

export function useLogin() {
  const auth = useAuthStore()
  const route = useRoute()
  const router = useRouter()

  const tab = ref<LoginTab>('login')
  const form = reactive({ username: '', password: '', captchaCode: '', captchaKey: '' })
  const captcha = ref<CaptchaChallenge | null>(null)
  const captchaStatus = ref<CaptchaStatus>('idle')
  const remember = ref(false)
  const submitting = ref(false)
  const cooldown = ref(0)
  const error = ref('')
  const notice = ref('')

  let cooldownTimer: ReturnType<typeof setTimeout> | undefined

  const isLogin = computed(() => tab.value === 'login')

  function validate(): string | null {
    if (!form.username.trim()) return '请输入用户名'
    if (!form.password) return '请输入密码'
    if (isLogin.value) {
      if (!captcha.value) return '请先获取验证码'
      if (form.captchaCode.length !== CAPTCHA_LENGTH) return `请输入 ${CAPTCHA_LENGTH} 位验证码`
      return null
    }
    // 严格规则只用于注册：那是写入约束。登录不能拒绝服务端已认可的凭据，
    // 否则存量短密码账号（后端 @Valid 未生效期间建的）会被永久锁在门外。
    if (!USERNAME_RE.test(form.username)) return '用户名需为 4-20 位字母、数字或下划线'
    if (form.password.length < PASSWORD_MIN || form.password.length > PASSWORD_MAX) {
      return `密码长度需为 ${PASSWORD_MIN}-${PASSWORD_MAX} 位`
    }
    return null
  }

  const canSubmit = computed(() => !submitting.value && validate() === null)

  function stopCooldown(): void {
    clearTimeout(cooldownTimer)
    cooldown.value = 0
  }

  function startCooldown(): void {
    stopCooldown()
    cooldown.value = COOLDOWN_SECONDS
    const tick = () => {
      cooldown.value -= 1
      if (cooldown.value > 0) cooldownTimer = setTimeout(tick, 1000)
    }
    cooldownTimer = setTimeout(tick, 1000)
  }

  /** 换题：丢掉当前挑战并解除冷却，让用户能立刻重取 */
  function resetCaptcha(): void {
    captcha.value = null
    form.captchaCode = ''
    form.captchaKey = ''
    captchaStatus.value = 'idle'
    stopCooldown()
  }

  /**
   * 判错专用：只作废挑战，**不碰 captchaStatus** —— 'error' 要留给 CodeSlots 播抖动的，
   * 它自己排空后会 emit change('')，再由 onCodeChange 落回 idle。
   */
  function invalidateCaptcha(): void {
    captcha.value = null
    form.captchaKey = ''
    stopCooldown()
  }

  async function requestCode(): Promise<void> {
    if (cooldown.value > 0 || submitting.value) return
    error.value = ''
    try {
      const challenge = await fetchCaptcha()
      captcha.value = challenge
      form.captchaKey = challenge.captchaKey
      form.captchaCode = ''
      captchaStatus.value = 'idle'
      startCooldown()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取验证码失败'
    }
  }

  function onCodeChange(code: string): void {
    form.captchaCode = code
    if (captchaStatus.value === 'error') captchaStatus.value = 'idle'
  }

  // SlideCommit 用它 await：reject 才会触发抖动复位，所以本地校验失败也必须 reject
  async function submit(): Promise<void> {
    const message = validate()
    if (message) {
      error.value = message
      throw new Error(message)
    }

    error.value = ''
    notice.value = ''
    submitting.value = true

    try {
      if (isLogin.value) {
        // 图形码由服务端校验：前端不再自证，错了就靠 code:0 报错并作废这张图
        await auth.login({ ...form, remember: remember.value })
        captchaStatus.value = 'success'
        router.replace(resolveRedirect(route.query.redirect))
        return
      }

      await register({ username: form.username, password: form.password })
      form.password = ''
      resetCaptcha()
      tab.value = 'login'
      notice.value = '注册成功，请登录'
    } catch (err) {
      error.value = err instanceof Error ? err.message : isLogin.value ? '登录失败，请稍后重试' : '注册失败，请稍后重试'
      // 服务端说验证码有问题 → 这张图已被消费，必须让用户重新取一张
      if (err instanceof BizError && err.message.includes('验证码')) {
        captchaStatus.value = 'error'
        invalidateCaptcha()
      }
      throw err
    } finally {
      submitting.value = false
    }
  }

  function switchTab(next: LoginTab): void {
    if (next === tab.value) return
    tab.value = next
    error.value = ''
    notice.value = ''
    if (next === 'register') resetCaptcha()
  }

  onUnmounted(() => clearTimeout(cooldownTimer))

  return {
    tab,
    form,
    captcha,
    captchaStatus,
    remember,
    submitting,
    cooldown,
    error,
    notice,
    isLogin,
    canSubmit,
    requestCode,
    onCodeChange,
    submit,
    switchTab,
  }
}
