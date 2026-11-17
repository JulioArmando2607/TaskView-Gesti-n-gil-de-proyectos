import { expect, request, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

const API_URL = process.env.SCRUM_TEST_API_URL ?? 'http://127.0.0.1:14103'
const runLabel = process.env.SCRUM_TEST_RUN_LABEL ?? 'L03'
const syntheticPassword = () => process.env.SCRUM_TEST_PASSWORD

async function loginApi(email: string): Promise<{ api: APIRequestContext; access: string; refresh: string }> {
  const password = syntheticPassword()
  if (!password) throw new Error('SCRUM_TEST_PASSWORD is required')
  const auth = await request.newContext({ baseURL: API_URL })
  const response = await auth.post('/module/auth/login', { form: { login: email, password } })
  expect(response.status(), `login ${email}`).toBe(200)
  const tokens = await response.json() as { access: string; refresh: string }
  await auth.dispose()
  return {
    access: tokens.access,
    refresh: tokens.refresh,
    api: await request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Authorization: `Bearer ${tokens.access}` } }),
  }
}

async function openScrum(page: Page, email: string) {
  const goalId = process.env.SCRUM_TEST_PROJECT_ID
  const orgSlug = process.env.SCRUM_TEST_ORG_SLUG
  if (!goalId || !orgSlug) throw new Error('SCRUM_TEST_PROJECT_ID and SCRUM_TEST_ORG_SLUG are required')
  const session = await loginApi(email)
  await page.route('**/config.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `window.__TASKVIEW_CONFIG__ = { apiUrl: "${API_URL}" }`,
  }))
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('store_task_view.task_view.access', access)
    localStorage.setItem('store_task_view.task_view.refresh', refresh)
  }, { access: session.access, refresh: session.refresh })
  await page.goto(`/${orgSlug}/${goalId}/scrum`)
  return { ...session, goalId: Number(goalId) }
}

