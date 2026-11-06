// 精确刻画白底规则：宿主主题 light/dark × iframe 元素 color-scheme × 子文档 color-scheme
import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')
const { PNG } = require('F:/AAAJAVA/code/EZ_frontend/node_modules/pngjs')

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1430, height: 800 } })
await page.goto('http://127.0.0.1:5173/ai', { waitUntil: 'load' })
await page.waitForTimeout(6000)

const rect = await page.evaluate(() => {
  const r = document.querySelector('iframe.pet-widget').getBoundingClientRect()
  return [r.x, r.y, r.width, r.height]
})

async function sample(label) {
  const shot = await page.screenshot({ clip: { x: rect[0] + 4, y: rect[1] + 4, width: 20, height: 20 } })
  const png = PNG.sync.read(shot)
  let r = 0, g = 0, b = 0
  for (let i = 0; i < png.data.length; i += 4) { r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2] }
  const n = png.data.length / 4
  console.log(`${label.padEnd(46)} rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`)
}

const set = (hostTheme, frameScheme, childScheme) =>
  page.evaluate(
    ([ht, fs, cs]) => {
      document.documentElement.dataset.theme = ht
      const f = document.querySelector('iframe.pet-widget')
      f.style.colorScheme = fs
      const d = f.contentDocument
      d.documentElement.style.colorScheme = cs
      // 记录浏览器实际算出来的值
      window.__probe = {
        frameCS: getComputedStyle(f).colorScheme,
        childCS: getComputedStyle(d.documentElement).colorScheme,
        childBg: getComputedStyle(d.documentElement).backgroundColor,
      }
    },
    [hostTheme, frameScheme, childScheme],
  )

for (const theme of ['dark', 'light']) {
  for (const fs of ['', 'normal', 'light', 'dark']) {
    for (const cs of ['', 'normal', 'dark']) {
      await set(theme, fs, cs)
      await page.waitForTimeout(450)
      const p = await page.evaluate(() => window.__probe)
      await sample(`${theme} | frame=${fs || '(inherit)'} child=${cs || '(inherit)'} ${JSON.stringify(p.frameCS + '/' + p.childCS)}`)
    }
  }
}
await browser.close()
