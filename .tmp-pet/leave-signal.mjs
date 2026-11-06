// 找「收回接管」的可靠信号：宠物接管后把光标移开，宿主页能收到哪些事件？
import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1430, height: 800 } })
await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'load' })
await page.waitForTimeout(6000)

const frameSel = 'iframe.pet-widget'
await page.evaluate(() => {
  window.__log = []
  const types = ['mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'pointerover', 'pointerout', 'pointerleave', 'pointerenter', 'pointermove']
  for (const t of types) {
    window.addEventListener(
      t,
      (e) => window.__log.push(`${t} -> ${e.target.tagName}#${(e.relatedTarget && e.relatedTarget.tagName) || '-'}`),
      true,
    )
  }
})
// 子文档侧也记一份
const frame = page.frames().find((f) => f.url().includes('PetWidget'))
await frame.evaluate(() => {
  window.__log = []
  for (const t of ['pointerleave', 'pointerout', 'mouseleave', 'mouseout', 'pointermove']) {
    document.querySelector('.pet-hit').addEventListener(t, (e) => window.__log.push(`${t} rel=${(e.relatedTarget && e.relatedTarget.tagName) || 'null'}`))
    document.addEventListener(t, (e) => window.__log.push(`doc:${t} tgt=${e.target.tagName}`), true)
  }
})

const box = await page.frameLocator(frameSel).locator('.pet-hit').boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.waitForTimeout(250)
console.log('pe now:', await page.evaluate((s) => document.querySelector(s).style.pointerEvents, frameSel))
await page.evaluate(() => { window.__log = [] })
await frame.evaluate(() => { window.__log = [] })

// 1) 小幅移出命中盒（同一 iframe 内的空白处）
await page.mouse.move(box.x - 60, box.y + box.height / 2)
await page.waitForTimeout(250)
console.log('pe after small move-out:', await page.evaluate((s) => document.querySelector(s).style.pointerEvents, frameSel))
console.log('HOST log:', await page.evaluate(() => window.__log))
console.log('CHILD log:', await frame.evaluate(() => window.__log))

// 2) 大幅跳到别处（离开 iframe 覆盖区之外没有意义，整屏都是）
await page.evaluate(() => { window.__log = [] })
await frame.evaluate(() => { window.__log = [] })
await page.mouse.move(200, 700)
await page.waitForTimeout(250)
console.log('--- jump far ---')
console.log('HOST log:', await page.evaluate(() => window.__log))
console.log('CHILD log:', await frame.evaluate(() => window.__log))
await browser.close()
