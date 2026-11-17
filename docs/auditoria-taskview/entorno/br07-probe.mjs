// Run only inside br07-api, receiving synthetic login credentials on stdin.
// Never prints credentials, tokens, raw responses or attachment bytes.
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const input = await new Promise((resolve, reject) => {
  let text = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { text += chunk; });
  process.stdin.on('end', () => resolve(JSON.parse(text)));
  process.stdin.on('error', reject);
});
const base = 'http://127.0.0.1:1401';
const login = await fetch(`${base}/module/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ login: input.login, password: input.password }),
});
const loginBody = await login.json().catch(() => ({}));
const token = loginBody.access;
console.log(`login: HTTP ${login.status}; token-present=${Boolean(token)}`);
if (login.status !== 200 || !token) process.exit(1);
const auth = { authorization: `Bearer ${token}` };

async function request(label, path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { ...auth, ...(options.headers ?? {}) } });
  const body = await response.json().catch(() => null);
  const data = body?.response;
  const shape = Array.isArray(data)
    ? `array=${data.length}; first-keys=${Object.keys(data[0] ?? {}).slice(0, 15).join(',')}`
    : `keys=${Object.keys(data ?? {}).slice(0, 20).join(',')}`;
  console.log(`${label}: HTTP ${response.status}; ${shape}`);
  return { status: response.status, data };
}

const goals = await request('goals', '/module/goals');
assert.equal(goals.status, 200);
assert.deepEqual(goals.data.filter(g => [3, 4].includes(g.id)).map(g => g.id).sort(), [3, 4]);
assert.ok(goals.data.filter(g => [3, 4].includes(g.id)).every(g => g.name.startsWith('L01-')));
console.log(`goals-evidence: ${JSON.stringify(goals.data?.filter(g => [3, 4].includes(g.id)).map(g => ({ id: g.id, name: g.name })))}`);
const tasks = await request('tasks-goal-3', '/module/tasks?goalId=3&componentId=-1401&page=0&showCompleted=0&firstNew=0');
assert.equal(tasks.status, 200);
assert.ok(Array.isArray(tasks.data) && tasks.data.length >= 10);
console.log(`tasks-evidence: type=${Array.isArray(tasks.data) ? 'array' : typeof tasks.data}; count=${Array.isArray(tasks.data) ? tasks.data.length : tasks.data?.tasks?.length ?? -1}`);
const child = await request('child-3', '/module/tasks/3');
assert.equal(child.status, 200);
assert.equal(child.data.id, 3);
assert.equal(child.data.goalId, 3);
assert.equal(child.data.parentId, 2);
console.log(`child-evidence: id=${child.data?.id}; goal=${child.data?.goalId}; parent=${child.data?.parentId}`);
const grandchild = await request('grandchild-4', '/module/tasks/4');
assert.equal(grandchild.status, 200);
assert.equal(grandchild.data.id, 4);
assert.equal(grandchild.data.goalId, 3);
assert.equal(grandchild.data.parentId, 3);
console.log(`grandchild-evidence: id=${grandchild.data?.id}; goal=${grandchild.data?.goalId}; parent=${grandchild.data?.parentId}`);
const sprint = await request('sprint-1', '/module/sprints/sprint/1');
assert.equal(sprint.status, 200);
assert.equal(sprint.data.id, 1);
assert.equal(sprint.data.goalId, 3);
assert.equal(sprint.data.status, 'completed');
assert.ok(sprint.data.retro?.wentWell && sprint.data.retro?.wentBad && sprint.data.retro?.actionItems);
console.log(`sprint-evidence: id=${sprint.data?.id}; status=${sprint.data?.status}; retro-keys=${Object.keys(sprint.data?.retro ?? {}).join(',')}`);
const roles = await request('roles-goal-3', '/module/collaborationroles/3');
assert.equal(roles.status, 200);
assert.ok([9, 10].every(id => roles.data.some(r => r.id === id && r.name.startsWith('L01-'))));
console.log(`roles-evidence: ${JSON.stringify(roles.data?.map(r => ({ id: r.id, name: r.name })))}`);
const history = await request('history-task-13', '/module/tasks/13/history');
assert.equal(history.status, 200);
assert.ok(history.data.history.length >= 2);
console.log(`history-evidence: count=${history.data?.history?.length ?? -1}`);
const files = await request('files-task-8', '/module/files/task/8');
assert.equal(files.status, 200);
assert.ok(files.data.some(f => f.id === '00cf6093-5393-4f04-befc-d040b6157738'));
console.log(`files-evidence: ids=${files.data?.map(f => f.id).join(',')}`);
const fileId = '00cf6093-5393-4f04-befc-d040b6157738';
const metadata = await request('file-metadata', `/module/files/file/${fileId}`);
assert.equal(metadata.status, 200);
assert.equal(metadata.data.id, fileId);
assert.equal(metadata.data.sizeBytes, 38);
const download = await request('download-url', `/module/files/file/${fileId}/download-url`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inline: false }),
});
assert.equal(download.status, 200);
assert.ok(download.data?.url?.startsWith('/module/files/content/'));
if (download.status === 200 && download.data?.url) {
  const response = await fetch(`${base}${download.data.url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(response.status, 200);
  assert.equal(bytes.length, 38);
  assert.equal(hash, 'a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f');
  console.log(`download-content: HTTP ${response.status}; bytes=${bytes.length}; sha256=${hash}`);
}
console.log('BR07_FUNCTIONAL_ASSERTIONS_PASS');
