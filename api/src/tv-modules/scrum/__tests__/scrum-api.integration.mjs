import assert from 'node:assert/strict';

if (process.env.L02_API_TEST_ONLY !== '1') throw new Error('Lista 02 API test guard is not enabled');
const apiBase = 'http://127.0.0.1:1401';
assert.equal(process.env.DB_NAME, process.env.L02_EXPECTED_DB_NAME ?? 'taskview_l02_final_20261115');
assert.equal(process.env.DB_USER, 'l02synthetic');
assert.equal(process.env.DB_HOST, 'taskview-l02-scrum-db-20261115');
assert.equal(Number(process.env.DB_PORT), 5432);

const counts = { pass: 0, fail: 0 };
const createdTokens = [];
let organizationId = null;
const goalIds = [];
const assertStatus = (response, expected, label) => {
    assert.equal(response.status, expected, `${label}: HTTP ${response.status}, body=${JSON.stringify(response.data)}`);
    return response.data?.response;
};
async function call(method, path, body, auth) {
    const response = await fetch(new URL(path, apiBase), {
        method,
        headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    return { status: response.status, data };
}
async function test(name, run) {
    try {
        await run();
        counts.pass++;
        process.stdout.write(`PASS ${name}\n`);
    } catch (error) {
        counts.fail++;
        process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`);
        throw error;
    }
}

let owner = null;
try {
    let login;
    for (let attempt = 0; attempt < 30; attempt++) {
        login = await call('POST', '/module/auth/login', { login: 'test@mail.dest', password: 'user1!#Q' });
        if (login.status === 200) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    assertStatus(login, 200, 'test login');
    owner = login.data.access;
    const organization = assertStatus(await call('POST', '/module/organizations', { name: `l02-scrum-${Date.now()}` }, owner), 200, 'create test organization');
    organizationId = organization.id;
    const goalA = assertStatus(await call('POST', '/module/goals', { name: `scrum-a-${Date.now()}`, organizationId }, owner), 200, 'create project A').id;
    const goalB = assertStatus(await call('POST', '/module/goals', { name: `scrum-b-${Date.now()}`, organizationId }, owner), 200, 'create project B').id;
    goalIds.push(goalA, goalB);
    const createItem = async (goalId, type = 'task', extra = {}) => assertStatus(await call('POST', `/module/scrum/goals/${goalId}/items`, { type, description: `${type}-${Date.now()}-${Math.random()}`, ...extra }, owner), 201, `create ${type}`);
    const createEpic = async (goalId, title) => assertStatus(await call('POST', `/module/scrum/goals/${goalId}/epics`, { title }, owner), 201, 'create epic');

    await test('epic CRUD, story association, archive persistence', async () => {
        const epic = await createEpic(goalA, 'Cash collection');
        assert.match(epic.issueKey, new RegExp(`^P${goalA}-\\d+$`));
        assert.equal(assertStatus(await call('GET', `/module/scrum/epics/${epic.id}`, undefined, owner), 200, 'get epic').title, 'Cash collection');
        assertStatus(await call('PATCH', `/module/scrum/epics/${epic.id}`, { title: 'Cash collection updated' }, owner), 200, 'edit epic');
        const story = await createItem(goalA, 'story', { epicId: epic.id, acceptanceCriteria: 'Totals reconcile' });
        assert.equal(story.work_item_type, 'story');
        assert.equal(story.epic_id, epic.id);
        const stories = assertStatus(await call('GET', `/module/scrum/epics/${epic.id}/stories`, undefined, owner), 200, 'epic stories');
        assert(stories.some((row) => row.id === story.id));
        assert.equal(assertStatus(await call('DELETE', `/module/scrum/epics/${epic.id}`, undefined, owner), 200, 'archive epic').archived, true);
        assert.equal(assertStatus(await call('GET', `/module/scrum/items/${story.id}`, undefined, owner), 200, 'read story').epic_id, epic.id);
        assertStatus(await call('PATCH', `/module/scrum/items/${story.id}`, { epicId: null }, owner), 200, 'unlink story');
        assert.equal(assertStatus(await call('GET', `/module/scrum/items/${story.id}`, undefined, owner), 200, 'read unlinked story').epic_id, null);
    });

    await test('authentication is required for Scrum routes', async () => {
        assertStatus(await call('GET', `/module/scrum/goals/${goalA}/epics`), 401, 'anonymous read denied');
        const epic = await createEpic(goalB, 'private project epic');
        assertStatus(await call('GET', `/module/scrum/epics/${epic.id}`, undefined, owner), 200, 'owner can read own project epic');
    });

    await test('story, task and bug CRUD/filter plus cross-project relation rejection', async () => {
        const story = await createItem(goalA, 'story', { note: 'detailed note', priorityId: 2, owner: 1, acceptanceCriteria: 'Approved' });
        assert.equal(story.note, 'detailed note');
        assert.equal(story.priority_id, 2);
        assert.equal(story.owner, 1);
        assert.equal(story.acceptance_criteria, 'Approved');
        const task = await createItem(goalA, 'task');
        const bug = await createItem(goalA, 'bug', { relatedTaskId: story.id });
        assert.equal(bug.related_task_id, story.id);
        assertStatus(await call('PATCH', `/module/scrum/items/${bug.id}`, { description: 'bug title updated', note: 'repro steps' }, owner), 200, 'edit bug');
        const editedBug = assertStatus(await call('GET', `/module/scrum/items/${bug.id}`, undefined, owner), 200, 'read edited bug');
        assert.equal(editedBug.description, 'bug title updated');
        assert.equal(editedBug.note, 'repro steps');
        assertStatus(await call('PATCH', `/module/scrum/items/${bug.id}`, { relatedTaskId: null }, owner), 200, 'unlink bug');
        assert.equal(assertStatus(await call('GET', `/module/scrum/items/${bug.id}`, undefined, owner), 200, 'read bug').related_task_id, null);
        for (const type of ['story', 'task', 'bug']) {
            const rows = assertStatus(await call('GET', `/module/scrum/goals/${goalA}/items?type=${type}`, undefined, owner), 200, `filter ${type}`);
            assert(rows.every((row) => row.work_item_type === type));
        }
        const foreignStory = await createItem(goalB, 'story');
        assertStatus(await call('POST', `/module/scrum/goals/${goalA}/items`, { type: 'bug', description: 'invalid project reference', relatedTaskId: foreignStory.id }, owner), 400, 'cross-project related item');
        const foreignEpic = await createEpic(goalB, 'foreign epic');
        assertStatus(await call('PATCH', `/module/scrum/items/${story.id}`, { epicId: foreignEpic.id }, owner), 400, 'cross-project epic');
        assert.equal(task.work_item_type, 'task');
    });

    await test('legacy route, historical task defaults and history', async () => {
        const legacy = assertStatus(await call('POST', '/module/tasks', { goalId: goalA, description: 'legacy title preserved', note: 'legacy detail' }, owner), 200, 'legacy create');
        const rowId = legacy.task?.id ?? legacy.id;
        const row = assertStatus(await call('GET', `/module/scrum/items/${rowId}`, undefined, owner), 200, 'read legacy task');
        assert.equal(row.description, 'legacy title preserved');
        assert.equal(row.note, 'legacy detail');
        assert.equal(row.work_item_type, 'task');
        assert.match(row.issue_key, new RegExp(`^P${goalA}-\\d+$`));
        const historical = assertStatus(await call('GET', `/module/scrum/goals/${goalA}/items?type=task`, undefined, owner), 200, 'list historical tasks');
        assert(historical.some((item) => item.id === rowId && item.work_item_type === 'task'));
        assert(historical.every((item) => /^P[1-9][0-9]*-[1-9][0-9]*$/.test(item.issue_key)));
        assertStatus(await call('PATCH', `/module/scrum/items/${rowId}`, { description: 'updated title' }, owner), 200, 'update task');
        const history = assertStatus(await call('GET', `/module/tasks/${rowId}/history`, undefined, owner), 200, 'fetch task history');
        assert(Array.isArray(history.history));
        assert(history.history.length > 0);

        const list = assertStatus(await call('POST', '/module/goal_lists', { goalId: goalA, name: `legacy-list-${Date.now()}` }, owner), 200, 'create legacy task list');
        const fromList = assertStatus(await call('POST', '/module/tasks', { goalId: goalA, goalListId: list.id, description: 'legacy list association' }, owner), 200, 'create legacy task in a project list');
        const fromListId = fromList.task?.id ?? fromList.id;
        const listTask = assertStatus(await call('GET', `/module/scrum/items/${fromListId}`, undefined, owner), 200, 'verify legacy task in list');
        assert.equal(listTask.goal_id, goalA);
        assert.equal(listTask.goal_list_id, list.id);
        assert.match(listTask.issue_key, new RegExp(`^P${goalA}-\\d+$`));
    });

    await test('self-cycle, cross-project parent and simultaneous indirect cycle are rejected', async () => {
        const first = await createItem(goalA);
        const second = await createItem(goalA);
        assertStatus(await call('PATCH', '/module/tasks', { id: first.id, parentId: first.id }, owner), 400, 'self-parent');
        const results = await Promise.all([
            call('PATCH', '/module/tasks', { id: first.id, parentId: second.id }, owner),
            call('PATCH', '/module/tasks', { id: second.id, parentId: first.id }, owner),
        ]);
        assert.equal(results.filter((result) => result.status === 200).length, 1);
        assert.equal(results.filter((result) => result.status !== 200).length, 1);
        const graph = await Promise.all([first, second].map(async (item) => assertStatus(await call('GET', `/module/scrum/items/${item.id}`, undefined, owner), 200, 'read hierarchy')));
        assert.equal(graph.filter((row) => row.parent_id !== null).length, 1);
        const child = await createItem(goalA, 'task', { parentId: first.id });
        const children = assertStatus(await call('GET', `/module/scrum/items/${first.id}/subtasks`, undefined, owner), 200, 'list subtasks');
        assert(children.some((item) => item.id === child.id));
        const otherProjectItem = await createItem(goalB);
        assertStatus(await call('PATCH', '/module/tasks', { id: first.id, parentId: otherProjectItem.id }, owner), 400, 'cross-project parent');
    });

    await test('parallel project issue keys are unique and monotonic', async () => {
        const jobs = await Promise.all([
            ...Array.from({ length: 8 }, (_, i) => createEpic(goalA, `parallel-${i}`)),
            ...Array.from({ length: 12 }, () => createItem(goalA, 'bug')),
        ]);
        const keys = jobs.map((item) => item.issueKey ?? item.issue_key);
        assert(keys.every((key) => new RegExp(`^P${goalA}-\\d+$`).test(key)));
        assert.equal(new Set(keys).size, keys.length);
        const numbers = keys.map((key) => Number(key.slice(key.lastIndexOf('-') + 1)));
        assert.equal(new Set(numbers).size, numbers.length);
        const deleted = await createItem(goalA, 'task');
        const deletedSequence = Number(deleted.issue_key.slice(deleted.issue_key.lastIndexOf('-') + 1));
        assertStatus(await call('DELETE', '/module/tasks', { taskId: deleted.id }, owner), 200, 'delete task for key non-reuse check');
        const afterDelete = await createItem(goalA, 'task');
        const nextSequence = Number(afterDelete.issue_key.slice(afterDelete.issue_key.lastIndexOf('-') + 1));
        assert(nextSequence > deletedSequence);
    });

    await test('API token permission scopes and project boundaries', async () => {
        const read = assertStatus(await call('POST', '/module/api-tokens', { name: `l02-read-${Date.now()}`, allowedPermissions: ['component_can_watch_content'], allowedGoalIds: [goalA] }, owner), 200, 'create read token');
        createdTokens.push(read.item.id);
        assertStatus(await call('GET', `/module/scrum/goals/${goalA}/epics`, undefined, read.token), 200, 'scoped read');
        assertStatus(await call('POST', `/module/scrum/goals/${goalA}/epics`, { title: 'forbidden' }, read.token), 403, 'read token cannot write');
        const epic = await createEpic(goalA, 'read-only protected epic');
        assertStatus(await call('PATCH', `/module/scrum/epics/${epic.id}`, { title: 'forbidden edit' }, read.token), 403, 'read token cannot edit epic');
        assertStatus(await call('DELETE', `/module/scrum/epics/${epic.id}`, undefined, read.token), 403, 'read token cannot archive epic');
        const outOfScope = assertStatus(await call('POST', '/module/api-tokens', { name: `l02-other-${Date.now()}`, allowedPermissions: ['component_can_watch_content'], allowedGoalIds: [goalB] }, owner), 200, 'create isolated token');
        createdTokens.push(outOfScope.item.id);
        assertStatus(await call('GET', `/module/scrum/goals/${goalA}/epics`, undefined, outOfScope.token), 403, 'other-project scope denied');
    });

    await test('story root planning, sprint validation and Kanban order concurrency', async () => {
        const story = await createItem(goalA, 'story');
        assertStatus(await call('GET', `/module/scrum/goals/${goalA}/items?type=epic`, undefined, owner), 400, 'epics are not executable work items');
        const independentTask = await createItem(goalA, 'task');
        const bug = await createItem(goalA, 'bug');
        const sprint = assertStatus(await call('POST', '/module/sprints', { goalId: goalA, name: `sprint-${Date.now()}`, startDate: '2026-11-15', endDate: '2026-11-28' }, owner), 200, 'create sprint');
        assertStatus(await call('PATCH', `/module/sprints/task/${story.id}/sprint`, { sprintId: sprint.id }, owner), 200, 'assign root story');
        assertStatus(await call('PATCH', `/module/sprints/task/${independentTask.id}/sprint`, { sprintId: sprint.id }, owner), 200, 'assign independent task');
        assertStatus(await call('PATCH', `/module/sprints/task/${bug.id}/sprint`, { sprintId: sprint.id }, owner), 200, 'assign root bug');
        const planning = assertStatus(await call('GET', `/module/sprints/sprint/${sprint.id}/planning?scope=sprint&limit=100`, undefined, owner), 200, 'sprint planning');
        for (const item of [story, independentTask, bug]) assert(planning.tasks.some((planned) => planned.id === item.id));
        const a = assertStatus(await call('POST', '/module/kanban/add-status', { goalId: goalA, name: `status-a-${Date.now()}` }, owner), 200, 'create status A');
        const b = assertStatus(await call('POST', '/module/kanban/add-status', { goalId: goalA, name: `status-b-${Date.now()}` }, owner), 200, 'create status B');
        const items = await Promise.all(Array.from({ length: 10 }, () => createItem(goalA)));
        const moved = await Promise.all(items.map((item, index) => call('PATCH', `/module/scrum/items/${item.id}`, { statusId: index % 2 ? a.id : b.id }, owner)));
        assert(moved.every((result) => result.status === 200));
        const statuses = assertStatus(await call('POST', '/module/kanban/fetch-statuses', { goalId: goalA }, owner), 200, 'read statuses');
        assert(statuses.some((item) => item.id === a.id) && statuses.some((item) => item.id === b.id));
        const kanbanItems = assertStatus(await call('GET', `/module/scrum/goals/${goalA}/items?type=task`, undefined, owner), 200, 'verify Kanban tasks');
        const movedIds = new Set(items.map((item) => item.id));
        for (const statusId of [a.id, b.id]) {
            const orders = kanbanItems.filter((item) => movedIds.has(item.id) && item.status_id === statusId && item.parent_id === null).map((item) => item.kanban_order);
            assert.equal(new Set(orders).size, orders.length);
        }
    });

    await test('incompatible moves fail atomically and clean moves re-key to destination', async () => {
        const linkedEpic = await createEpic(goalA, 'move-protected epic');
        const linkedStory = await createItem(goalA, 'story', { epicId: linkedEpic.id });
        const linkedMove = await call('POST', '/module/tasks/move', { taskId: linkedStory.id, targetGoalId: goalB }, owner);
        assert.equal(linkedMove.status, 409);
        const linkedAfter = assertStatus(await call('GET', `/module/scrum/items/${linkedStory.id}`, undefined, owner), 200, 'verify linked story move rejection');
        assert.equal(linkedAfter.goal_id, goalA);
        assert.equal(linkedAfter.epic_id, linkedEpic.id);

        const affected = await createItem(goalA);
        const bug = await createItem(goalA, 'bug', { relatedTaskId: affected.id });
        const rejected = await call('POST', '/module/tasks/move', { taskId: affected.id, targetGoalId: goalB }, owner);
        assert.equal(rejected.status, 409);
        const unchanged = assertStatus(await call('GET', `/module/scrum/items/${affected.id}`, undefined, owner), 200, 'verify rejected move');
        assert.equal(unchanged.goal_id, goalA);
        assert.equal(unchanged.related_task_id, null);
        const moved = await createItem(goalA);
        assertStatus(await call('POST', '/module/tasks/move', { taskId: moved.id, targetGoalId: goalB }, owner), 200, 'valid move');
        const after = assertStatus(await call('GET', `/module/scrum/items/${moved.id}`, undefined, owner), 200, 'verify valid move');
        assert.equal(after.goal_id, goalB);
        assert.match(after.issue_key, new RegExp(`^P${goalB}-\\d+$`));
        assert.equal(bug.related_task_id, affected.id);

        const root = await createItem(goalA);
        const child = await createItem(goalA, 'task', { parentId: root.id });
        assertStatus(await call('POST', '/module/tasks/move', { taskId: root.id, targetGoalId: goalB }, owner), 200, 'move full task subtree');
        const movedRoot = assertStatus(await call('GET', `/module/scrum/items/${root.id}`, undefined, owner), 200, 'read moved subtree root');
        const movedChild = assertStatus(await call('GET', `/module/scrum/items/${child.id}`, undefined, owner), 200, 'read moved subtree child');
        assert.equal(movedRoot.goal_id, goalB);
        assert.equal(movedChild.goal_id, goalB);
        assert.equal(movedChild.parent_id, root.id);
        assert.match(movedRoot.issue_key, new RegExp(`^P${goalB}-\\d+$`));
        assert.match(movedChild.issue_key, new RegExp(`^P${goalB}-\\d+$`));
    });

    process.stdout.write(`Lista 02 API integration totals: PASS=${counts.pass}, FAIL=${counts.fail}\n`);
} finally {
    if (owner) {
        for (const id of createdTokens) await call('DELETE', '/module/api-tokens', { id }, owner).catch(() => undefined);
        for (const goalId of goalIds) await call('DELETE', '/module/goals', { goalId }, owner).catch(() => undefined);
        if (organizationId) await call('DELETE', `/module/organizations/${organizationId}`, undefined, owner).catch(() => undefined);
    }
}
