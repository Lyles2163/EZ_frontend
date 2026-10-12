// src/stores/auth.ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { login as loginApi, logout as logoutApi, toMillis, type CredentialForm } from '../api/auth'
import { setTokenGetter } from '../api/request'

const AUTH_KEY = 'ez-auth'

interface PersistedAuth {
  token: string
  userName: string
  exp: number
}

/**
 * 落在哪个桶就是「记住我」的答案，所以不再单独存 remember 标志。
 * 两桶都有值时取 exp 更晚的一个（新登录态），并清掉另一个，
 * 免得旧标签页留下的过期值把当前会话带歪。
 */
function parse(raw: string): PersistedAuth | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    if (typeof value.token !== 'string' || typeof value.userName !== 'string') return null
    const exp = typeof value.exp === 'number' ? value.exp : Number(value.exp)
    if (!Number.isFinite(exp) || exp <= Date.now()) return null
    return { token: value.token, userName: value.userName, exp }
  } catch {
    return null
  }
}

function drop(key: string): void {
  try {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  } catch {
    /* 隐私模式下不可用，内存态仍然正确 */
  }
}

function hydrate(): { auth: PersistedAuth | null; remember: boolean } {
  const buckets: Array<{ storage: Storage; remember: boolean }> = [
    { storage: localStorage, remember: true },
    { storage: sessionStorage, remember: false },
  ]
  const found: Array<{ auth: PersistedAuth; remember: boolean }> = []

  for (const { storage, remember } of buckets) {
    let raw: string | null = null
    try {
      raw = storage.getItem(AUTH_KEY)
    } catch {
      continue
    }
    if (!raw) continue
    const parsed = parse(raw)
    if (parsed) found.push({ auth: parsed, remember })
    else {
      try {
        storage.removeItem(AUTH_KEY)
      } catch {
        /* 忽略 */
      }
    }
  }

  if (!found.length) return { auth: null, remember: false }
  const winner = found.reduce((a, b) => (b.auth.exp > a.auth.exp ? b : a))
  for (const item of found) {
    if (item === winner) continue
    try {
      ;(item.remember ? localStorage : sessionStorage).removeItem(AUTH_KEY)
    } catch {
      /* 忽略 */
    }
  }
  return winner
}

const FALLBACK_PATH = '/practice'

/**
 * 防开放重定向的唯一关卡：只接受站内绝对路径。
 * 协议相对（//evil.com）、反斜杠变体、指向登录页自身的都回落首页。
 */
export function resolveRedirect(raw: unknown): string {
  if (typeof raw !== 'string') return FALLBACK_PATH
  if (!/^\/(?!\/|\\)/.test(raw)) return FALLBACK_PATH
  const [path] = raw.split(/[?#]/)
  if (path === '/login') return FALLBACK_PATH
  return raw
}

export const useAuthStore = defineStore('auth', () => {
  // 同步水合，不放 onMounted：否则 beforeEach 先判未登录跳走，再水合回来会闪一下
  const restored = hydrate()

  const token = ref<string | null>(restored.auth?.token ?? null)
  const userName = ref<string>(restored.auth?.userName ?? '')
  const exp = ref<number>(restored.auth?.exp ?? 0)
  const remember = ref<boolean>(restored.remember)

  const isLoggedIn = computed(() => !!token.value && exp.value > Date.now())

  setTokenGetter(() => token.value)

  function persist(): void {
    if (!token.value) return
    const payload = JSON.stringify({
      token: token.value,
      userName: userName.value,
      exp: exp.value,
    } satisfies PersistedAuth)
    const target = remember.value ? localStorage : sessionStorage
    const other = remember.value ? sessionStorage : localStorage
    try {
      target.setItem(AUTH_KEY, payload)
      other.removeItem(AUTH_KEY)
    } catch {
      /* 配额或隐私模式：内存态仍可用，本次会话不受影响 */
    }
  }

  function clear(): void {
    token.value = null
    userName.value = ''
    exp.value = 0
    remember.value = false
    drop(AUTH_KEY)
  }

  async function login(form: CredentialForm & { remember?: boolean }): Promise<void> {
    const result = await loginApi(form)
    token.value = result.token
    userName.value = result.userName
    exp.value = toMillis(result.exp)
    remember.value = form.remember ?? false
    persist()
  }

  async function logout(): Promise<void> {
    try {
      await logoutApi()
    } catch {
      /* 经网关必失败（见 api/auth.ts），本地清态不依赖它 */
    }
    clear()
  }

  return { token, userName, exp, remember, isLoggedIn, login, logout, clear }
})