/** End-to-end smoke of Lista 03 against an explicitly configured disposable Lista 02 API. */
test('Scrum backlog creates linked work, plans it, and archives an epic without deleting stories', async ({ page }) => {
  const email = process.env.SCRUM_TEST_EMAIL
  const password = process.env.SCRUM_TEST_PASSWORD
  const goalId = process.env.SCRUM_TEST_PROJECT_ID
  const orgSlug = process.env.SCRUM_TEST_ORG_SLUG
  test.skip(!email || !password || !goalId || !orgSlug, 'Requires synthetic Lista 02 credentials and project settings.')

  const suffix = `${runLabel}-${Date.now()}`
  const epicTitle = `${suffix} Epic`
  const storyTitle = `${suffix} Story`
  const subtaskTitle = `${suffix} Subtask`
  const taskTitle = `${suffix} Task`
  const taskUpdatedTitle = `${taskTitle} updated`
  const bugTitle = `${suffix} Bug`
  const bugUpdatedTitle = `${bugTitle} updated`

  await page.route('**/config.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `window.__TASKVIEW_CONFIG__ = { apiUrl: "${API_URL}" }`,
  }))
  const apiStatuses: string[] = []
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`))
  page.on('response', response => {
    if (response.url().startsWith(`${API_URL}/`)) {
      apiStatuses.push(`${new URL(response.url()).pathname}=${response.status()}`)
    }
  })
  const authApi = await request.newContext({ baseURL: API_URL })
  const loginResponse = await authApi.post('/module/auth/login', { form: { login: email!, password: password! } })
  expect(loginResponse.ok()).toBeTruthy()
  const tokens = await loginResponse.json() as { access: string; refresh: string }
  await authApi.dispose()
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('store_task_view.task_view.access', access)
    localStorage.setItem('store_task_view.task_view.refresh', refresh)
  }, tokens)
  await page.goto(`/${orgSlug}/${goalId}/scrum`)
  try {
    await expect(page.getByText(new RegExp(`${process.env.SCRUM_TEST_PROJECT_NAME ?? 'Synthetic Scrum Project'} · Scrum`))).toBeVisible({ timeout: 20_000 })
  } catch {
    const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 1_000)
    const componentState = await page.evaluate(() => {
      type RuntimeInstance = { parent?: RuntimeInstance, setupState?: Record<string, unknown>, type?: { __name?: string, name?: string }, subTree?: RuntimeNode }
      type RuntimeNode = { component?: RuntimeInstance, children?: RuntimeNode[] }
      const app = (document.querySelector('#app') as (HTMLElement & { __vue_app__?: { _instance?: RuntimeInstance } }) | null)?.__vue_app__
      const state: Array<Record<string, unknown>> = []
      const seen = new Set<RuntimeInstance>()
      const visitNode = (node?: RuntimeNode) => {
        if (!node) return
        visit(node.component)
        const children = Array.isArray(node.children) ? node.children : []
        for (const child of children) visitNode(child)
      }
      const visit = (component?: RuntimeInstance) => {
        if (!component || seen.has(component)) return
        seen.add(component)
        const setup = component.setupState ?? {}
        const name = component.type?.__name ?? component.type?.name
        if (name === 'scrum' || 'projectId' in setup || 'projectName' in setup) {
          state.push({ name, projectId: setup.projectId, projectName: setup.projectName, project: setup.project, canView: setup.canView, goals: setup.goals })
        }
        visitNode(component.subTree)
      }
      visit(app?._instance)
      return state
    })
    throw new Error(`Project was not loaded; URL: ${page.url()}; API requests: ${apiStatuses.join(',') || 'none'}; browser errors: ${pageErrors.join(' | ') || 'none'}; console errors: ${consoleErrors.join(' | ') || 'none'}; failed requests: ${failedRequests.join(' | ') || 'none'}; component state: ${JSON.stringify(componentState)}; page text: ${body || '<empty>'}`)
  }
  await expect(page.getByText('Backlog', { exact: true }).first()).toBeVisible({ timeout: 20_000 })

  await page.getByTestId('scrum-create-epic').click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 }).catch(() => {
    throw new Error(`Epic dialog did not open; page errors: ${pageErrors.join(' | ') || 'none'}; console errors: ${consoleErrors.join(' | ') || 'none'}`)
  })
  await page.getByTestId('scrum-title').fill(epicTitle)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const epic = page.locator('section').filter({ hasText: epicTitle }).first()
  await expect(epic).toBeVisible()

  await epic.getByRole('button', { name: 'Historia' }).click()
  await page.getByTestId('scrum-title').fill(storyTitle)
  await page.getByLabel('Criterios de aceptación').fill('El analista confirma la carga y puede revisar el periodo.')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 })
  await expect(page.getByText(storyTitle)).toBeVisible()

  const storyRow = page.getByText(storyTitle, { exact: true })
  const storyId = await storyRow.getAttribute('data-item-id')
  expect(storyId).toBeTruthy()
  await page.getByTestId(`scrum-add-subtask-${storyId}`).click()
  await expect(page.getByRole('heading', { name: 'Nueva subtarea' })).toBeVisible().catch(async () => {
    throw new Error(`Subtask action opened the wrong form. UI calls: ${consoleErrors.join(' | ')}; dialog: ${await page.getByRole('dialog').innerText().catch(() => '<no dialog>')}`)
  })
  await page.getByTestId('scrum-title').fill(subtaskTitle)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 })
  await expect(page.getByText(subtaskTitle)).toBeVisible()

  await page.getByRole('button', { name: 'Tarea técnica' }).click()
  await page.getByTestId('scrum-title').fill(taskTitle)
  await page.getByRole('button', { name: 'Guardar' }).dblclick()
  await expect(page.getByText(taskTitle)).toBeVisible()
  await page.getByText(taskTitle, { exact: true }).click()
  await page.getByTestId('scrum-title').fill(taskUpdatedTitle)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(taskUpdatedTitle, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Reportar bug' }).click()
  await page.getByTestId('scrum-title').fill(bugTitle)
  await page.getByLabel('Elemento afectado').click()
  await page.getByRole('option', { name: new RegExp(storyTitle) }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(bugTitle)).toBeVisible()
  await page.getByText(bugTitle, { exact: true }).click()
  await page.getByTestId('scrum-title').fill(bugUpdatedTitle)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(bugUpdatedTitle, { exact: true })).toBeVisible()

  const verificationApi = await request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Authorization: `Bearer ${tokens.access}` } })
  const itemsResponse = await verificationApi.get(`/module/scrum/goals/${goalId}/items?limit=500`)
  const itemsBody = await itemsResponse.json() as { response: Array<{ description: string; related_task_id: number | null }> }
  expect(itemsBody.response.filter(item => item.description === taskUpdatedTitle)).toHaveLength(1)
  expect(itemsBody.response.find(item => item.description === bugUpdatedTitle)?.related_task_id).toBe(Number(storyId))
  await verificationApi.dispose()

  await page.getByRole('button', { name: 'Sprint Planning' }).click()
  const sprintSelect = page.getByTestId('scrum-sprint-select')
  await sprintSelect.click()
  await page.getByRole('option', { name: new RegExp(process.env.SCRUM_TEST_SPRINT_NAME ?? 'Synthetic Sprint') }).click()
  await page.locator('label').filter({ hasText: storyTitle }).getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Asignar selección' }).click()
  await expect(page.locator('label').filter({ hasText: storyTitle })).toContainText(/Sprint/)

  await page.getByRole('button', { name: 'Backlog' }).click()
  page.once('dialog', dialog => dialog.accept())
  await epic.getByRole('button', { name: 'Archivar épica' }).click()
  await expect(epic.getByText('Archivada')).toBeVisible()
  await epic.getByRole('button', { name: new RegExp(`Expandir ${epicTitle}`) }).click()
  await expect(epic.getByText(storyTitle)).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('backlog filters, edits, reloads, and opens history without losing relations', async ({ page }) => {
  const email = process.env.SCRUM_TEST_EMAIL
  test.skip(!email || !syntheticPassword(), 'Requires synthetic L03 owner credentials.')
  const suffix = `${runLabel}-edit-${Date.now()}`
  const session = await loginApi(email!)
  const goalId = Number(process.env.SCRUM_TEST_PROJECT_ID)
  const epicResponse = await session.api.post(`/module/scrum/goals/${goalId}/epics`, { data: { title: `${suffix} Epic`, details: 'Detalle inicial' } })
  expect(epicResponse.status()).toBe(201)
  const epic = (await epicResponse.json() as { response: { id: number } }).response
  const storyResponse = await session.api.post(`/module/scrum/goals/${goalId}/items`, { data: { type: 'story', description: `${suffix} Story`, epicId: epic.id, acceptanceCriteria: 'Visible y editable' } })
  const story = (await storyResponse.json() as { response: { id: number } }).response
  const subtaskResponse = await session.api.post(`/module/scrum/goals/${goalId}/items`, { data: { type: 'task', description: `${suffix} Subtask`, parentId: story.id } })
  const subtask = (await subtaskResponse.json() as { response: { id: number } }).response
  await session.api.post(`/module/scrum/goals/${goalId}/items`, { data: { type: 'task', description: `${suffix} Independent` } })
  await session.api.dispose()

  const browser = await openScrum(page, email!)
  await expect(page.getByText('Backlog', { exact: true }).first()).toBeVisible()
  const epicSection = page.locator('section').filter({ hasText: `${suffix} Epic` }).first()
  await epicSection.getByRole('button', { name: 'Editar épica' }).click()
  await page.getByTestId('scrum-title').fill(`${suffix} Epic updated`)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(`${suffix} Epic updated`)).toBeVisible()

  await page.getByText(`${suffix} Story`, { exact: true }).click()
  await page.getByTestId('scrum-title').fill(`${suffix} Story updated`)
  await page.getByLabel('Criterios de aceptación').fill('Criterio actualizado')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(`${suffix} Story updated`, { exact: true })).toBeVisible()

  await page.getByText(`${suffix} Subtask`, { exact: true }).click()
  await page.getByTestId('scrum-title').fill(`${suffix} Subtask updated`)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(`${suffix} Subtask updated`, { exact: true })).toBeVisible()

  await page.getByPlaceholder('Buscar por título o clave').fill(suffix)
  await page.getByTestId('scrum-type-filter').click()
  await page.getByRole('option', { name: 'Historia', exact: true }).click()
  await expect(page.getByText(`${suffix} Story updated`, { exact: true })).toBeVisible()
  await expect(page.getByText(`${suffix} Independent`, { exact: true })).toBeHidden()
  await page.getByTestId('scrum-type-filter').click()
  await page.getByRole('option', { name: 'Todos los tipos', exact: true }).click()
  await page.getByPlaceholder('Buscar por título o clave').clear()

  await page.reload()
  await expect(page.getByText(`${suffix} Story updated`, { exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByText(`${suffix} Story updated`, { exact: true }).click()
  await page.getByRole('button', { name: 'Historial completo' }).click()
  await expect(page).toHaveURL(new RegExp(`${story.id}`))

  const persistedStory = await browser.api.get(`/module/scrum/items/${story.id}`)
  const persistedSubtask = await browser.api.get(`/module/scrum/items/${subtask.id}`)
  expect((await persistedStory.json() as { response: { description: string; acceptance_criteria: string } }).response).toMatchObject({ description: `${suffix} Story updated`, acceptance_criteria: 'Criterio actualizado' })
  expect((await persistedSubtask.json() as { response: { description: string; parent_id: number } }).response).toMatchObject({ description: `${suffix} Subtask updated`, parent_id: story.id })
  await browser.api.dispose()
})

test('Kanban moves a root item and persists status and unique order', async ({ page }) => {
  const email = process.env.SCRUM_TEST_EMAIL
  test.skip(!email || !syntheticPassword(), 'Requires synthetic L03 owner credentials.')
  const title = `${runLabel}-kanban-${Date.now()}`
  const session = await loginApi(email!)
  const goalId = Number(process.env.SCRUM_TEST_PROJECT_ID)
  const sourceStatusId = Number(process.env.SCRUM_TEST_TODO_STATUS_ID ?? 4)
  const destinationStatusId = Number(process.env.SCRUM_TEST_IN_PROGRESS_STATUS_ID ?? 5)
  const createdResponse = await session.api.post(`/module/scrum/goals/${goalId}/items`, { data: { type: 'task', description: title, statusId: sourceStatusId } })
  const created = (await createdResponse.json() as { response: { id: number } }).response
  await session.api.dispose()

  const browser = await openScrum(page, email!)
  await page.getByRole('button', { name: 'Kanban' }).click()
  const card = page.getByTestId('kanban-task-card').filter({ hasText: title })
  await expect(card).toBeVisible({ timeout: 20_000 })
  const destination = page.locator(`[data-column-id="${destinationStatusId}"]`)
  const sourceBox = await card.boundingBox()
  const targetBox = await destination.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(150)
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + 80, { steps: 12 })
  await page.mouse.up()
  await expect(destination.getByTestId('kanban-task-card').filter({ hasText: title })).toBeVisible({ timeout: 15_000 })
  const persisted = await browser.api.get(`/module/scrum/items/${created.id}`)
  expect((await persisted.json() as { response: { status_id: number } }).response.status_id).toBe(destinationStatusId)
  const all = await browser.api.get(`/module/scrum/goals/${goalId}/items?limit=500`)
  const roots = (await all.json() as { response: Array<{ id: number; status_id: number | null; parent_id: number | null; kanban_order: number | null }> }).response.filter(item => item.status_id === destinationStatusId && item.parent_id == null)
  expect(new Set(roots.map(item => item.kanban_order)).size).toBe(roots.length)
  await browser.api.dispose()
})

test('project roles and API token scopes enforce visual and backend permissions', async ({ page }) => {
  test.skip(!syntheticPassword(), 'Requires synthetic L03 credentials.')
  const goalId = Number(process.env.SCRUM_TEST_PROJECT_ID)
  const cases = [
    { email: process.env.SCRUM_TEST_READER_EMAIL ?? 'l03-reader@example.invalid', canCreate: false, expectedPost: 403 },
    { email: process.env.SCRUM_TEST_EDITOR_EMAIL ?? 'l03-editor@example.invalid', canCreate: true, expectedPost: 201 },
    { email: process.env.SCRUM_TEST_MULTI_EMAIL ?? 'l03-multi@example.invalid', canCreate: true, expectedPost: 201 },
  ]
  for (const profile of cases) {
    const context = await page.context().browser()!.newContext()
    const profilePage = await context.newPage()
    const session = await openScrum(profilePage, profile.email)
    await expect(profilePage.getByText('Backlog', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    if (profile.canCreate) await expect(profilePage.getByTestId('scrum-create-epic')).toBeVisible()
    else await expect(profilePage.getByTestId('scrum-create-epic')).toHaveCount(0)
    const response = await session.api.post(`/module/scrum/goals/${goalId}/items`, { data: { type: 'task', description: `L03-permission-${profile.email}-${Date.now()}` } })
    expect(response.status(), profile.email).toBe(profile.expectedPost)
    await session.api.dispose()
    await context.close()
  }

  const noAccess = await loginApi(process.env.SCRUM_TEST_NOACCESS_EMAIL ?? 'l03-noaccess@example.invalid')
  expect((await noAccess.api.get(`/module/scrum/goals/${goalId}/items`)).status()).toBe(403)
  await noAccess.api.dispose()

  const owner = await loginApi(process.env.SCRUM_TEST_EMAIL!)
  const readTokenResponse = await owner.api.post('/module/api-tokens', { data: { name: `l03-read-${Date.now()}`, allowedPermissions: ['component_can_watch_content'], allowedGoalIds: [goalId] } })
  expect(readTokenResponse.status()).toBe(200)
  const readToken = (await readTokenResponse.json() as { response: { token: string } }).response.token
  const scoped = await request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Authorization: `Bearer ${readToken}` } })
  expect((await scoped.get(`/module/scrum/goals/${goalId}/items`)).status()).toBe(200)
  expect((await scoped.post(`/module/scrum/goals/${goalId}/items`, { data: { type: 'task', description: 'scope must reject' } })).status()).toBe(403)
  await scoped.dispose()

  const wrongGoalResponse = await owner.api.post('/module/api-tokens', { data: { name: `l03-wrong-goal-${Date.now()}`, allowedPermissions: ['component_can_watch_content'], allowedGoalIds: [999999] } })
  const wrongGoalToken = (await wrongGoalResponse.json() as { response: { token: string } }).response.token
  const wrongGoal = await request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Authorization: `Bearer ${wrongGoalToken}` } })
  expect((await wrongGoal.get(`/module/scrum/goals/${goalId}/items`)).status()).toBe(403)
  await wrongGoal.dispose()
  await owner.api.dispose()
})
