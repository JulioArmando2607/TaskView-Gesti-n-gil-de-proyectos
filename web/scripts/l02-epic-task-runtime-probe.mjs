// Synthetic API regression for epic-linked tasks and bugs on the isolated lab.
// Credentials and tokens arrive through stdin/in memory and are never printed.
const input = await new Promise((resolve, reject) => {
  let body = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => { body += chunk })
  process.stdin.on('end', () => resolve(JSON.parse(body)))
  process.stdin.on('error', reject)
})

const base = 'http://127.0.0.1:11725'
let organizationId
let goalId
let failureStage = 'login'
const call = async (method, path, body, token) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, data: await response.json().catch(() => null) }
}
const check = (condition, stage) => {
  if (!condition) {
    failureStage = stage
    throw new Error('assertion')
  }
}

try {
  const login = await call('POST', '/module/auth/login', { login: input.login, password: input.password })
  check(login.status === 200 && typeof login.data?.access === 'string', 'login')
  const auth = login.data.access

  failureStage = 'synthetic organization'
  const org = await call('POST', '/module/organizations', { name: `epic-task-runtime-${Date.now()}` }, auth)
  check(org.status === 200 && Number.isInteger(org.data?.response?.id), failureStage)
  organizationId = org.data.response.id

  failureStage = 'synthetic project'
  const goal = await call('POST', '/module/goals', { name: `epic-task-runtime-${Date.now()}`, organizationId }, auth)
  check(goal.status === 200 && Number.isInteger(goal.data?.response?.id), failureStage)
  goalId = goal.data.response.id

  failureStage = 'create epic'
  const epic = await call('POST', `/module/scrum/goals/${goalId}/epics`, { title: 'Runtime grouping check' }, auth)
  check(epic.status === 201 && Number.isInteger(epic.data?.response?.id), failureStage)
  const epicId = epic.data.response.id

  failureStage = 'create epic-linked story'
  const story = await call('POST', `/module/scrum/goals/${goalId}/items`, { type: 'story', description: 'Runtime story', epicId }, auth)
  check(story.status === 201 && story.data?.response?.epic_id === epicId, failureStage)

  failureStage = 'create task under story and its subtask'
  const storyTask = await call('POST', `/module/scrum/goals/${goalId}/items`, { type: 'task', description: 'Runtime story task', parentId: story.data.response.id }, auth)
  check(storyTask.status === 201 && storyTask.data?.response?.parent_id === story.data.response.id, failureStage)
  const storySubtask = await call('POST', `/module/scrum/goals/${goalId}/items`, { type: 'task', description: 'Runtime nested subtask', parentId: storyTask.data.response.id }, auth)
  check(storySubtask.status === 201 && storySubtask.data?.response?.parent_id === storyTask.data.response.id, failureStage)
  const nestedChildren = await call('GET', `/module/scrum/items/${storyTask.data.response.id}/subtasks`, undefined, auth)
  check(nestedChildren.status === 200 && nestedChildren.data?.response?.some(item => item.id === storySubtask.data.response.id), failureStage)

  failureStage = 'create epic-linked technical task'
  const task = await call('POST', `/module/scrum/goals/${goalId}/items`, { type: 'task', description: 'Runtime technical task', epicId }, auth)
  check(task.status === 201 && task.data?.response?.epic_id === epicId, failureStage)

  failureStage = 'read epic items'
  const grouped = await call('GET', `/module/scrum/goals/${goalId}/items?epicId=${epicId}&parentId=none`, undefined, auth)
  check(grouped.status === 200 && grouped.data?.response?.some(item => item.id === story.data.response.id) && grouped.data?.response?.some(item => item.id === task.data.response.id), failureStage)

  failureStage = 'create bug linked to task'
  const bug = await call('POST', `/module/scrum/goals/${goalId}/items`, { type: 'bug', description: 'Runtime related bug', relatedTaskId: task.data.response.id }, auth)
  check(bug.status === 201 && bug.data?.response?.related_task_id === task.data.response.id, failureStage)

  failureStage = 'read related bug'
  const bugRead = await call('GET', `/module/scrum/items/${bug.data.response.id}`, undefined, auth)
  check(bugRead.status === 200 && bugRead.data?.response?.related_task_id === task.data.response.id, failureStage)

  failureStage = 'reject direct epic bug relation'
  const invalidBug = await call('POST', `/module/scrum/goals/${goalId}/items`, { type: 'bug', description: 'Must stay linked to affected item', epicId }, auth)
  check(invalidBug.status === 400, failureStage)

  failureStage = 'delete subtask only'
  const parent = await call('POST', `/module/scrum/goals/${goalId}/items`, { type: 'task', description: 'Runtime parent task' }, auth)
  check(parent.status === 201, failureStage)
  const child = await call('POST', `/module/scrum/goals/${goalId}/items`, { type: 'task', description: 'Runtime child task', parentId: parent.data.response.id }, auth)
  check(child.status === 201, failureStage)
  const deleteChild = await call('DELETE', '/module/tasks', { taskId: child.data.response.id }, auth)
  check(deleteChild.status === 200, failureStage)
  const parentRead = await call('GET', `/module/scrum/items/${parent.data.response.id}`, undefined, auth)
  const childRead = await call('GET', `/module/scrum/items/${child.data.response.id}`, undefined, auth)
  check(parentRead.status === 200 && childRead.status === 404, failureStage)

  failureStage = 'delete epic while retaining linked items'
  const deleteEpic = await call('DELETE', `/module/scrum/epics/${epicId}/permanent`, undefined, auth)
  check(deleteEpic.status === 200 && deleteEpic.data?.response?.deleted === true, failureStage)
  const retainedTask = await call('GET', `/module/scrum/items/${task.data.response.id}`, undefined, auth)
  check(retainedTask.status === 200 && retainedTask.data.response.epic_id === null, failureStage)
  console.log('Epic/story/task and related-bug associations: PASS')
  console.log('Story task with nested subtask: PASS')
  console.log('Subtask deletion preserves its parent: PASS')
  console.log('Epic deletion keeps stories/tasks and unlinks them: PASS')
} catch {
  console.error(`Epic/task runtime regression: FAIL (${failureStage})`)
  process.exitCode = 1
} finally {
  if (goalId && organizationId) {
    const authLogin = await call('POST', '/module/auth/login', { login: input.login, password: input.password }).catch(() => null)
    const auth = authLogin?.data?.access
    if (auth) {
      const deletedProject = await call('DELETE', '/module/goals', { goalId }, auth).catch(() => null)
      const deletedOrganization = await call('DELETE', `/module/organizations/${organizationId}`, undefined, auth).catch(() => null)
      if (deletedProject?.status === 200 && deletedOrganization?.status === 200) console.log('Synthetic cleanup: PASS')
      else {
        console.error('Synthetic cleanup: FAIL (project/org retained for manual review)')
        process.exitCode = 1
      }
    } else {
      console.error('Synthetic cleanup: FAIL (session unavailable)')
      process.exitCode = 1
    }
  } else if (organizationId) {
    // No project was created, so remove only the synthetic organization.
    const authLogin = await call('POST', '/module/auth/login', { login: input.login, password: input.password }).catch(() => null)
    const auth = authLogin?.data?.access
    const deletedOrganization = auth ? await call('DELETE', `/module/organizations/${organizationId}`, undefined, auth).catch(() => null) : null
    if (deletedOrganization?.status !== 200) process.exitCode = 1
  }
}
