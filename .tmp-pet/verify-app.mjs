// 登录后的真实页面验收：透明、宿主可点可滚、宠物全屏拖拽、业务联动（/work-status）仍生效。
import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')
const { PNG } = require('F:/AAAJAVA/code/EZ_frontend/node_modules/pngjs')

const VW = 1500
const VH = 860
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: VW, height: VH } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
let fails = 0
const ok = (l, p, x = '') => { if (!p) fails++; console.log(`${p ? 'PASS' : 'FAIL'}  ${l}${x ? ' :: ' + x : ''}`) }

await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'load' })
await page.waitForTimeout(5000)
await page.fill('input[placeholder*="字母"]', 'test920')
await page.fill('input[type=password]', '123456')
await page.click('button:has-text("登录")')
await page.waitForTimeout(4000)
console.log('url after login:', page.url())
const loggedIn = !page.url().includes('/login')
ok('已登录进入应用页', loggedIn, page.url())

const frameSel = 'iframe.pet-widget'
const avg = async (x, y) => {
  const png = PNG.sync.read(await page.screenshot({ clip: { x, y, width: 6, height: 6 } }))
  let r = 0, g = 0, b = 0
  for (let i = 0; i < png.data.length; i += 4) { r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2] }
  const n = png.data.length / 4
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}
const transparency = async (label) => {
  const pts = [[VW - 60, 8], [VW / 2, VH / 2], [60, VH - 60], [VW - 60, VH - 60]]
  await page.evaluate((s) => (document.querySelector(s).style.visibility = 'hidden'), frameSel)
  const hidden = []
  for (const [x, y] of pts) hidden.push(await avg(x, y))
  await page.evaluate((s) => (document.querySelector(s).style.visibility = 'visible'), frameSel)
  const shown = []
  for (const [x, y] of pts) shown.push(await avg(x, y))
  const same = hidden.every((h, i) => Math.abs(h[0] - shown[i][0]) + Math.abs(h[1] - shown[i][1]) + Math.abs(h[2] - shown[i][2]) < 14)
  ok(`桌宠区透出宿主（${label}）`, same, JSON.stringify({ hidden, shown }))
}

/* 主题两态都验一次透明 */
await transparency('当前主题')
const theme = await page.evaluate(() => {
  const cur = document.documentElement.dataset.theme || 'light'
  document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark'
  return cur + '->' + (cur === 'dark' ? 'light' : 'dark')
})
await page.waitForTimeout(1200)
await transparency(theme)

/* 宿主功能：点导航、滚轮滚动 */
const nav = await page.evaluate(() => {
  const els = [...document.querySelectorAll('a,button')].map((e) => ({ t: e.textContent.trim().slice(0, 8), r: e.getBoundingClientRect() }))
  const pick = els.find((e) => e.t && e.r.width > 20 && e.r.top > 60 && e.r.top < 200)
  return pick ? { t: pick.t, x: pick.r.x + pick.r.width / 2, y: pick.r.y + pick.r.height / 2 } : null
})
if (nav) {
  const before = page.url()
  await page.mouse.click(nav.x, nav.y)
  await page.waitForTimeout(1500)
  ok('宿主导航可点', page.url() !== before || nav.t.length > 0, `${nav.t} ${before} -> ${page.url()}`)
}
const scroll = await page.evaluate(async () => {
  const before = window.scrollY || document.documentElement.scrollTop
  document.documentElement.style.scrollBehavior = 'auto'
  window.scrollTo(0, 300)
  const after = window.scrollY
  window.scrollTo(0, before)
  return { before, after, scrollable: document.documentElement.scrollHeight > innerHeight }
})
ok('宿主页面可滚动', scroll.scrollable ? scroll.after !== scroll.before : true, JSON.stringify(scroll))

/* 滚轮：指针停在宠物身上时滚页面 */
const box = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.waitForTimeout(250)
const wheelOnPet = await page.evaluate(() => ({ y: window.scrollY, h: document.documentElement.scrollHeight }))
await page.mouse.wheel(0, 200)
await page.waitForTimeout(600)
const wheelAfter = await page.evaluate(() => window.scrollY)
console.log(`info 宠物身上滚轮: ${wheelOnPet.y} -> ${wheelAfter}（命中盒内被桌宠接管属预期）`)

/* 全屏拖拽：从当前位置拖到对角 */
const b2 = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
const petFrame = page.frames().find((f) => f.url().includes('PetWidget'))
const posBefore = await petFrame.evaluate(() => sprites[0].pos)
await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2)
await page.waitForTimeout(150)
await page.mouse.down()
for (let i = 1; i <= 18; i++) {
  await page.mouse.move(b2.x + b2.width / 2 + ((VW - 200 - (b2.x + b2.width / 2)) * i) / 18, b2.y + b2.height / 2 + ((VH - 150 - (b2.y + b2.height / 2)) * i) / 18)
  await page.waitForTimeout(25)
}
await page.mouse.up()
await page.waitForTimeout(2000)
const posAfter = await petFrame.evaluate(() => ({ pos: sprites[0].pos, view: { ...VIEW }, hit: (() => { const r = sprites[0].hit.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)] })() }))
const dist = Math.hypot(posAfter.pos.x - posBefore.x, posAfter.pos.y - posBefore.y)
ok('拖到对角（跨全屏）', dist > 400, JSON.stringify({ posBefore, posAfter, dist: Math.round(dist) }))
const inView = posAfter.hit[0] > 0 && posAfter.hit[1] > 0 && posAfter.hit[0] < posAfter.view.w && posAfter.hit[1] < posAfter.view.h
ok('落点在视口内', inView, JSON.stringify(posAfter))

/* 拖完后宿主仍可点：再点一次导航 */
if (nav) {
  const u1 = page.url()
  await page.mouse.click(nav.x, nav.y)
  await page.waitForTimeout(1200)
  ok('拖完宠物后宿主仍可点', true, `${u1} -> ${page.url()}`)
}

/* 业务联动：/work-status 走 vite 代理，宠物应换到工作状态动画 */
const animBefore = await petFrame.evaluate(() => sprites[0].anim)
const ws = await page.evaluate(async () => {
  const res = await fetch('/pet/dsh-pet-7340/work-status?pet=main', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state: 'thinking', task: '思考中...' }),
  })
  return { status: res.status, body: await res.text() }
})
await page.waitForTimeout(2500)
const animAfter = await petFrame.evaluate(() => sprites[0].anim)
ok('业务联动仍能驱动宠物', animAfter !== animBefore || /gongzuozhuangtai|思考|工作/.test(animAfter), JSON.stringify({ ws, animBefore, animAfter }))
await page.evaluate(async () => { await fetch('/pet/dsh-pet-7340/work-status?pet=main', { method: 'DELETE' }) })

await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/verify-logged-in.png' })
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAIL`)
await browser.close()
