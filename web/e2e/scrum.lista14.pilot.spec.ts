import { expect, request, test } from '@playwright/test'

const API_URL = process.env.SCRUM_TEST_API_URL ?? 'http://127.0.0.1:11725'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:18888'
const PROJECT_ID = Number(process.env.SCRUM_PILOT_PROJECT_ID ?? 6)
const ORG_SLUG = process.env.SCRUM_TEST_ORG_SLUG ?? 'l04-synthetic-org'

async function auth(email: string, password: string) {
  const loginApi = await request.newContext({ baseURL: API_URL })
  const login = await loginApi.post('/module/auth/login', { form: { login: email, password } })
  expect(login.status()).toBe(200)
  const tokens = await login.json() as { access: string; refresh: string }
  await loginApi.dispose()
  return {
    tokens,
    api: await request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Authorization: `Bearer ${tokens.access}` } }),
  }
}

async function resetPilotSprints(api: Awaited<ReturnType<typeof auth>>['api']) {
  const listed = await api.get(`/module/sprints/${PROJECT_ID}`)
  expect(listed.status()).toBe(200)
  const sprints = (await listed.json() as { response: Array<{ id: number; status: string }> }).response
  for (const sprint of sprints.filter(item => item.status === 'draft' || item.status === 'planned')) {
    await api.delete(`/module/sprints/sprint/${sprint.id}`)
  }
  for (const sprint of sprints.filter(item => item.status === 'active' || item.status === 'review')) {
    if (sprint.status === 'active') {
      const review = await api.post(`/module/sprints/sprint/${sprint.id}/review`, { data: {} })
      expect(review.status()).toBe(200)
    }
    const closed = await api.post(`/module/sprints/sprint/${sprint.id}/close`, { data: { outcomes: [], goalAchieved: false } })
    expect(closed.status()).toBe(200)
  }
}

