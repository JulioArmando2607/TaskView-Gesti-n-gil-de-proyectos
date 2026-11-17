import axios, { type AxiosInstance } from 'axios';
import http from 'node:http';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TasksSchema, SprintsSchema, TasksStatusesSchema } from 'taskview-db-schemas';
import App from '../../../App';
import { Database } from '../../../modules/db';
import { GoalPermissions } from '../../../types/auth.types';

type Auth = { headers: { Authorization: string } };
const db = () => Database.getInstance().dbDrizzle;
let server: http.Server;
let api: AxiosInstance;
let ownerAuth: Auth;
let goalA = 0;
let goalB = 0;
let orgId = 0;
const tokenIds: number[] = [];

async function createGoal(name: string): Promise<number> {
    const response = await api.post('/module/goals', { name: `${name}-${Date.now()}`, organizationId: orgId }, ownerAuth);
    expect(response.status).toBe(200);
    return response.data.response.id;
}

async function createItem(goalId: number, type: 'story' | 'task' | 'bug' = 'task', extra: Record<string, unknown> = {}) {
    const response = await api.post(`/module/scrum/goals/${goalId}/items`, {
        type,
        description: `${type}-${Date.now()}-${Math.random()}`,
        ...extra,
    }, ownerAuth);
    expect(response.status).toBe(201);
    return response.data.response as Record<string, any>;
}

async function createEpic(goalId: number, title: string) {
    const response = await api.post(`/module/scrum/goals/${goalId}/epics`, { title, details: 'synthetic details' }, ownerAuth);
    expect(response.status).toBe(201);
    return response.data.response as Record<string, any>;
}

async function token(permissions: string[], goalIds: number[]): Promise<Auth> {
    const response = await api.post('/module/api-tokens', {
        name: `l02-scrum-${Date.now()}-${Math.random()}`,
        allowedPermissions: permissions,
        allowedGoalIds: goalIds,
    }, ownerAuth);
    expect(response.status).toBe(200);
    tokenIds.push(response.data.response.item.id);
    return { headers: { Authorization: `Bearer ${response.data.response.token}` } };
}

