// 工作状态联动为什么没动：看子文档的轮询与错误，以及 /state 里 workStatus 的真实形状
import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1500, height: 860 } })
const reqs = []
page.on('request', (r) => { if (r.url().includes('/pet/')) reqs.push(r.method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')) })
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 180)) })
await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'load' })
await page.waitForTimeout(7000)

const petFrame = page.frames().find((f) => f.url().includes('PetWidget'))
const snap = () =>
  petFrame.evaluate(() => ({
    configOk: window.__dshPetDebug.configOk,
    errors: window.__dshPetDebug.errors,
    workTick: typeof workTick !== 'undefined' ? workTick : null,
    loops: typeof loopsStarted !== 'undefined' ? loopsStarted : null,
    pool: sprites[0].animations.events && sprites[0].animations.events.workStatus,
    enabled: sprites[0].pet.workStatusEnabled,
    anim: sprites[0].anim,
    bubble: (document.querySelector('.pet-bubble') || {}).textContent,
  }))
console.log('debug:', JSON.stringify(await snap()))

console.log('--- POST work-status ---')
console.log(await page.evaluate(async () => {
  const r = await fetch('/pet/dsh-pet-7340/work-status?pet=main', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state: 'thinking', task: '思考中' }) })
  return { status: r.status, body: await r.text() }
}))
await page.waitForTimeout(4000)
console.log('after:', JSON.stringify(await snap()))
console.log('state shape:', (await page.evaluate(async () => (await fetch('/pet/dsh-pet-7340/state?pet=main')).text())).slice(0, 400))
console.log('pet requests seen:', reqs.slice(0, 12))
await browser.close()