test('piloto L04 ejecuta flujo Scrum operativo y contrasta indicadores', async ({ page }) => {
  const password = process.env.SCRUM_TEST_PASSWORD
  const email = process.env.SCRUM_PILOT_OPERATOR_EMAIL ?? 'l04-owner@example.invalid'
  test.skip(!password, 'Requires isolated L04 synthetic password')
  const session = await auth(email, password!)
  await resetPilotSprints(session.api)
  const suffix = `L04-PILOTO-${Date.now()}`

  const statusesResponse = await session.api.post('/module/kanban/fetch-statuses', { data: { goalId: PROJECT_ID } })
  expect(statusesResponse.status()).toBe(200)
  const statuses = (await statusesResponse.json() as { response: Array<{ id: number; name: string }> }).response
  const todo = statuses[0]?.id
  const inProgress = statuses[1]?.id
  const done = statuses[2]?.id
  expect([todo, inProgress, done].every(Boolean)).toBeTruthy()

  const epicResponse = await session.api.post(`/module/scrum/goals/${PROJECT_ID}/epics`, { data: { title: 'Gestión de cartera de cobranza', details: 'Épica sintética del piloto L04' } })
  expect(epicResponse.status()).toBe(201)
  const epic = (await epicResponse.json() as { response: { id: number } }).response

  const storyResponse = await session.api.post(`/module/scrum/goals/${PROJECT_ID}/items`, {
    data: {
      type: 'story', description: `${suffix} HU-01 Carga y actualización de cartera`, epicId: epic.id,
      acceptanceCriteria: 'Carga el periodo, actualiza registros, muestra consolidado y conserva evidencia QA.',
      estimateValue: 8, owner: 7, statusId: todo,
    },
  })
  expect(storyResponse.status()).toBe(201)
  const story = (await storyResponse.json() as { response: { id: number } }).response

  const taskTitles = ['Implementación backend', 'Desarrollo frontend', 'Integración de servicios', 'Pruebas funcionales', 'Validación y aprobación QA']
  const taskIds: number[] = []
  for (const [index, title] of taskTitles.entries()) {
    const response = await session.api.post(`/module/scrum/goals/${PROJECT_ID}/items`, {
      data: { type: 'task', description: `${suffix} ${title}`, parentId: story.id, owner: index === 0 ? 7 : 8, estimateValue: 2, statusId: todo },
    })
    expect(response.status()).toBe(201)
    taskIds.push((await response.json() as { response: { id: number } }).response.id)
  }

  const bugResponse = await session.api.post(`/module/scrum/goals/${PROJECT_ID}/items`, {
    data: { type: 'bug', description: `${suffix} Bug: periodo no actualiza consolidado`, relatedTaskId: story.id, priorityId: 2, owner: 7, statusId: todo },
  })
  expect(bugResponse.status()).toBe(201)
  const bug = (await bugResponse.json() as { response: { id: number } }).response

  const sprintResponse = await session.api.post('/module/sprints', {
    data: { goalId: PROJECT_ID, name: `${suffix} Sprint`, startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), goalText: 'Validar carga y actualización de cartera', capacity: 13 },
  })
  expect(sprintResponse.status()).toBe(200)
  const sprint = (await sprintResponse.json() as { response: { id: number } }).response
  for (const taskId of [story.id, ...taskIds]) {
    const assigned = await session.api.patch(`/module/sprints/task/${taskId}/sprint`, { data: { sprintId: sprint.id } })
    expect(assigned.status()).toBe(200)
  }

  const started = await session.api.post(`/module/sprints/sprint/${sprint.id}/activate`, { data: {} })
  expect(started.status()).toBe(200)
  for (const id of [story.id, ...taskIds, bug.id]) {
    const moved = await session.api.patch(`/module/scrum/items/${id}`, { data: { statusId: inProgress } })
    expect(moved.status()).toBe(200)
  }

  const observed = await session.api.post(`/module/scrum/items/${story.id}/qa`, { data: { status: 'observed', evidence: 'Primera revisión: falta evidencia de actualización.' } })
  expect(observed.status()).toBe(201)
  const review = (await observed.json() as { response: { id: number } }).response
  const observation = await session.api.post(`/module/scrum/items/${story.id}/qa/observations`, { data: { reviewId: review.id, note: 'Validar actualización del periodo y adjuntar resultado.' } })
  expect(observation.status()).toBe(201)
  const corrected = await session.api.patch(`/module/scrum/items/${story.id}`, { data: { note: 'Corrección aplicada; periodo actualizado y evidencia adjunta.', statusId: inProgress } })
  expect(corrected.status()).toBe(200)
  const approved = await session.api.post(`/module/scrum/items/${story.id}/qa`, { data: { status: 'approved', evidence: 'Pruebas funcionales y criterios de aceptación aprobados.' } })
  expect(approved.status()).toBe(201)

  const accepted = await session.api.put(`/module/scrum/sprints/${sprint.id}/review-items/${story.id}`, { data: { status: 'accepted', notes: 'Aceptada en Sprint Review del piloto.' } })
  expect(accepted.status()).toBe(200)
  for (const id of [story.id, ...taskIds, bug.id]) {
    const closed = await session.api.patch(`/module/scrum/items/${id}`, { data: { statusId: done } })
    expect(closed.status()).toBe(200)
  }
  const bugCheck = await session.api.get(`/module/scrum/items/${bug.id}`)
  expect(bugCheck.status()).toBe(200)
  expect((await bugCheck.json() as { response: { related_task_id: number; status_id: number } }).response).toMatchObject({ related_task_id: story.id, status_id: done })

  const reviewStart = await session.api.post(`/module/sprints/sprint/${sprint.id}/review`, { data: {} })
  expect(reviewStart.status()).toBe(200)
  const retro = await session.api.put(`/module/sprints/sprint/${sprint.id}/retro`, { data: { wentWell: 'Flujo completo y roles diferenciados.', wentBad: 'Se registró una observación controlada.', actionItems: 'Mantener evidencia QA en cada historia.' } })
  expect(retro.status()).toBe(200)

  const overview = await session.api.get(`/module/scrum/reports/${PROJECT_ID}/overview?sprintId=${sprint.id}&limit=200`)
  expect(overview.status()).toBe(200)
  const report = (await overview.json() as { response: { items: Array<{ id: number }>; sprints: Array<{ id: number; committed: number; completed: number }>; assignees: unknown[] } }).response
  expect(report.items.map(item => item.id)).toContain(story.id)
  expect(report.sprints.find(item => item.id === sprint.id)?.committed).toBeGreaterThanOrEqual(1)
  expect(report.assignees.length).toBeGreaterThan(0)
  const globalOverview = await session.api.get(`/module/scrum/reports/${PROJECT_ID}/overview?limit=200`)
  expect(globalOverview.status()).toBe(200)
  const globalReport = (await globalOverview.json() as { response: { items: Array<{ id: number }> } }).response
  expect(globalReport.items.map(item => item.id)).toContain(bug.id)
  for (const format of ['csv', 'xlsx']) {
    const exported = await session.api.get(`/module/scrum/reports/${PROJECT_ID}/export?format=${format}&sprintId=${sprint.id}`)
    expect(exported.status()).toBe(200)
    expect((await exported.body()).length).toBeGreaterThan(100)
  }
  const history = await session.api.get(`/module/tasks/${story.id}/history`)
  expect(history.status()).toBe(200)

  const closed = await session.api.post(`/module/sprints/sprint/${sprint.id}/close`, {
    data: { outcomes: [story.id, ...taskIds].map(taskId => ({ taskId, outcome: 'accepted' })), goalAchieved: true },
  })
  expect(closed.status()).toBe(200)

  await page.route('**/config.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.__TASKVIEW_CONFIG__ = { apiUrl: "${API_URL}" }` }))
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('store_task_view.task_view.access', access)
    localStorage.setItem('store_task_view.task_view.refresh', refresh)
  }, session.tokens)
  await page.goto(`${BASE_URL}/${ORG_SLUG}/${PROJECT_ID}/scrum`)
  await expect(page.getByText('Backlog', { exact: true }).first()).toBeVisible()
  await page.goto(`${BASE_URL}/${ORG_SLUG}/${PROJECT_ID}/dashboard`)
  await expect(page.getByTestId('project-dashboard')).toBeVisible({ timeout: 15_000 })
  await page.goto(`${BASE_URL}/${ORG_SLUG}/${PROJECT_ID}/reports`)
  await expect(page.getByRole('heading', { name: /Reportes Scrum/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'CSV' })).toBeVisible()
  await session.api.dispose()
})

