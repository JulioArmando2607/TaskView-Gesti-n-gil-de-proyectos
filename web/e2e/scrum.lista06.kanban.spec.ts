import { expect, request, test } from '@playwright/test'

const API_URL = process.env.SCRUM_TEST_API_URL ?? 'http://127.0.0.1:11725'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:18888'

test('Kanban profesional muestra metadatos Scrum y filtros combinables', async ({ page }) => {
  const email = process.env.SCRUM_TEST_EMAIL
  const password = process.env.SCRUM_TEST_PASSWORD
  const goalId = process.env.SCRUM_TEST_PROJECT_ID
  const orgSlug = process.env.SCRUM_TEST_ORG_SLUG
  test.skip(!email || !password || !goalId || !orgSlug, 'Requires isolated Scrum credentials')

  const auth = await request.newContext({ baseURL: API_URL })
  const login = await auth.post('/module/auth/login', { form: { login: email!, password: password! } })
  expect(login.status()).toBe(200)
  const tokens = await login.json() as { access: string; refresh: string }
  await auth.dispose()

  await page.route('**/config.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `window.__TASKVIEW_CONFIG__ = { apiUrl: "${API_URL}" }`,
  }))
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('store_task_view.task_view.access', access)
    localStorage.setItem('store_task_view.task_view.refresh', refresh)
  }, tokens)
  await page.goto(`${BASE_URL}/${orgSlug}/${goalId}/kanban`)

  await expect(page.getByTestId('kanban-type-filter').first()).toBeVisible()
  await expect(page.getByTestId('kanban-priority-filter').first()).toBeVisible()
  await expect(page.getByTestId(/kanban-column-count-/).first()).toBeVisible()

  const api = await request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${tokens.access}` },
  })
  const filtered = await api.get(`/module/kanban/tasks/${goalId}/13/null?workItemTypes=story&priorityIds=1`)
  expect(filtered.status()).toBe(200)
  const body = await filtered.json() as { response: { tasks: Array<{ workItemType?: string; priorityId?: number }> } }
  expect(body.response.tasks.every((item) => item.workItemType === 'story' && item.priorityId === 1)).toBeTruthy()
  await api.dispose()
})
