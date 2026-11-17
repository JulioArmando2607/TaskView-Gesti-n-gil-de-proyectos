// Lista 01 only: synthetic browser regression against localhost laboratory.
// Credentials arrive through stdin; never emit tokens, passwords or response bodies.
import { chromium } from 'playwright'

const input = await new Promise((resolve, reject) => {
  let body = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => { body += chunk })
  process.stdin.on('end', () => resolve(JSON.parse(body)))
  process.stdin.on('error', reject)
})

const base = 'http://127.0.0.1:18888'
if (!input.login || !input.password) throw new Error('Synthetic credentials missing')

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const context = await browser.newContext()
const page = await context.newPage()
const suspicious = []
const errors = []
const refreshStatuses = []
const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/
const sensitiveLabel = /We got refresh data tokens|We got new token|refreshToken\s*[:=]|Authorization\s*[:=]\s*Bearer/i

page.on('console', (message) => {
  const value = message.text()
  if (jwtPattern.test(value) || sensitiveLabel.test(value)) suspicious.push(message.type())
})
page.on('pageerror', () => { errors.push('pageerror') })
page.on('response', (response) => {
  const url = new URL(response.url())
  if (url.port === '11725' && url.pathname.includes('/module/auth/refresh/token')) {
    refreshStatuses.push(response.status())
  }
})

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.setItem('store_task_view.task_view.locale', 'en'))
  await page.reload()
  await page.getByTestId('login-input').waitFor()
  if (await page.getByRole('tab', { name: /password/i }).count()) {
    await page.getByRole('tab', { name: /password/i }).click()
  }
  await page.getByTestId('login-input').fill(input.login)
  await page.getByTestId('password-input').fill(input.password)
  await page.getByTestId('sign-in-button').click()
  await page.waitForURL((url) => url.pathname !== '/', { timeout: 15000 })
  const stored = await page.evaluate(() => Boolean(localStorage.getItem('store_task_view.task_view.access') && localStorage.getItem('store_task_view.task_view.refresh')))
  if (!stored) throw new Error('Login did not store access and refresh tokens')
  console.log('login: PASS; credentials persisted in browser storage')

  // Preserve a valid JWT payload but invalidate its signature, forcing a 401 and
  // the application's normal refresh/retry path on the next authenticated read.
  const invalidated = await page.evaluate(() => {
    const key = 'store_task_view.task_view.access'
    const token = localStorage.getItem(key)
    if (!token || token.split('.').length !== 3) return false
    localStorage.setItem(key, `${token.slice(0, token.lastIndexOf('.'))}.invalid`)
    return true
  })
  if (!invalidated) throw new Error('Unable to prepare refresh probe')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (!refreshStatuses.includes(200)) throw new Error(`Refresh not observed as successful; statuses=${refreshStatuses.join(',') || 'none'}`)
  const refreshed = await page.evaluate(() => {
    const value = localStorage.getItem('store_task_view.task_view.access')
    return Boolean(value && !value.endsWith('.invalid'))
  })
  if (!refreshed) throw new Error('Refresh did not replace invalid access token')
  console.log('refresh: PASS; 401 recovery returned 200 and replaced access token')

  await page.getByTestId('user-menu').first().click()
  await page.getByRole('menuitem', { name: /log out|logout|sign out/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 })
  const cleared = await page.evaluate(() => !localStorage.getItem('store_task_view.task_view.access') && !localStorage.getItem('store_task_view.task_view.refresh'))
  if (!cleared) throw new Error('Logout did not clear tokens')
  console.log('logout: PASS; browser tokens cleared')
  console.log(`console-sensitive-patterns: ${suspicious.length}; pageerrors: ${errors.length}; refresh-http-200: ${refreshStatuses.filter((s) => s === 200).length}`)
  if (suspicious.length) throw new Error('Sensitive pattern in browser console')
  if (errors.length) throw new Error('Browser page error detected')
} finally {
  await context.close()
  await browser.close()
}