test('activar sprint no abre cierre e iniciar revisión conserva el sprint abierto', async ({ page }) => {
  const password = process.env.SCRUM_TEST_PASSWORD
  test.skip(!password, 'Requires isolated L04 synthetic password')
  const session = await auth('l04-owner@example.invalid', password!)
  await resetPilotSprints(session.api)
  const name = `L04-PILOTO-UI-${Date.now()}`
  const created = await session.api.post('/module/sprints', {
    data: {
      goalId: PROJECT_ID,
      name,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      goalText: 'Validar transición de activación a revisión',
      capacity: 5,
    },
  })
  expect(created.status()).toBe(200)

  await page.route('**/config.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.__TASKVIEW_CONFIG__ = { apiUrl: "${API_URL}" }` }))
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('store_task_view.task_view.access', access)
    localStorage.setItem('store_task_view.task_view.refresh', refresh)
  }, session.tokens)
  await page.goto(`${BASE_URL}/${ORG_SLUG}/${PROJECT_ID}/sprints`)
  await page.getByRole('tab', { name: /Backlog/ }).click()
  const card = page.locator('[class*="cursor-pointer"]').filter({ hasText: name }).first()
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: /Activar|Activate/ }).click()
  await expect(page.getByText(name).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cerrar sprint' })).toHaveCount(0)

  await page.evaluate((sprintName) => {
    const heading = Array.from(document.querySelectorAll('h2')).find(item => item.textContent?.trim() === sprintName)
    let node = heading?.parentElement ?? null
    while (node && node.querySelectorAll('button').length === 0) node = node.parentElement
    const buttons = node ? Array.from(node.querySelectorAll('button')) : []
    ;(buttons.at(-1) as HTMLButtonElement | undefined)?.click()
  }, name)
  await page.getByRole('menuitem', { name: /Iniciar revisión|Start review|Start sprint review/ }).click()
  await expect(page.getByRole('heading', { name: /Iniciar revisión del sprint|Start sprint review/ })).toBeVisible()
  await page.getByRole('button', { name: /Iniciar revisión|Start review|Start sprint review/ }).click()
  await expect(page.getByRole('heading', { name: /Iniciar revisión del sprint|Start sprint review/ })).toHaveCount(0)
  await expect(page.getByText(/Revisión del sprint iniciada|Sprint review started/).last()).toBeVisible()
  const persisted = await session.api.get(`/module/sprints/${PROJECT_ID}`)
  expect(persisted.status()).toBe(200)
  const sprint = (await persisted.json() as { response: Array<{ name: string; status: string }> }).response.find(item => item.name === name)
  expect(sprint?.status).toBe('review')
  await session.api.dispose()
})
