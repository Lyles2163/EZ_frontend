// 白色方块成因矩阵实验：在暗色宿主页上逐个施加候选修法，采样 iframe 空白角像素的 RGB，
// 数值化判断哪种改法真的让桌宠区域透出宿主背景。
import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')
const { PNG } = require('F:/AAAJAVA/code/EZ_frontend/node_modules/pngjs')

const CLIP = { x: 4, y: 4, width: 24, height: 24 } // iframe 内部左上角，宠物绝不可能覆盖这里

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1430, height: 800 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://127.0.0.1:5173/ai', { waitUntil: 'load' })
await page.waitForTimeout(6000)

const hostBg = await page.evaluate(() => {
  document.documentElement.dataset.theme = 'dark'
  const f = document.querySelector('iframe.pet-widget')
  const r = f.getBoundingClientRect()
  f.style.visibility = 'hidden'
  const el = document.elementFromPoint(r.x + 10, r.y + 10)
  const bg = el ? getComputedStyle(el).backgroundColor : null
  f.style.visibility = 'visible'
  return { url: location.href, rootScheme: getComputedStyle(document.documentElement).colorScheme, under: bg, rect: [r.x, r.y, r.width, r.height] }
})
console.log('host:', JSON.stringify(hostBg))
await page.waitForTimeout(1500)

async function sample(label) {
  const shot = await page.screenshot({ clip: { x: hostBg.rect[0] + CLIP.x, y: hostBg.rect[1] + CLIP.y, width: CLIP.width, height: CLIP.height } })
  const png = PNG.sync.read(shot)
  let r = 0, g = 0, b = 0
  for (let i = 0; i < png.data.length; i += 4) { r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2] }
  const n = png.data.length / 4
  console.log(`${label.padEnd(26)} rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`)
}

const reset = () =>
  page.evaluate(() => {
    const f = document.querySelector('iframe.pet-widget')
    f.style.cssText = ''
    const d = f.contentDocument
    d.documentElement.style.cssText = ''
    d.body.style.cssText = ''
    document.documentElement.style.colorScheme = ''
    for (const v of d.querySelectorAll('video')) v.style.cssText = ''
  })

const variants = [
  ['baseline', () => {}],
  ['iframe color-scheme:normal', () => page.evaluate(() => { document.querySelector('iframe.pet-widget').style.colorScheme = 'normal' })],
  ['root color-scheme:normal', () => page.evaluate(() => { document.documentElement.style.colorScheme = 'normal' })],
  ['child html color-scheme:normal', () => page.evaluate(() => { document.querySelector('iframe.pet-widget').contentDocument.documentElement.style.colorScheme = 'normal' })],
  ['child html bg !important', () => page.evaluate(() => { const d = document.querySelector('iframe.pet-widget').contentDocument; d.documentElement.style.setProperty('background', 'transparent', 'important'); d.body.style.setProperty('background', 'transparent', 'important') })],
  ['videos hidden', () => page.evaluate(() => { for (const v of document.querySelector('iframe.pet-widget').contentDocument.querySelectorAll('video')) v.style.display = 'none' })],
  ['iframe opacity .999', () => page.evaluate(() => { document.querySelector('iframe.pet-widget').style.opacity = '0.999' })],
  ['iframe isolation:isolate', () => page.evaluate(() => { document.querySelector('iframe.pet-widget').style.isolation = 'isolate' })],
  ['child overflow:visible', () => page.evaluate(() => { const d = document.querySelector('iframe.pet-widget').contentDocument; d.documentElement.style.overflow = 'visible'; d.body.style.overflow = 'visible' })],
  ['child html bg rgba0', () => page.evaluate(() => { const d = document.querySelector('iframe.pet-widget').contentDocument; d.documentElement.style.background = 'rgba(0,0,0,0)' })],
]

for (const [label, apply] of variants) {
  await reset()
  await page.waitForTimeout(300)
  await apply()
  await page.waitForTimeout(900)
  await sample(label)
}
await reset()
await page.waitForTimeout(600)
await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/matrix-baseline.png' })
await browser.close()
