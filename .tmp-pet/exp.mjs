import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1430, height: 601 } })
await page.goto('http://127.0.0.1:5173/ai', { waitUntil: 'load' })
await page.waitForTimeout(5000)
await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
await page.waitForTimeout(1000)
const shot = async (name) => page.screenshot({ path: `F:/AAAJAVA/code/EZ_frontend/.tmp-pet/${name}.png`, clip: { x: 880, y: 0, width: 550, height: 480 } })
await shot('e0-baseline')

const probe = () => page.evaluate(() => {
  const f = document.querySelector('iframe.pet-widget')
  const r = f.getBoundingClientRect()
  const px = (x, y) => { const el = document.elementFromPoint(x, y); return el ? (el.tagName + '.' + (el.className.baseVal ?? el.className ?? '').toString().slice(0,40)) : null }
  return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, atCenter: px(r.x + 200, r.y + 200), atOutside: px(400, 300) }
})
console.log('probe:', JSON.stringify(await probe()))

// H1: kill all backdrop-filter on the host page
await page.addStyleTag({ content: '*,*::before,*::after{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}' })
await page.waitForTimeout(800)
await shot('e1-no-backdrop')

// H2: also kill background-image gradients on html/body
await page.evaluate(() => { document.documentElement.style.backgroundImage = 'none'; document.body.style.backgroundImage = 'none' })
await page.waitForTimeout(800)
await shot('e2-no-gradient')

// H3: put the iframe as a direct child of <body>
await page.evaluate(() => { document.body.appendChild(document.querySelector('iframe.pet-widget')) })
await page.waitForTimeout(800)
await shot('e3-body-child')
console.log('done')
await browser.close()
