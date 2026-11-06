import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5173/host-test.html', { waitUntil: 'load' })
await page.waitForTimeout(5000)
await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/dark-1x.png' })
// also capture the pet frame alone with a forced dark host by overriding host bg
await page.evaluate(() => { document.body.style.background = '#121216' })
await page.waitForTimeout(1200)
await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/dark-1x-b.png' })
await browser.close()
