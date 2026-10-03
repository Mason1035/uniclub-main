// 抓 dsh 页面左上角 deepseek HARNESS 标志 + 官网 logo
import { chromium } from '/home/tenbox/Desktop/Devspace/cenacle/web/node_modules/playwright/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 3 })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
await page.waitForTimeout(2500)
await page.screenshot({ path: '/tmp/petskin/ref/dsh_full.png' })
// 左上角区域放大
await page.screenshot({ path: '/tmp/petskin/ref/dsh_logo.png', clip: { x: 0, y: 0, width: 320, height: 80 } })

const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
await page2.goto('https://www.deepseek.com/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
await page2.waitForTimeout(4000)
await page2.screenshot({ path: '/tmp/petskin/ref/deepseek_com.png' })
await browser.close()
console.log('done')
