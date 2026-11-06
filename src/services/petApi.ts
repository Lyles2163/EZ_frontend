/**
 * dsh-pet 独立模式 HTTP API 客户端。
 *
 * 独立模式默认监听 http://127.0.0.1:3080，路由前缀 /dsh-pet-7340。
 * 通过 vite dev 代理把 /pet 转发到独立模式服务，避免浏览器跨域。
 *
 * 文档：F:\AAAJAVA\code\pet\dsh-pet\API.md
 */

/** 独立模式服务地址（生产环境可改走同源代理）。 */
export const PET_BASE = '/pet/dsh-pet-7340'

/** 占用锁信息。 */
export interface PetLock {
  lockId: string
  petId: string
  expiresAt: number
}

/** 统一响应。 */
export interface PetOk { ok: true }
export interface PetFail { ok: false; reason: string }
export type PetResult = PetOk | PetFail

function isFail(r: unknown): r is PetFail {
  return typeof r === 'object' && r !== null && (r as { ok?: boolean }).ok === false
}

async function call<T>(
  path: string,
  init: RequestInit = {},
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(PET_BASE + path, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`dsh-pet ${path} -> ${res.status}`)
  return (await res.json()) as T
}

/* ─────────────────── 读状态 ─────────────────── */

/** 读取当前所有宠物状态（/state 是唯一数据源）。 */
export function getState(): Promise<unknown> {
  return call('/state')
}

/** 读取合并后的成品配置。 */
export function getConfig(): Promise<unknown> {
  return call('/config')
}

/* ─────────────────── 占用锁 ─────────────────── */

/**
 * 取锁 / 续期。
 * 传 lockId 就是续期，不传就是新建。
 * 占用期间这只宠物完全静止，只有持锁者能驱动它。
 */
/** 调用方期望的显示端：桌宠嵌在浏览器里，统一用 web。 */
const SURFACE = 'web'

export function acquireLock(pet: string, lockId?: string, ttl = 120000): Promise<PetLock | PetFail> {
  return call<PetLock | PetFail>('/lock', {
    method: 'POST',
    body: JSON.stringify({ lockId, ttl }),
  }, { pet, surface: SURFACE })
}

/** 释放占用。 */
export function releaseLock(pet: string, lockId: string): Promise<PetResult> {
  return call<PetResult>('/lock/release', {
    method: 'POST',
    body: JSON.stringify({ lockId }),
  }, { pet, surface: SURFACE })
}

/* ─────────────────── 说话（气泡） ─────────────────── */

export interface BroadcastOptions {
  /** 要说的话。 */
  text: string
  /** 包内表情包名（与 url 二选一）。 */
  image?: string
  /** 第三方自带配图地址（与 image 二选一）。 */
  url?: string
  /** 气泡显示时长（毫秒），默认 10000。0 = 不显示。 */
  duration?: number
  /** 是否联动说话动画，默认 true。 */
  anim?: boolean
}

/**
 * 第三方投喂：把外部文本写进宠物气泡（不生成内容，只搬运）。
 * 需要先取锁，传 lockId。
 */
export function broadcast(
  pet: string,
  lockId: string,
  opts: BroadcastOptions,
): Promise<PetResult> {
  return call<PetResult>('/broadcast', {
    method: 'POST',
    body: JSON.stringify(opts),
  }, { pet, lock: lockId, surface: SURFACE })
}

/** 清空气泡。需要锁。 */
export function clearBubble(pet: string, lockId: string): Promise<PetResult> {
  return call<PetResult>('/bubble/clear', { method: 'POST' }, { pet, lock: lockId, surface: SURFACE })
}

/* ─────────────────── 动作 ─────────────────── */

export interface AnimOptions {
  /** 池内动画名（与 url 二选一）。 */
  name?: string
  /** 第三方自带动画地址（与 name 二选一）。 */
  url?: string
  /** 朝向：left / right，不传不动朝向。 */
  facing?: 'left' | 'right'
}

/**
 * 点播动画。需要锁。
 * 返回 playbackId，可用 getPlayback 查询播放状态。
 */
export function playAnim(
  pet: string,
  lockId: string,
  opts: AnimOptions,
): Promise<{ ok: true; playbackId: string } | PetFail> {
  return call('/anim', {
    method: 'POST',
    body: JSON.stringify(opts),
  }, { pet, lock: lockId, surface: SURFACE })
}

