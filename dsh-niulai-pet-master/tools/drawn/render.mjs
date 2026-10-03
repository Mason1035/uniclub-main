// 用法: node render.mjs <svg> <png> <w> <h>
// 透明底截图: omitBackground + deviceScaleFactor 2
import { chromium } from '/home/tenbox/Desktop/Devspace/cenacle/web/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const [, , svgPath, pngPath, w, h] = process.argv
const svg = fs.readFileSync(svgPath, 'utf8')
const html = `<!doctype html><html><body style="margin:0;padding:0">${svg}</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 })
await page.setContent(html, { waitUntil: 'load' })
await page.screenshot({ path: pngPath, omitBackground: true })
await browser.close()
console.log('rendered', pngPath)
