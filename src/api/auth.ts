// src/api/auth.ts
/**
 * 认证接口层。图形验证码、登录、注册均为真实接口（经 /gw 代理到网关 8100）。
 * 验证码答案只存在服务端 Redis，接口不返回明文，判错统一靠业务 code:0。
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
  /** base64 图片 data URI，直接绑到 <img :src> */
  challenge: string
  kind: 'image-base64'
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

// ===================== 验证码 =====================

interface CaptchaPayload {
  captchaKey: string
  imageBase64: string
}

/**
 * 取一张图形验证码。challenge 复用为 base64 图，可直接绑到 <img :src>。
 * 图形码是一次性的：服务端校验过一次就作废，所以提交失败后必须重新取图。
 */
export async function fetchCaptcha(): Promise<CaptchaChallenge> {
  const data = await request<Partial<CaptchaPayload> | null>('/auth/captcha')
  if (!data || typeof data.captchaKey !== 'string' || typeof data.imageBase64 !== 'string') {
    throw new HttpError('验证码响应格式异常', 0)
  }
  return { captchaKey: data.captchaKey, challenge: data.imageBase64, kind: 'image-base64' }
}
