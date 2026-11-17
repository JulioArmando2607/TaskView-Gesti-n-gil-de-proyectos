import { describe, expect, it } from 'vitest';
import { KanbanManager } from '../KanbanManager';
import type { KanbanArgUpdateTasksOrder } from '../types';

type Card = { id: number; goalId: number; statusId: number; kanbanOrder: number };

function makeHarness() {
    const cards: Card[] = [
        { id: 1, goalId: 901, statusId: 10, kanbanOrder: 100 },
        { id: 2, goalId: 901, statusId: 10, kanbanOrder: 200 },
        { id: 3, goalId: 901, statusId: 10, kanbanOrder: 300 },
        { id: 4, goalId: 901, statusId: 10, kanbanOrder: 400 },
        { id: 5, goalId: 901, statusId: 20, kanbanOrder: 100 },
        { id: 6, goalId: 901, statusId: 20, kanbanOrder: 200 },
    ];
    const versions = new Map<number, number>([[10, 1], [20, 1]]);
    let rebalanceWrites = 0;
    const list = (columnId: number | null) => cards
        .filter((card) => card.statusId === columnId)
        .sort((a, b) => a.kanbanOrder - b.kanbanOrder || a.id - b.id);
    const order = (columnId: number) => list(columnId).map((card) => card.id);
    const assertUnique = () => {
        for (const columnId of [10, 20]) {
            const values = list(columnId).map((card) => card.kanbanOrder);
            expect(new Set(values).size).toBe(values.length);
        }
    };
    const repository = {
        getAllStatusesForGoal: async () => [
            { id: 10, goal_id: 901, name: 'A', view_order: 1 },
            { id: 20, goal_id: 901, name: 'B', view_order: 2 },
        ],
        getGoalTask: async ({ taskId, goalId }: { taskId: number; goalId: number }) =>
            cards.find((card) => card.id === taskId && card.goalId === goalId) ?? null,
        getTasksOrderForColumnAndCursor: async (_goalId: number, columnId: number | null) =>
            list(columnId).map(({ id, kanbanOrder }) => ({ id, kanbanOrder })),
        getNextTaskByKanbanOrder: async ({ columnId, kanbanOrder }: { columnId: number; kanbanOrder: number }) =>
            list(columnId).find((card) => card.kanbanOrder > kanbanOrder) ?? null,
        getPreviousTaskByKanbanOrder: async ({ columnId, kanbanOrder }: { columnId: number; kanbanOrder: number }) =>
            [...list(columnId)].reverse().find((card) => card.kanbanOrder < kanbanOrder) ?? null,
        updateTasksOrder: async (updates: { id: number; kanbanOrder: number | null }[]) => {
            rebalanceWrites++;
            for (const update of updates) {
                const card = cards.find((item) => item.id === update.id)!;
                card.kanbanOrder = update.kanbanOrder!;
            }
            return true;
        },
        updateColumnVersion: async (_goalId: number, columnId: number) => {
            versions.set(columnId, (versions.get(columnId) ?? 0) + 1);
            return true;
        },
        getColumnVersion: async (_goalId: number, columnId: number) => versions.get(columnId) ?? null,
    };
    const taskRepository = {
        fetchTaskByIdNew: async (id: number) => {
            const card = cards.find((item) => item.id === id);
            return card ? { ...card } : null;
        },
        updateTask: async ({ id, kanbanOrder, statusId }: { id: number; kanbanOrder: number; statusId: number }) => {
            const card = cards.find((item) => item.id === id)!;
            card.kanbanOrder = kanbanOrder;
            card.statusId = statusId;
            return { ...card };
        },
        getNextKanbanOrder: async () => Math.max(...cards.map((card) => card.kanbanOrder)) + 16384,
    };
    const manager = Object.create(KanbanManager.prototype) as KanbanManager;
    Object.assign(manager, {
        repository,
        user: { tasksManager: { repository: taskRepository }, getUserData: () => ({ id: 999 }) },
    });
    const move = async (data: Omit<KanbanArgUpdateTasksOrder, 'goalId'>) => {
        const before = `A:${order(10).join(',')} B:${order(20).join(',')}`;
        const result = await manager.updateTasksOrderAndColumn({ goalId: 901, ...data });
        const after = `A:${order(10).join(',')} B:${order(20).join(',')}`;
        console.log(`${before} -> ${after}`);
        assertUnique();
        return result;
    };
    return { move, order, assertUnique, getRebalanceWrites: () => rebalanceWrites, getVersion: (id: number) => versions.get(id) };
}

describe('Lista 01: Kanban ordering with isolated synthetic cards', () => {
    it('moves a card inside one column', async () => {
        const h = makeHarness();
        await h.move({ taskId: 2, columnId: 10, prevTaskId: 3, nextTaskId: 4 });
        expect(h.order(10)).toEqual([1, 3, 2, 4]);
    });

    it('moves a card between columns', async () => {
        const h = makeHarness();
        await h.move({ taskId: 2, columnId: 20, prevTaskId: 5, nextTaskId: 6 });
        expect(h.order(10)).toEqual([1, 3, 4]);
        expect(h.order(20)).toEqual([5, 2, 6]);
    });

    it('moves first to last', async () => {
        const h = makeHarness();
        await h.move({ taskId: 1, columnId: 10, prevTaskId: 4, nextTaskId: null });
        expect(h.order(10)).toEqual([2, 3, 4, 1]);
    });

    it('moves last to first', async () => {
        const h = makeHarness();
        await h.move({ taskId: 4, columnId: 10, prevTaskId: null, nextTaskId: 1 });
        expect(h.order(10)).toEqual([4, 1, 2, 3]);
    });

    it('preserves unique positions after consecutive moves', async () => {
        const h = makeHarness();
        await h.move({ taskId: 1, columnId: 10, prevTaskId: 4, nextTaskId: null });
        await h.move({ taskId: 4, columnId: 10, prevTaskId: null, nextTaskId: 2 });
        await h.move({ taskId: 2, columnId: 20, prevTaskId: 5, nextTaskId: 6 });
        expect(h.order(10)).toEqual([4, 3, 1]);
        expect(h.order(20)).toEqual([5, 2, 6]);
    });

    it('rebalance is invoked at most once for inverted stale neighbours', async () => {
        const h = makeHarness();
        await h.move({ taskId: 1, columnId: 10, prevTaskId: 3, nextTaskId: 2 });
        expect(h.getRebalanceWrites()).toBe(1);
        expect(h.getVersion(10)).toBe(2);
        expect(h.order(10)).toEqual([1, 2, 3, 4]);
    });
});