describe('Lista 02 Scrum API (PostgreSQL 17 disposable)', () => {
    beforeAll(async () => {
        const app = new App(0);
        server = app.app.listen(0);
        await new Promise<void>((resolve) => server.once('listening', resolve));
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
        api = axios.create({ baseURL: `http://127.0.0.1:${address.port}`, validateStatus: () => true, httpAgent: new http.Agent({ keepAlive: false }) });
        const login = await api.post('/module/auth/login', { login: 'test@mail.dest', password: 'user1!#Q' });
        expect(login.status).toBe(200);
        ownerAuth = { headers: { Authorization: `Bearer ${login.data.access}` } };
        const organization = await api.post('/module/organizations', { name: `scrum-l02-${Date.now()}` }, ownerAuth);
        expect(organization.status).toBe(200);
        orgId = organization.data.response.id;
        goalA = await createGoal('scrum-a');
        goalB = await createGoal('scrum-b');
    }, 30000);

    afterAll(async () => {
        for (const id of tokenIds) await api.delete('/module/api-tokens', { ...ownerAuth, data: { id } });
        for (const goalId of [goalA, goalB]) if (goalId) await api.delete('/module/goals', { ...ownerAuth, data: { goalId } });
        if (orgId) await api.delete(`/module/organizations/${orgId}`, ownerAuth);
        if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    }, 30000);

    it('creates, reads, updates and archives epics without deleting linked stories', async () => {
        const epic = await createEpic(goalA, 'Receivables epic');
        expect(epic.issueKey).toMatch(new RegExp(`^P${goalA}-\\d+$`));
        expect((await api.get(`/module/scrum/epics/${epic.id}`, ownerAuth)).data.response.title).toBe('Receivables epic');
        const updated = await api.patch(`/module/scrum/epics/${epic.id}`, { title: 'Receivables revised' }, ownerAuth);
        expect(updated.status).toBe(200);
        const story = await createItem(goalA, 'story', { epicId: epic.id, acceptanceCriteria: 'Rows reconcile' });
        expect(story.work_item_type).toBe('story');
        expect(story.epic_id).toBe(epic.id);
        const linked = await api.get(`/module/scrum/epics/${epic.id}/stories`, ownerAuth);
        expect(linked.data.response.map((row: any) => row.id)).toContain(story.id);
        expect((await api.delete(`/module/scrum/epics/${epic.id}`, ownerAuth)).data.response.archived).toBe(true);
        const persisted = await api.get(`/module/scrum/items/${story.id}`, ownerAuth);
        expect(persisted.data.response.epic_id).toBe(epic.id);

        const removableEpic = await createEpic(goalA, 'Epic to remove');
        const retainedTask = await createItem(goalA, 'task', { epicId: removableEpic.id });
        expect((await api.delete(`/module/scrum/epics/${removableEpic.id}/permanent`, ownerAuth)).data.response.deleted).toBe(true);
        const retained = await api.get(`/module/scrum/items/${retainedTask.id}`, ownerAuth);
        expect(retained.status).toBe(200);
        expect(retained.data.response.epic_id).toBeNull();
    });

    it('deletes a subtask through the existing task permission contract', async () => {
        const parent = await createItem(goalA, 'task');
        const child = await createItem(goalA, 'task', { parentId: parent.id });
        expect((await api.delete('/module/tasks', { ...ownerAuth, data: { taskId: child.id } })).status).toBe(200);
        expect((await api.get(`/module/scrum/items/${child.id}`, ownerAuth)).status).toBe(404);
        expect((await api.get(`/module/scrum/items/${parent.id}`, ownerAuth)).status).toBe(200);
    });

    it('supports a task and its subtask beneath a story, enforcing subtask permission', async () => {
        const story = await createItem(goalA, 'story');
        const task = await createItem(goalA, 'task', { parentId: story.id });
        const child = await createItem(goalA, 'task', { parentId: task.id });
        const nested = await api.get(`/module/scrum/items/${task.id}/subtasks`, ownerAuth);
        expect(nested.status).toBe(200);
        expect(nested.data.response.map((row: any) => row.id)).toContain(child.id);

        const addTasksOnly = await token([GoalPermissions.COMPONENT_CAN_ADD_TASKS], [goalA]);
        const denied = await api.post(`/module/scrum/goals/${goalA}/items`, { type: 'task', description: 'nested task without permission', parentId: task.id }, addTasksOnly);
        expect(denied.status).toBe(403);
    });

    it('creates and filters stories, independent tasks and affected bugs; checks project ownership', async () => {
        const target = await createItem(goalA, 'story');
        const task = await createItem(goalA, 'task');
        const epic = await createEpic(goalA, 'Task grouping epic');
        const linkedTask = await createItem(goalA, 'task', { epicId: epic.id });
        expect(linkedTask.epic_id).toBe(epic.id);
        expect((await api.get(`/module/scrum/goals/${goalA}/items?type=task&epicId=${epic.id}`, ownerAuth)).data.response.map((row: any) => row.id)).toContain(linkedTask.id);
        expect((await api.patch(`/module/scrum/items/${linkedTask.id}`, { epicId: null }, ownerAuth)).status).toBe(200);
        expect((await api.get(`/module/scrum/items/${linkedTask.id}`, ownerAuth)).data.response.epic_id).toBeNull();
        expect((await api.post(`/module/scrum/goals/${goalA}/items`, { type: 'bug', description: 'bug cannot belong directly to epic', epicId: epic.id }, ownerAuth)).status).toBe(400);
        const bug = await createItem(goalA, 'bug', { relatedTaskId: target.id });
        expect(bug.related_task_id).toBe(target.id);
        expect((await api.patch(`/module/scrum/items/${bug.id}`, { relatedTaskId: null }, ownerAuth)).status).toBe(200);
        const unlinkedBug = await api.get(`/module/scrum/items/${bug.id}`, ownerAuth);
        expect(unlinkedBug.data.response.related_task_id).toBeNull();
        expect((await api.get(`/module/scrum/goals/${goalA}/items?type=story`, ownerAuth)).data.response.map((row: any) => row.id)).toContain(target.id);
        expect((await api.get(`/module/scrum/goals/${goalA}/items?type=task`, ownerAuth)).data.response.map((row: any) => row.id)).toContain(task.id);
        expect((await api.get(`/module/scrum/goals/${goalA}/items?type=bug`, ownerAuth)).data.response.map((row: any) => row.id)).toContain(bug.id);
        const foreign = await createItem(goalB, 'story');
        expect((await api.post(`/module/scrum/goals/${goalA}/items`, { type: 'bug', description: 'cross-project', relatedTaskId: foreign.id }, ownerAuth)).status).toBe(400);
        const foreignEpic = await createEpic(goalB, 'Foreign epic');
        expect((await api.patch(`/module/scrum/items/${target.id}`, { epicId: foreignEpic.id }, ownerAuth)).status).toBe(400);
        expect((await api.get(`/module/scrum/goals/${goalA}/items?type=story&epicId=none&parentId=none`, ownerAuth)).data.response.map((row: any) => row.id)).toContain(target.id);
    });

    it('preserves legacy task creation and backfilled historical type/key values', async () => {
        const legacy = await api.post('/module/tasks', { goalId: goalA, description: 'legacy contract' }, ownerAuth);
        expect(legacy.status).toBe(200);
        const id = legacy.data.response.task?.id ?? legacy.data.response.id;
        const [row] = await db().select().from(TasksSchema).where(eq(TasksSchema.id, id));
        expect(row.workItemType).toBe('task');
        expect(row.issueKey).toMatch(new RegExp(`^P${goalA}-\\d+$`));
        const baseline = await db().select().from(TasksSchema).where(eq(TasksSchema.goalId, goalA));
        expect(baseline.every((item) => item.workItemType === 'task' || ['story', 'bug'].includes(item.workItemType))).toBe(true);
    });

    it('prevents self, indirect and concurrent hierarchy cycles through the legacy update route', async () => {
        const first = await createItem(goalA, 'task');
        const second = await createItem(goalA, 'task');
        expect((await api.patch('/module/tasks', { id: first.id, parentId: first.id }, ownerAuth)).status).toBe(400);
        const responses = await Promise.all([
            api.patch('/module/tasks', { id: first.id, parentId: second.id }, ownerAuth),
            api.patch('/module/tasks', { id: second.id, parentId: first.id }, ownerAuth),
        ]);
        expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
        expect(responses.filter((response) => response.status !== 200)).toHaveLength(1);
        const rows = await db().select({ id: TasksSchema.id, parentId: TasksSchema.parentId }).from(TasksSchema).where(inArray(TasksSchema.id, [first.id, second.id]));
        expect(rows.filter((row) => row.parentId !== null)).toHaveLength(1);
        const invalidCrossProject = await api.patch('/module/tasks', { id: first.id, parentId: (await createItem(goalB)).id }, ownerAuth);
        expect(invalidCrossProject.status).toBe(400);
    });

    it('generates unique issue keys during simultaneous epic and work item creates', async () => {
        const results = await Promise.all([
            ...Array.from({ length: 6 }, (_, index) => createEpic(goalA, `parallel epic ${index}`)),
            ...Array.from({ length: 8 }, () => createItem(goalA, 'task')),
        ]);
        const keys = results.map((row) => row.issueKey);
        expect(keys.every((key) => new RegExp(`^P${goalA}-\\d+$`).test(key))).toBe(true);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('applies token permission and goal scopes to Scrum reads and writes', async () => {
        const readToken = await token([GoalPermissions.COMPONENT_CAN_WATCH_CONTENT], [goalA]);
        expect((await api.get(`/module/scrum/goals/${goalA}/epics`, readToken)).status).toBe(200);
        expect((await api.post(`/module/scrum/goals/${goalA}/epics`, { title: 'must reject' }, readToken)).status).toBe(403);
        const outOfScope = await token(Object.values(GoalPermissions), [goalB]);
        expect((await api.get(`/module/scrum/goals/${goalA}/epics`, outOfScope)).status).toBe(403);
        const foreignResource = await api.get(`/module/scrum/items/${(await createItem(goalB)).id}`, readToken);
        expect([403, 404]).toContain(foreignResource.status);
    });

    it('plans root stories in sprints and serializes concurrent Kanban order changes', async () => {
        const [statusA, statusB] = await db().insert(TasksStatusesSchema).values([
            { goalId: goalA, name: `scrum-status-a-${Date.now()}` },
            { goalId: goalA, name: `scrum-status-b-${Date.now()}` },
        ]).returning();
        const [sprint] = await db().insert(SprintsSchema).values({
            goalId: goalA,
            name: `scrum-sprint-${Date.now()}`,
            startDate: '2026-11-15',
            endDate: '2026-11-28',
        }).returning();
        const story = await createItem(goalA, 'story');
        const task = await createItem(goalA, 'task');
        const bug = await createItem(goalA, 'bug');
        for (const item of [story, task, bug]) {
            const assigned = await api.patch(`/module/sprints/task/${item.id}/sprint`, { sprintId: sprint.id }, ownerAuth);
            expect(assigned.status).toBe(200);
        }
        const planning = await api.get(`/module/sprints/sprint/${sprint.id}/planning?scope=sprint&limit=100`, ownerAuth);
        expect(planning.status).toBe(200);
        const plannedIds = planning.data.response.tasks.map((row: any) => row.id);
        expect(plannedIds).toEqual(expect.arrayContaining([story.id, task.id, bug.id]));

        const kanbanItems = await Promise.all(Array.from({ length: 8 }, () => createItem(goalA, 'task')));
        const changes = await Promise.all(kanbanItems.map((item, index) => api.patch(`/module/scrum/items/${item.id}`, { statusId: index % 2 === 0 ? statusA.id : statusB.id }, ownerAuth)));
        expect(changes.every((response) => response.status === 200)).toBe(true);
        const rows = await db().select({ id: TasksSchema.id, kanbanOrder: TasksSchema.kanbanOrder }).from(TasksSchema)
            .where(and(inArray(TasksSchema.id, kanbanItems.map((item) => item.id)), eq(TasksSchema.goalId, goalA)));
        const ordersByStatus = new Map<number | null, number[]>();
        for (const item of kanbanItems) {
            const [row] = await db().select({ statusId: TasksSchema.statusId, kanbanOrder: TasksSchema.kanbanOrder }).from(TasksSchema).where(eq(TasksSchema.id, item.id));
            if (row.kanbanOrder === null) continue;
            const orders = ordersByStatus.get(row.statusId) ?? [];
            orders.push(row.kanbanOrder);
            ordersByStatus.set(row.statusId, orders);
        }
        for (const orders of ordersByStatus.values()) expect(new Set(orders).size).toBe(orders.length);
        expect(rows).toHaveLength(8);
    });

    it('rejects incompatible project moves atomically and permits clean moves', async () => {
        const affected = await createItem(goalA, 'task');
        const bug = await createItem(goalA, 'bug', { relatedTaskId: affected.id });
        const blocked = await api.post('/module/tasks/move', { taskId: affected.id, targetGoalId: goalB }, ownerAuth);
        expect(blocked.status).toBe(409);
        const [unchanged] = await db().select().from(TasksSchema).where(eq(TasksSchema.id, affected.id));
        expect(unchanged.goalId).toBe(goalA);
        expect(unchanged.relatedTaskId).toBeNull();
        expect(bug.related_task_id).toBe(affected.id);

        const movable = await createItem(goalA, 'task');
        const moved = await api.post('/module/tasks/move', { taskId: movable.id, targetGoalId: goalB }, ownerAuth);
        expect(moved.status).toBe(200);
        const [after] = await db().select().from(TasksSchema).where(eq(TasksSchema.id, movable.id));
        expect(after.goalId).toBe(goalB);
        expect(after.issueKey).toMatch(new RegExp(`^P${goalB}-\\d+$`));
    });
});
