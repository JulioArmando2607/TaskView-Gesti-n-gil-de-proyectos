import { expect, request, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const API_URL = process.env.SCRUM_TEST_API_URL ?? 'http://127.0.0.1:11725'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:18888'
const AUTH_FILE = 'test-results/.auth/l04-editor.json'

test('create L04 editor storage state', async () => {
  const password = process.env.SCRUM_TEST_PASSWORD
  test.skip(!password, 'Requires isolated L04 synthetic password')
  const email = process.env.SCRUM_TEST_EDITOR_EMAIL ?? 'l04-editor@example.invalid'
  const api = await request.newContext({ baseURL: API_URL })
  const response = await api.post('/module/auth/login', { form: { login: email, password: password! } })
  expect(response.status()).toBe(200)
  const tokens = await response.json() as { access: string; refresh: string }
  await mkdir(dirname(AUTH_FILE), { recursive: true })
  await api.storageState({ path: AUTH_FILE })
  const state = {
    cookies: [],
    origins: [{
      origin: BASE_URL,
      localStorage: [
        { name: 'store_task_view.task_view.access', value: tokens.access },
        { name: 'store_task_view.task_view.refresh', value: tokens.refresh },
      ],
    }],
  }
  await (await import('node:fs/promises')).writeFile(AUTH_FILE, JSON.stringify(state), 'utf8')
  await api.dispose()
})
