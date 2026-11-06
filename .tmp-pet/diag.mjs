// 定点排查：1) 离开宠物后 pointer-events 何时翻回（一次事件被吞 vs 逻辑不生效）
//          2) 左键点宠物到底有没有换动画
import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1430, height: 800 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'load' })
await page.waitForTimeout(6000)

const frameSel = 'iframe.pet-widget'
const pe = () => page.evaluate((s) => document.querySelector(s).style.pointerEvents || getComputedStyle(document.querySelector(s)).pointerEvents, frameSel)

// 宿主侧记录收到的 mousemove 次数与最后一次判定结果
await page.evaluate(() => {
  window.__moves = []
  window.addEventListener(
    'mousemove',
    (e) => window.__moves.push([Math.round(e.clientX), Math.round(e.clientY), e.target.tagName]),
    true,
  )
})

const box = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.waitForTimeout(200)
console.log('over pet:', await pe())

await page.mouse.move(60, 60)
await page.waitForTimeout(200)
console.log('after 1 jump-out:', await pe())
await page.mouse.move(61, 61)
await page.waitForTimeout(200)
console.log('after 2nd move:', await pe())
console.log('host saw moves:', await page.evaluate(() => window.__moves))

// 慢慢移出命中盒（模拟真实手感）
const box2 = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2)
await page.waitForTimeout(150)
console.log('back on pet:', await pe())
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(box2.x + box2.width / 2 - i * 25, box2.y + box2.height / 2 - i * 20)
  await page.waitForTimeout(40)
  const cur = await pe()
  if (cur === 'none') {
    console.log(`slow move-out flipped to none at step ${i}`)
    break
  }
}
console.log('after slow out:', await pe())

/* 点击是否换动画 */
const before = await page.evaluate(() => ({ anim: sprites[0].anim, clicks: sprites[0].animations.clicks }))
const box3 = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2)
await page.waitForTimeout(150)
await page.mouse.down()
await page.waitForTimeout(60)
await page.mouse.up()
await page.waitForTimeout(600)
const after = await page.evaluate(() => ({ anim: sprites[0].anim, pressScoreFired: sprites[0].pressScoreFired, interactive: window.__dshPetDebug.interactive }))
console.log('click anim:', JSON.stringify({ before, after }))
await browser.close()
