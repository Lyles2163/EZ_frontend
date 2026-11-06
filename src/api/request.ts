// src/api/request.ts
/**
 * 全局传输层。后端一份接口有三种响应体形状，全部在这里归一后再抛给调用方：
 *   Result{code,msg,data}      —— 业务码，成功 code===1，密码错误也是 HTTP 200 + code:0
 *   {code,message}             —— 网关 JwtAuthGlobalFilter 直出的 401
 *   {code,msg}                 —— AuthModule Spring Security 的 401/403
 *   {timestamp,status,error}   —— 无全局异常处理器时的 Boot 默认错误体
 * 契约依据：docs/superpowers/specs/2026-10-10-login-gateway-jwt-design.md
 */

const BASE_URL = import.meta.env.VITE_API_BASE || '/gw'
const TIMEOUT_MS = 15000

/** code === 0 的业务失败，message 即后端中文文案 */
export class BizError extends Error {
  readonly code: number

  constructor(message: string, code = 0) {
    super(message)
    this.name = 'BizError'
    this.code = code
  }
}

/** 401 / 403 鉴权失败 */
export class AuthError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/** 其余非 2xx、响应体形状不符、网络不可达与超时（status=0 表示没拿到响应） */
export class HttpError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export interface RequestOptions {
  body?: unknown
  method?: 'GET' | 'POST' | 'DELETE'
  /** 默认 true：有令牌时注入 Authorization */
  auth?: boolean
  /** 'result' 解包 data 并校验 code；'none' 原样返回响应体（如 /user/selectAll 的裸数组） */
  envelope?: 'result' | 'none'
  /**
   * 原样交给 fetch 的请求体，不做 JSON.stringify，也不设 Content-Type。
   * 文件上传必须走这条：手工设 Content-Type 会覆盖浏览器生成的 multipart boundary，
   * 后端解析必然失败。与 body 互斥，同时给时以 rawBody 为准。
   */
  rawBody?: BodyInit
  /** 覆盖默认 15s 超时。上传要跑 embedding，几秒到几十秒都正常，15s 必然掐断 */
  timeoutMs?: number
}

interface Envelope {
  code?: unknown
  msg?: unknown
  message?: unknown
  error?: unknown
  data?: unknown
}

let tokenGetter: () => string | null = () => null
let unauthorizedHandler: ((reason: AuthError) => void) | null = null

// 反向注入，避免 request.ts import store 形成循环依赖
export function setTokenGetter(get: () => string | null): void {
  tokenGetter = get
}

export function setUnauthorizedHandler(fn: (reason: AuthError) => void): void {
  unauthorizedHandler = fn
}

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`
}

function pickMessage(body: Envelope): string | null {
  for (const key of ['msg', 'message', 'error'] as const) {
    const value = body[key]
    if (typeof value === 'string' && value) return value
  }
  return null
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, rawBody, auth = true, envelope = 'result' } = options
  const method = options.method ?? (body === undefined && rawBody === undefined ? 'GET' : 'POST')

  const headers: Record<string, string> = {}
  // rawBody（FormData）时绝不能设 Content-Type：浏览器要自己带 boundary，
  // 手写 application/json 或 multipart/form-data 都会让后端解析失败。
  if (rawBody === undefined && body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = tokenGetter()
    // 网关严格判前缀：必须正好是 "Bearer "（小写或缺空格一律 401）
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let wire: BodyInit | undefined
  if (rawBody !== undefined) wire = rawBody
  else if (body !== undefined) wire = JSON.stringify(body)

  const timeout = AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      body: wire,
      signal: timeout,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new HttpError('请求超时，请稍后重试', 0)
    }
    throw new HttpError('无法连接服务器，请确认网关已启动', 0)
  }

  const payload = await readBody(res)
  const parsed: Envelope = payload && typeof payload === 'object' ? (payload as Envelope) : {}

  if (res.status === 401 || res.status === 403) {
    const reason = new AuthError(pickMessage(parsed) ?? '登录状态已失效', res.status)
    // 先收口再抛出：清令牌不能依赖调用方是否 catch
    unauthorizedHandler?.(reason)
    throw reason
  }

  if (!res.ok) {
    throw new HttpError(pickMessage(parsed) ?? `请求失败（${res.status}）`, res.status)
  }

  if (envelope === 'none') return payload as T

  if (typeof parsed.code !== 'number') {
    throw new HttpError('响应格式异常：缺少 code 字段', res.status)
  }
  if (parsed.code !== 1) {
    throw new BizError(pickMessage(parsed) ?? '操作失败', parsed.code)
  }
  return parsed.data as T
}
