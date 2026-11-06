import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1430, height: 601 }, deviceScaleFactor: 2 })
page.on('console', m => { const t = m.text(); if (/pet|Pet|error/i.test(t)) console.log('[console]', t.slice(0, 200)) })
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)))
await page.goto('http://127.0.0.1:5173/ai', { waitUntil: 'load' })
await page.waitForTimeout(6000)
// force dark theme like the user's screenshot
await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
await page.waitForTimeout(1500)
const info = await page.evaluate(() => {
  const f = document.querySelector('iframe.pet-widget')
  if (!f) return 'no iframe'
  const r = f.getBoundingClientRect()
  return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, bg: getComputedStyle(f).backgroundColor }
})
console.log('iframe:', JSON.stringify(info))
await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/ai-dark.png' })
await browser.close()
