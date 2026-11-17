// Lista 01: synthetic auth and log probe against the isolated laboratory only.
// Credentials enter through stdin and never appear in output or a file.
import { execFileSync, spawnSync } from 'node:child_process'

const base = 'http://127.0.0.1:11725'
const container = 'taskview-l01-b5a7e65-api-1'
const logFile = `/usr/src/app/logs/log-${new Date().toISOString().slice(0, 10)}.log`
const readLog = () => execFileSync('docker', ['exec', container, 'cat', logFile], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
const readInput = async () => {
  let value = ''
  for await (const chunk of process.stdin) value += chunk
  return JSON.parse(value)
}
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const request = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  return { status: response.status, data }
}

let input
let access
let refresh
let newAccess
let newRefresh
try {
  input = await readInput()
  assert(input?.login && input?.password, 'Synthetic credentials unavailable')
  const marker = `L01-RUNTIME-INVALID-${Date.now()}`
  const baselineLines = readLog().split(/\r?\n/).length

  const options = await request('/module/auth/login-options')
  assert(options.status === 200 && options.data?.password === true, 'API readiness/login options failed')
  console.log('API readiness: PASS (200, password login enabled)')

  const invalid = await request('/module/auth/login', { method: 'POST', body: { login: `${marker}@taskview-l01.invalid`, password: `${marker}-PASSWORD` } })
  assert(invalid.status === 400, `Invalid login returned ${invalid.status}`)
  console.log('Invalid login: PASS (400)')

  const login = await request('/module/auth/login', { method: 'POST', body: { login: input.login, password: input.password } })
  assert(login.status === 200 && typeof login.data?.access === 'string' && typeof login.data?.refresh === 'string', `Valid login returned ${login.status} or missing tokens`)
  access = login.data.access
  refresh = login.data.refresh
  console.log('Valid login: PASS (200, tokens issued)')

  const projects = await request('/module/goals', { token: access })
  assert(projects.status === 200, `Protected projects returned ${projects.status}`)
  assert(JSON.stringify(projects.data).includes('L01-'), 'Recovered synthetic project absent from protected response')
  console.log('Protected project read: PASS (200, synthetic project present)')

  const renewal = await request('/module/auth/refresh/token', { method: 'POST', body: { refreshToken: refresh } })
  assert(renewal.status === 200 && typeof renewal.data?.access === 'string' && typeof renewal.data?.refresh === 'string', `Refresh returned ${renewal.status} or missing tokens`)
  newAccess = renewal.data.access
  newRefresh = renewal.data.refresh
  console.log('Session renewal: PASS (200, tokens issued)')

  const logout = await request('/module/auth/logout', { method: 'POST', token: newAccess })
  assert(logout.status === 204, `Logout returned ${logout.status}`)
  console.log('Logout: PASS (204)')

  const revoked = await request('/module/goals', { token: newAccess })
  assert(revoked.status === 401, `Revoked session returned ${revoked.status}`)
  console.log('Revoked session: PASS (401)')

  // Only the lines added by this probe are inspected. Historical lab logs are not evidence.
  const newLines = readLog().split(/\r?\n/).slice(baselineLines - 1).filter(Boolean)
  const joined = newLines.join('\n')
  const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/
  const forbidden = [input.password, input.login, marker, `${marker}-PASSWORD`, access, refresh, newAccess, newRefresh]
  assert(forbidden.every((value) => value && !joined.includes(value)), 'Synthetic credential or token found in new logs')
  assert(!jwtPattern.test(joined), 'JWT pattern found in new logs')
  assert(!/(?:authorization|set-cookie|password|refreshToken|confirmEmailCode|rememberToken)\s*[=:]\s*[^,}\s]+/i.test(joined), 'Sensitive field pattern found in new logs')
  assert(!/\bcookie\s*[=:]\s*(?!yes\b|no\b)[^,}\s]+/i.test(joined), 'Cookie value pattern found in new logs')
  const parsed = newLines.map((line) => { try { return JSON.parse(line) } catch { return null } }).filter(Boolean)
  const safeDiagnostic = parsed.some((entry) => typeof entry.msg === 'string' && entry.msg.includes('Refresh token source: body'))
  assert(safeDiagnostic, 'Expected non-sensitive refresh diagnostic absent')
  console.log(`API file logs: PASS (${newLines.length} new lines, 0 synthetic secrets/JWT patterns, safe refresh diagnostic present)`)

  const startedAt = execFileSync('docker', ['inspect', container, '--format', '{{.State.StartedAt}}'], { encoding: 'utf8' }).trim()
  const containerOutput = spawnSync('docker', ['logs', '--since', startedAt, container], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  assert(containerOutput.status === 0, 'Unable to inspect container output')
  const combinedOutput = `${containerOutput.stdout}\n${containerOutput.stderr}`
  assert(forbidden.every((value) => value && !combinedOutput.includes(value)), 'Synthetic credential or token found in container output')
  assert(!jwtPattern.test(combinedOutput), 'JWT pattern found in container output')
  console.log('API container output: PASS (0 synthetic secrets/JWT patterns since recreation)')
} catch (error) {
  // Fixed message only: never emit HTTP bodies, headers, credentials or raw logs.
  console.error(`Runtime probe: FAIL (${error instanceof Error ? error.message : 'unknown error'})`)
  process.exitCode = 1
}
