import assert from 'node:assert/strict'

const api = process.env.SCRUM_TEST_API_URL || 'http://127.0.0.1:11725'
const password = process.env.SCRUM_TEST_PASSWORD
const editorEmail = process.env.SCRUM_TEST_EDITOR_EMAIL || 'l04-editor@example.invalid'
const readerEmail = process.env.SCRUM_TEST_READER_EMAIL || 'l04-reader@example.invalid'
const noAccessEmail = process.env.SCRUM_TEST_NOACCESS_EMAIL || 'l04-noaccess@example.invalid'
const projectId = Number(process.env.SCRUM_TEST_PROJECT_ID || 5)
assert(password, 'SCRUM_TEST_PASSWORD is required')

async function login(email) {
  const response = await fetch(`${api}/module/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: email, password }),
  })
  assert.equal(response.status, 200, `login failed for ${email}`)
  return (await response.json()).access
}

async function json(path, token) {
  const response = await fetch(`${api}${path}`, { headers: { authorization: `Bearer ${token}` } })
  return { response, body: response.ok ? await response.json() : null }
}

const editor = await login(editorEmail)
const reader = await login(readerEmail)
const noAccess = await login(noAccessEmail)
const all = await json(`/module/scrum/reports/${projectId}/overview?limit=200`, editor)
assert.equal(all.response.status, 200)
const report = all.body.response
assert.equal(report.items.length, report.items.filter((item) => item.type === 'story' || item.type === 'task' || item.type === 'bug').length)
const stories = await json(`/module/scrum/reports/${projectId}/overview?type=story&limit=200`, editor)
assert.equal(stories.response.status, 200)
assert.ok(stories.body.response.items.every((item) => item.type === 'story'))
const bugs = await json(`/module/scrum/reports/${projectId}/overview?type=bug&limit=200`, editor)
assert.equal(bugs.response.status, 200)
assert.ok(bugs.body.response.items.every((item) => item.type === 'bug'))
const readerReport = await json(`/module/scrum/reports/${projectId}/overview`, reader)
assert.equal(readerReport.response.status, 403)
const noAccessReport = await json(`/module/scrum/reports/${projectId}/overview`, noAccess)
assert.equal(noAccessReport.response.status, 403)
for (const format of ['csv', 'xlsx']) {
  const response = await fetch(`${api}/module/scrum/reports/${projectId}/export?format=${format}`, { headers: { authorization: `Bearer ${editor}` } })
  assert.equal(response.status, 200)
  const bytes = new Uint8Array(await response.arrayBuffer())
  assert.ok(bytes.length > 100, `${format} export is empty`)
  if (format === 'xlsx') assert.equal(String.fromCharCode(...bytes.slice(0, 2)), 'PK')
}
console.log(`Lista 11 reports PASS: items=${report.items.length} stories=${stories.body.response.items.length} bugs=${bugs.body.response.items.length}`)
