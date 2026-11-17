import { expect, request, test } from '@playwright/test'

const API_URL = process.env.SCRUM_TEST_API_URL ?? 'http://127.0.0.1:11725'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:18888'

async function authenticatedContext(email: string, password: string) {
  const loginApi = await request.newContext({ baseURL: API_URL })
  const login = await loginApi.post('/module/auth/login', { form: { login: email, password } })
  expect(login.status()).toBe(200)
  const tokens = await login.json() as { access: string; refresh: string }
  await loginApi.dispose()
  return {
    tokens,
    api: await request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${tokens.access}` },
    }),
  }
}

function requireFixture() {
  const email = process.env.SCRUM_TEST_EDITOR_EMAIL ?? 'l04-editor@example.invalid'
  const password = process.env.SCRUM_TEST_PASSWORD
  const projectId = process.env.SCRUM_TEST_PROJECT_ID ?? '5'
  const orgSlug = process.env.SCRUM_TEST_ORG_SLUG ?? 'l04-synthetic-org'
  test.skip(!password, 'Requires isolated L04 synthetic password')
  return { email, password: password!, projectId, orgSlug }
}

test('reports page loads filters and both export actions', async ({ page }) => {
  const fixture = requireFixture()
  const session = await authenticatedContext(fixture.email, fixture.password)
  await page.route('**/config.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `window.__TASKVIEW_CONFIG__ = { apiUrl: "${API_URL}" }`,
  }))
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('store_task_view.task_view.access', access)
    localStorage.setItem('store_task_view.task_view.refresh', refresh)
  }, session.tokens)
  await page.goto(`${BASE_URL}/${fixture.orgSlug}/${fixture.projectId}/scrum`)
  await expect(page.getByText('Backlog', { exact: true }).first()).toBeVisible()
  await page.evaluate(({ orgSlug, projectId }) => {
    window.history.pushState({}, '', `/${orgSlug}/${projectId}/reports`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, fixture)
  await expect(page).toHaveURL(new RegExp(`/${fixture.projectId}/reports$`))
  await expect(page.getByRole('heading', { name: /Reportes Scrum/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'CSV' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Excel' })).toBeVisible()
  await expect(page.getByText('Comprometidas', { exact: true })).toBeVisible()
  await session.api.dispose()
})

test('reports API preserves type filters and valid CSV/XLSX exports', async () => {
  const fixture = requireFixture()
  const session = await authenticatedContext(fixture.email, fixture.password)
  const stories = await session.api.get(`/module/scrum/reports/${fixture.projectId}/overview?type=story&limit=200`)
  expect(stories.status()).toBe(200)
  const storyBody = await stories.json() as { response: { items: Array<{ type: string }> } }
  expect(storyBody.response.items.every(item => item.type === 'story')).toBeTruthy()
  for (const format of ['csv', 'xlsx']) {
    const response = await session.api.get(`/module/scrum/reports/${fixture.projectId}/export?format=${format}`)
    expect(response.status()).toBe(200)
    const bytes = await response.body()
    expect(bytes.length).toBeGreaterThan(100)
    if (format === 'xlsx') expect(bytes.subarray(0, 2).toString()).toBe('PK')
  }
  await session.api.dispose()
})

test('reader and out-of-scope user cannot access Scrum reports', async () => {
  const password = process.env.SCRUM_TEST_PASSWORD
  const projectId = process.env.SCRUM_TEST_PROJECT_ID ?? '5'
  test.skip(!password, 'Requires isolated L04 synthetic password')
  const reader = await authenticatedContext(process.env.SCRUM_TEST_READER_EMAIL ?? 'l04-reader@example.invalid', password!)
  const noAccess = await authenticatedContext(process.env.SCRUM_TEST_NOACCESS_EMAIL ?? 'l04-noaccess@example.invalid', password!)
  expect((await reader.api.get(`/module/scrum/reports/${projectId}/overview`)).status()).toBe(403)
  expect((await noAccess.api.get(`/module/scrum/reports/${projectId}/overview`)).status()).toBe(403)
  await reader.api.dispose()
  await noAccess.api.dispose()
})

test('QA review, observation and approval persist for a Scrum story', async () => {
  const fixture = requireFixture()
  const session = await authenticatedContext(fixture.email, fixture.password)
  const created = await session.api.post(`/module/scrum/goals/${fixture.projectId}/items`, {
    data: { type: 'story', description: `L04-QA-${Date.now()}`, acceptanceCriteria: 'QA evidence is recorded' },
  })
  expect(created.status()).toBe(201)
  const story = (await created.json() as { response: { id: number } }).response
  const observed = await session.api.post(`/module/scrum/items/${story.id}/qa`, { data: { status: 'observed', evidence: 'First run' } })
  expect(observed.status()).toBe(201)
  const review = (await observed.json() as { response: { id: number } }).response
  const observation = await session.api.post(`/module/scrum/items/${story.id}/qa/observations`, { data: { reviewId: review.id, note: 'Acceptance evidence needs a screenshot' } })
  expect(observation.status()).toBe(201)
  const approved = await session.api.post(`/module/scrum/items/${story.id}/qa`, { data: { status: 'approved', evidence: 'Evidence attached' } })
  expect(approved.status()).toBe(201)
  const reviews = await session.api.get(`/module/scrum/items/${story.id}/qa`)
  expect(reviews.status()).toBe(200)
  const rows = (await reviews.json() as { response: Array<{ status: string; observations: Array<{ note: string }> }> }).response
  expect(rows.map(row => row.status)).toEqual(expect.arrayContaining(['observed', 'approved']))
  expect(rows.flatMap(row => row.observations).map(item => item.note)).toContain('Acceptance evidence needs a screenshot')
  await session.api.delete('/module/tasks', { data: { id: story.id } })
  await session.api.dispose()
})

test('Scrum project dashboard loads for the authorized editor', async ({ page }) => {
  const fixture = requireFixture()
  const session = await authenticatedContext(fixture.email, fixture.password)
  await page.route('**/config.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `window.__TASKVIEW_CONFIG__ = { apiUrl: "${API_URL}" }`,
  }))
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('store_task_view.task_view.access', access)
    localStorage.setItem('store_task_view.task_view.refresh', refresh)
  }, session.tokens)
  await page.goto(`${BASE_URL}/${fixture.orgSlug}/${fixture.projectId}/dashboard`)
  await expect(page.getByTestId('project-dashboard')).toBeVisible({ timeout: 15_000 })
  await session.api.dispose()
})

test('sprint lifecycle reaches review and persists retrospective evidence', async () => {
  const fixture = requireFixture()
  const session = await authenticatedContext(fixture.email, fixture.password)
  const startDate = new Date().toISOString().slice(0, 10)
  const endDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const created = await session.api.post('/module/sprints', {
    data: { goalId: Number(fixture.projectId), name: `L04-E2E-${Date.now()}`, startDate, endDate, goalText: 'E2E lifecycle', capacity: 8 },
  })
  expect(created.status()).toBe(200)
  const sprint = (await created.json() as { response: { id: number } }).response
  const activated = await session.api.post(`/module/sprints/sprint/${sprint.id}/activate`, { data: {} })
  expect(activated.status()).toBe(200)
  const review = await session.api.post(`/module/sprints/sprint/${sprint.id}/review`, { data: {} })
  expect(review.status()).toBe(200)
  const summary = await session.api.get(`/module/scrum/sprints/${sprint.id}/review-summary`)
  expect(summary.status()).toBe(200)
  const retro = await session.api.put(`/module/sprints/sprint/${sprint.id}/retro`, { data: { wentWell: 'Flow executed', wentBad: 'None', actionItems: 'Keep evidence' } })
  expect(retro.status()).toBe(200)
  const action = await session.api.post(`/module/sprints/sprint/${sprint.id}/retro-actions`, { data: { description: 'Retain synthetic evidence', status: 'planned' } })
  expect(action.status()).toBe(200)
  const persisted = await session.api.get(`/module/sprints/sprint/${sprint.id}`)
  expect(persisted.status()).toBe(200)
  expect((await persisted.json() as { response: { status: string; retro: { wentWell: string } } }).response).toMatchObject({ status: 'review', retro: { wentWell: 'Flow executed' } })
  await session.api.delete(`/module/sprints/sprint/${sprint.id}`)
  await session.api.dispose()
})
