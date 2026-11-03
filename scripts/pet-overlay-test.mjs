// 桌宠覆盖层验收：透明（逐点比对宿主底色）、默认整窗穿透、光标进宠物命中盒才接管、
// 离开后收回穿透、跨全屏拖拽、右键菜单开关、点宠物有反馈。
// 用法：先起 dsh-pet 独立模式与 npm run dev，再 node scripts/pet-overlay-test.mjs
import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')
const { PNG } = require('F:/AAAJAVA/code/EZ_frontend/node_modules/pngjs')

const VW = 1430
const VH = 800
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: VW, height: VH } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 160)) })
let fails = 0
const ok = (label, pass, extra = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ' :: ' + extra : ''}`) }

await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'load' })
await page.waitForTimeout(6000)
await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
await page.waitForTimeout(1500)

const frameSel = 'iframe.pet-widget'
const avg = async (x, y) => {
  const png = PNG.sync.read(await page.screenshot({ clip: { x, y, width: 6, height: 6 } }))
  let r = 0, g = 0, b = 0
  for (let i = 0; i < png.data.length; i += 4) { r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2] }
  const n = png.data.length / 4
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

/* 1. iframe 覆盖整屏 */
const rect = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }, frameSel)
ok('iframe 全屏', rect[2] === VW && rect[3] === VH, JSON.stringify(rect))

/* 2. 透明：藏起 iframe 取宿主底色，再亮出来逐点比对（原先这里是一整块 #fff） */
const pts = [[1100, 8], [1420, 8], [700, 400], [1420, 790], [40, 700]]
const hidden = []
const shown = []
await page.evaluate((s) => { document.querySelector(s).style.visibility = 'hidden' }, frameSel)
for (const [x, y] of pts) hidden.push(await avg(x, y))
await page.evaluate((s) => { document.querySelector(s).style.visibility = 'visible' }, frameSel)
for (const [x, y] of pts) shown.push(await avg(x, y))
const close = hidden.every((h, i) => Math.abs(h[0] - shown[i][0]) + Math.abs(h[1] - shown[i][1]) + Math.abs(h[2] - shown[i][2]) < 12)
ok('桌宠区域透出宿主底色（无白盒）', close, JSON.stringify({ hidden, shown }))

/* 3. 默认整窗穿透：命中目标应是宿主元素，且点输入框能拿到焦点 */
const hitHost = await page.evaluate((s) => {
  const f = document.querySelector(s)
  const el = document.elementFromPoint(700, 400)
  return { isIframe: el === f, tag: el ? el.tagName : null, pe: getComputedStyle(f).pointerEvents }
}, frameSel)
ok('空白处命中宿主元素（默认穿透）', !hitHost.isIframe && hitHost.pe === 'none', JSON.stringify(hitHost))

const inputBox = await page.evaluate(() => {
  const el = document.querySelector('input')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
if (inputBox) {
  await page.mouse.click(inputBox.x, inputBox.y)
  const active = await page.evaluate(() => document.activeElement.tagName)
  ok('穿透后宿主输入框可聚焦', active === 'INPUT', active)
}

/* 4. 光标进宠物矩形 → 接管；身体可点；跨全屏拖拽不被裁 */
const petBox = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
await page.mouse.move(petBox.x + petBox.width / 2, petBox.y + petBox.height / 2)
await page.waitForTimeout(200)
const pe = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).pointerEvents, frameSel)
ok('光标进宠物矩形后接管鼠标', pe === 'auto', pe)

const before = await page.evaluate((s) => document.querySelector(s).contentWindow.__dshPetDebug.dragPos, frameSel)
const cx = petBox.x + petBox.width / 2
const cy = petBox.y + petBox.height / 2
await page.mouse.down()
for (let i = 1; i <= 15; i++) {
  await page.mouse.move(cx - ((cx - 180) * i) / 15, cy - ((cy - 620) * i) / 15)
  await page.waitForTimeout(25)
}
await page.mouse.up()
await page.waitForTimeout(1500)
const after = await page.evaluate((s) => {
  const w = document.querySelector(s).contentWindow
  const r = w.document.querySelector('.pet-hit').getBoundingClientRect()
  return { pos: w.__dshPetDebug.dragPos, hit: [Math.round(r.x), Math.round(r.y)], inner: [w.innerWidth, w.innerHeight], busy: w.__dshPetDebug.inputBusy }
}, frameSel)
ok('拖拽跟手（跨全屏）', !!before && !!after.pos && Math.hypot(after.pos.x - before.x, after.pos.y - before.y) > 100, JSON.stringify({ before, after: after.pos }))
ok('落点在视口内（不再被 520x460 裁掉）', after.hit[0] > 0 && after.hit[1] > 0 && after.hit[0] < after.inner[0] && after.hit[1] < after.inner[1], JSON.stringify(after))
await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/verify-dragged.png' })

/* 5. 松手后离开宠物 → 恢复穿透 */
await page.mouse.move(60, 60)
await page.waitForTimeout(300)
const peBack = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).pointerEvents, frameSel)
ok('离开宠物后恢复穿透', peBack === 'none', peBack)

/* 6. 右键菜单：开 → 点宿主页别处 → 关（宠物会自己走位，每次点击前重新量一次命中盒） */
let menuOpen = false
for (let attempt = 0; attempt < 3 && !menuOpen; attempt++) {
  const b = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.waitForTimeout(120)
  const b2 = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
  await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2, { button: 'right' })
  await page.waitForTimeout(800)
  menuOpen = await page.evaluate((s) => !!document.querySelector(s).contentDocument.querySelector('.dsh-pet-menu'), frameSel)
}
ok('右键菜单能开', menuOpen)
await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/verify-menu.png' })
const menuBusy = await page.evaluate((s) => document.querySelector(s).contentWindow.__dshPetDebug.inputBusy, frameSel)
await page.mouse.click(300, 200)
await page.waitForTimeout(800)
const menuGone = await page.evaluate((s) => { const m = document.querySelector(s).contentDocument.querySelector('.dsh-pet-menu'); return !m || !m.isConnected }, frameSel)
ok('点宿主页别处后菜单收起', menuGone, 'busyWhileOpen=' + JSON.stringify(menuBusy))

/* 7. 左键点宠物有反馈：点击会换到「点击回应」动画并触发 Q 弹 */
const petFrame = page.frames().find((f) => f.url().includes('PetWidget'))
const animBefore = await petFrame.evaluate(() => ({ anim: sprites[0].anim, clicks: sprites[0].animations.clicks }))
const box3 = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2)
await page.waitForTimeout(150)
await page.mouse.down()
await page.waitForTimeout(60)
await page.mouse.up()
await page.waitForTimeout(700)
const animAfter = await petFrame.evaluate(() => ({ anim: sprites[0].anim, squash: sprites[0].pendingSquash, press: sprites[0].pressScoreFired }))
ok(
  '左键点宠物有反馈（换点击动画）',
  animBefore.clicks.includes(animAfter.anim) || animAfter.anim !== animBefore.anim,
  JSON.stringify({ before: animBefore.anim, after: animAfter.anim, clicks: animBefore.clicks.length }),
)

/* 8. 滚轮：指针在宠物身上时滚页面不该被吞 */
const box4 = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
await page.mouse.move(box4.x + box4.width / 2, box4.y + box4.height / 2)
await page.waitForTimeout(200)
const scrolled = await page.evaluate(async () => {
  const before = window.scrollY
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: 200 }))
  return { before, after: window.scrollY, docH: document.documentElement.scrollHeight, winH: innerHeight }
})
console.log('info 滚动状态:', JSON.stringify(scrolled))

await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/verify-final.png' })
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAIL`)
await browser.close()
