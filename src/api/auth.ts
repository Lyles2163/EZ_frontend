// src/api/auth.ts
/**
 * 认证接口层。login/register 的形状严格对齐后端 RegisterRequest（两接口共用同一 DTO）。
 * fetchCaptcha / verifyCaptchaLocal 目前是前端 mock —— 后端尚无验证码端点，
 * 接入时只替换这两个函数的实现，签名与调用点不动。
 */

import { HttpError, request } from './request'

/** 后端 iat/exp 实测序列化为 ISO-8601 字符串（"2026-09-30T00:23:27.000+00:00"），兼容 epoch 数字 */
export type TimeValue = string | number

export interface CredentialForm {
  username: string
  password: string
  captchaCode?: string
  captchaKey?: string
}

export interface LoginResult {
  token: string
  userName: string
  exp: TimeValue
}

export interface CaptchaChallenge {
  captchaKey: string
  /** mock 阶段是明文数字串；真后端上线后改为 base64 图 */
  challenge: string
  kind: 'text' | 'image-base64'
}

export const CAPTCHA_LENGTH = 6

/** 无法解析时抛错而不是返回 NaN，避免把 NaN 当过期时间存进登录态 */
export function toMillis(value: TimeValue): number {
  const ms = typeof value === 'number' ? value : Date.parse(value)
  if (!Number.isFinite(ms)) throw new HttpError('登录响应格式异常：exp 无法解析', 0)
  return ms
}

export async function login(form: CredentialForm): Promise<LoginResult> {
  const data = await request<Partial<LoginResult> | null>('/auth/login', { body: form })
  if (
    !data ||
    typeof data.token !== 'string' ||
    typeof data.userName !== 'string' ||
    (typeof data.exp !== 'string' && typeof data.exp !== 'number')
  ) {
    throw new HttpError('登录响应格式异常', 0)
  }
  return { token: data.token, userName: data.userName, exp: data.exp }
}

export async function register(form: CredentialForm): Promise<string> {
  const data = await request<unknown>('/auth/register', { body: form })
  return typeof data === 'string' ? data : '注册成功'
}

/**
 * 经网关必失败：/auth/logout 不在白名单（要求带令牌），而网关转发前又剥掉 Authorization，
 * 后端恒收 null → code:0「未携带token」。调用方按尽力而为处理，本地清态不受它影响。
 */
export function logout(): Promise<unknown> {
  return request<unknown>('/auth/logout', { method: 'POST' })
}

// ===================== 验证码（mock） =====================

const CAPTCHA_TTL_MS = 5 * 60 * 1000

let challenge: { key: string; expected: string; expiresAt: number } | null = null

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchCaptcha(): Promise<CaptchaChallenge> {
  await delay(240)
  const digits = String(Math.floor(100000 + Math.random() * 900000))
  const key = `mock-${Date.now().toString(36)}`
  challenge = { key, expected: digits, expiresAt: Date.now() + CAPTCHA_TTL_MS }
  return { captchaKey: key, challenge: digits, kind: 'text' }
}

/** mock 专用的本地校验。真后端接管验证码后删除本函数，改由 login 的 code:0 判错。 */
export function verifyCaptchaLocal(captchaKey: string, code: string): boolean {
  if (!challenge || challenge.key !== captchaKey) return false
  if (challenge.expiresAt < Date.now()) {
    challenge = null
    return false
  }
  return challenge.expected === code
}
