// 验证「说话气泡」链路：先打开渲染页（让它建立状态基线），
// 再经 HTTP API 投喂一句话（模拟 PetWidget 的 petBus 触发），等轮询到 say 叶子后截图。
import { createRequire } from 'node:module'

const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')
const { readFileSync } = await import('node:fs')
const { homedir } = await import('node:os')
const { join } = await import('node:path')

const rt = JSON.parse(
  readFileSync(join(homedir(), '.dsh', 'dsh-pet', 'standalone-runtime.json'), 'utf8'),
)
const base = `http://127.0.0.1:${rt.port}/dsh-pet-7340`
const headers = { 'content-type': 'application/json', 'x-dsh-pet-token': rt.token }

// 1. 先打开渲染页，等它 boot + 建立状态基线
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 520, height: 460 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://127.0.0.1:5173/PetWidget/index.html', { waitUntil: 'load' })
await page.waitForFunction(() => window.__dshPetDebug?.configOk === true, null, { timeout: 10000 })
await page.waitForTimeout(1500)

// 2. 模拟业务事件：答对 -> 取锁 -> 播动画 -> 说话 -> 释放
const lock = await (
  await fetch(`${base}/lock?pet=main&surface=web`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ttl: 60000 }),
  })
).json()
if (!lock.ok) throw new Error('lock failed: ' + JSON.stringify(lock))

const anim = await (
  await fetch(`${base}/anim?pet=main&surface=web&lock=${lock.lockId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: '点击回应-开心跃动' }),
  })
).json()
console.log('anim:', JSON.stringify(anim))

const say = await (
  await fetch(`${base}/broadcast?pet=main&surface=web&lock=${lock.lockId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: '答对啦！主人真棒~', duration: 20000 }),
  })
).json()
console.log('broadcast:', JSON.stringify(say))

await fetch(`${base}/lock/release?pet=main&surface=web`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ lockId: lock.lockId }),
})

// 3. 等轮询收到 say 叶子并渲染气泡
await page.waitForTimeout(3000)
const bubble = await page.evaluate(() => {
  const el = document.querySelector('.pet-bubble')
  return {
    text: el?.textContent ?? null,
    classes: el?.classList.toString() ?? null,
    title: window.__dshPetDebug?.lastBubbleTitle ?? null,
  }
})
console.log('bubble state:', JSON.stringify(bubble, null, 2))

await page.screenshot({ path: 'pet-bubble.png' })
console.log('screenshot -> pet-bubble.png')
await browser.close()