/** 查询点播播放状态，可长轮询等待。 */
export function getPlayback(
  playbackId: string,
  wait?: 'playing' | 'ended' | 'cancelled',
  timeoutMs?: number,
): Promise<unknown> {
  return call(`/playback/${playbackId}`, {}, { wait, timeout: timeoutMs })
}

/** 位置控制：挪到归一化坐标。需要锁。 */
export function setPosition(
  pet: string,
  lockId: string,
  x: number,
  y: number,
  mode: 'direct' | 'spring' | 'line' = 'spring',
): Promise<PetResult> {
  return call<PetResult>('/position', {
    method: 'POST',
    body: JSON.stringify({ x, y, mode }),
  }, { pet, lock: lockId, surface: SURFACE })
}

/** 抛掷：给初速度让它飞出去。需要锁。 */
export function throwPet(
  pet: string,
  lockId: string,
  angle: number,
  power = 1,
): Promise<PetResult> {
  return call<PetResult>('/throw', {
    method: 'POST',
    body: JSON.stringify({ angle, power }),
  }, { pet, lock: lockId, surface: SURFACE })
}

/** 让它睡下。 */
export function sleep(pet: string): Promise<PetResult> {
  return call<PetResult>('/sleep', { method: 'POST' }, { pet, surface: SURFACE })
}

/** 叫醒。 */
export function wake(pet: string): Promise<PetResult> {
  return call<PetResult>('/wake', { method: 'POST' }, { pet, surface: SURFACE })
}

/* ─────────────────── 工作状态 ─────────────────── */

export type WorkState = 'thinking' | 'working' | 'organizing' | 'waiting' | 'success' | 'error'

/**
 * 外部写入工作状态。
 * 六档：思考 / 工作 / 整理 / 等待 / 成功 / 出错。
 */
export function setWorkStatus(state: WorkState, task?: string): Promise<PetResult> {
  return call<PetResult>('/work-status', {
    method: 'POST',
    body: JSON.stringify({ state, task }),
  })
}

/** 清空工作状态回空闲。 */
export function clearWorkStatus(): Promise<void> {
  return call('/work-status', { method: 'DELETE' })
}

/* ─────────────────── 待办 ─────────────────── */

export interface Todo {
  id: string
  text: string
  dueAt: number | null
  done: boolean
}

export function listTodos(): Promise<Todo[]> {
  return call('/todos')
}

export function createTodo(text: string, dueAt?: number): Promise<Todo> {
  return call('/todos', {
    method: 'POST',
    body: JSON.stringify({ text, dueAt: dueAt ?? null }),
  })
}

export function updateTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'dueAt' | 'done'>>): Promise<Todo> {
  return call(`/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteTodo(id: string): Promise<{ removed: number }> {
  return call(`/todos/${id}`, { method: 'DELETE' })
}

/* ─────────────────── 便捷组合 ─────────────────── */

/**
 * 让宠物说一句话（自动取锁 → 投喂 → 释放）。
 * 适合一次性气泡，不需要持续占用的场景。
 */
export async function say(pet: string, text: string, opts: Omit<BroadcastOptions, 'text'> = {}): Promise<void> {
  const lock = await acquireLock(pet)
  if (isFail(lock)) return
  try {
    await broadcast(pet, lock.lockId, { text, ...opts })
  } finally {
    await releaseLock(pet, lock.lockId).catch(() => undefined)
  }
}

/**
 * 让宠物播一段动画（自动取锁 → 点播 → 释放）。
 */
export async function playAnimation(pet: string, name: string, facing?: 'left' | 'right'): Promise<void> {
  const lock = await acquireLock(pet)
  if (isFail(lock)) return
  try {
    await playAnim(pet, lock.lockId, { name, facing })
  } finally {
    await releaseLock(pet, lock.lockId).catch(() => undefined)
  }
}

/**
 * 让宠物说一句话并播一段动画（同一把锁，避免气泡和动画互相打断）。
 */
export async function sayWithAnim(
  pet: string,
  text: string,
  animName: string,
  opts: Omit<BroadcastOptions, 'text'> = {},
): Promise<void> {
  const lock = await acquireLock(pet)
  if (isFail(lock)) return
  try {
    await playAnim(pet, lock.lockId, { name: animName })
    await broadcast(pet, lock.lockId, { text, ...opts })
  } finally {
    await releaseLock(pet, lock.lockId).catch(() => undefined)
  }
}
