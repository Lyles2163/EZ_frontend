import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1430, height: 601 } })
await page.goto('http://127.0.0.1:5173/ai', { waitUntil: 'load' })
await page.waitForTimeout(6000)
const r = await page.evaluate(() => {
  const f = document.querySelector('iframe.pet-widget')
  const cs = getComputedStyle(f)
  const doc = f.contentDocument
  return {
    parentColorScheme: getComputedStyle(document.documentElement).colorScheme,
    iframeColorScheme: cs.colorScheme,
    subHtmlColorScheme: getComputedStyle(doc.documentElement).colorScheme,
    subBodyColorScheme: getComputedStyle(doc.body).colorScheme,
    subHtmlBg: getComputedStyle(doc.documentElement).backgroundColor,
    iframeAttrs: f.attributes.length,
  }
})
console.log(JSON.stringify(r, null, 1))
// candidate fix A: color-scheme normal on the iframe element
await page.evaluate(() => { document.querySelector('iframe.pet-widget').style.colorScheme = 'normal' })
await page.waitForTimeout(800)
await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/fixA.png', clip: { x: 880, y: 0, width: 550, height: 480 } })
console.log('done')
await browser.close()
