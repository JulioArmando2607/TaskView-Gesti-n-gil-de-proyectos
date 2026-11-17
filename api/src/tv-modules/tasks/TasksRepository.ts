import { and, asc, desc, eq, exists, gt, ilike, inArray, isNotNull, isNull, lt, notExists, or, sql } from 'drizzle-orm';
import type { TasksSchemaTypeForSelect } from 'taskview-db-schemas';
import { GoalsListSchema, TasksAssigneeSchema, TasksSchema, TasksStatusesSchema, TasksToTagsSchema } from 'taskview-db-schemas';
import { FetchTasksQueryBuilder } from '../../core/FetchTasksQueryBuilder';
import { Database } from '../../modules/db';
import { $logger } from '../../modules/logget';
import type { GoalListInDb } from '../../types/goal-list.types';
import {
    type AddTaskArg,
    ALL_TASKS_LIST_ID,
    type FetchTasksArg,
    type TagsForTasks,
    type TaskDatesFromDb,
    type TaskHistoryItemFromDb,
    type TaskHistoryItemFromServer,
    type TaskItemInDb,
    type TasksUpdateStatusId,
    type TaskUpdateAmount,
    type TaskUpdateOrders,
    type TaskUpdateTransactionType,
    type UpdateTaskDeadlineArg,
} from '../../types/tasks.types';
import { logError } from '../../utils/api';
import { updateQuery } from '../../utils/db-helper';
import { callWithCatch, isNotNullable } from '../../utils/helpers';
import {
    type TaskArgDelete,
    type TaskArgFetchTasksNew,
    type TaskArgUpdate,
    type TaskHistoryRestoreArgs,
    type TaskInsertArgs,
    type TaskReferenceCheckArgs,
    TASK_CREATABLE_COLUMNS,
    TASK_PROJECT_BOUND_COLUMNS,
    TASK_UPDATABLE_COLUMNS,
    type TasksArgToggleTaskUsers,
} from './tasks.server.types';
import type { KanbanArgFilters } from '../kanban/types';
import { assertTaskParent, assertTaskParentClient, lockTaskTree, lockTaskTreeClient, TaskTreeIntegrityError } from './TaskTreeIntegrity';

export class TasksRepository {
    private readonly db: Database;

    constructor() {
        this.db = Database.getInstance();
    }

    async validateDefinitionOfDone(taskId: number): Promise<{ ok: true } | { ok: false; details: string[] }> {
        const task = await this.db.query<{ goal_id: number; work_item_type: string; acceptance_criteria: string | null; sprint_id: number | null }>(
            'SELECT goal_id, work_item_type, acceptance_criteria, sprint_id FROM tasks.tasks WHERE id=$1', [taskId],
        );
        const row = task.rows[0];
        if (!row || row.work_item_type !== 'story') return { ok: true };
        const details: string[] = [];
        if (!row.acceptance_criteria?.trim()) details.push('acceptance_criteria_missing');
        const qa = await this.db.query<{ status: string }>(
            'SELECT status FROM tasks.qa_reviews WHERE goal_id=$1 AND task_id=$2 ORDER BY created_at DESC, id DESC LIMIT 1',
            [row.goal_id, taskId],
        );
        if (qa.rows[0]?.status !== 'approved') details.push(qa.rows[0]?.status === 'observed' ? 'qa_observations_pending' : 'qa_not_approved');
        const bugs = await this.db.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM tasks.tasks
             WHERE goal_id=$1 AND related_task_id=$2 AND work_item_type='bug' AND complete=false`,
            [row.goal_id, taskId],
        );
        if (Number(bugs.rows[0]?.count ?? 0) > 0) details.push('blocking_bugs_open');
        if (row.sprint_id != null) {
            const acceptance = await this.db.query<{ status: string }>(
                'SELECT status FROM tasks.sprint_review_acceptances WHERE goal_id=$1 AND sprint_id=$2 AND task_id=$3',
                [row.goal_id, row.sprint_id, taskId],
            );
            if (acceptance.rows[0]?.status !== 'accepted') details.push('functional_acceptance_missing');
        }
        return details.length ? { ok: false, details } : { ok: true };
    }

    async updateOrdersForTask(orderData: TaskUpdateOrders): Promise<boolean> {
        const data: Partial<Pick<TaskItemInDb, 'kanban_order' | 'task_order'>> = {};
        if (!isNotNullable(orderData['kanbanOrder']) && !isNotNullable(orderData['taskOrder'])) {
            return false;
        }

        if (isNotNullable(orderData['kanbanOrder'])) {
            data['kanban_order'] = orderData['kanbanOrder'];
        }
        if (isNotNullable(orderData['taskOrder'])) {
            data['task_order'] = orderData['taskOrder'];
        }

        const updateData = updateQuery({
            table: 'tasks.tasks',
            data,
            where: { id: orderData['taskId'] },
        });

        const updateResult = await this.db.query(updateData.query, updateData.args).catch(logError);

        if (!updateResult) return false;

        return !!(updateResult?.rowCount && updateResult.rowCount > 0);
    }

    /** @deprecated */
    async fetchAllTasks(data: FetchTasksArg): Promise<TaskItemInDb[] | false> {
        const builder = new FetchTasksQueryBuilder(data, true);
        const queryData = builder.getQuery();

        $logger.debug(queryData, 'FETCH TASKS');

        const tasks = await this.db.query<TaskItemInDb>(queryData.query, queryData.args).catch(logError);

        if (!tasks) {
            return false;
        }

        return tasks.rows;
    }

    async fetchTasks(data: FetchTasksArg): Promise<TaskItemInDb[] | false> {
        const builder = new FetchTasksQueryBuilder(data);
        const queryData = builder.getQuery();

        $logger.debug(queryData, 'FETCH TASKS');

        const tasks = await this.db.query<TaskItemInDb>(queryData.query, queryData.args).catch(logError);

        if (!tasks) {
            return false;
        }

        return tasks.rows;
    }

    /**
     * Deprecated try to use addTaskNew instead which is using drizzle
     * @param arg
     * @param creatorId
     * @returns
     */
    async addTask(arg: AddTaskArg, creatorId: number): Promise<TaskItemInDb | false> {
        const {
            parentId,
            description,
            componentId,
            goalId,
            statusId,
            kanbanOrder,
            startDate = null,
            endDate = null,
            priorityId = 1,
        } = arg;

        if (!goalId) {
            $logger.error(arg, `Can not insert task without goalId ${goalId}`);
            return false;
        }

        const query = parentId
            ? 'INSERT INTO tasks.tasks (description, goal_list_id, parent_id, creator_id, goal_id, start_date, end_date, priority_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;'
            : 'INSERT INTO tasks.tasks (description, goal_list_id, creator_id, goal_id, status_id, kanban_order, start_date, end_date, priority_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;';

        const componentIdValue = !componentId || componentId === ALL_TASKS_LIST_ID ? null : componentId;
        const args = parentId
            ? [description, componentIdValue, parentId, creatorId, goalId, startDate, endDate, priorityId]
            : [description, componentIdValue, creatorId, goalId, statusId, kanbanOrder, startDate, endDate, priorityId];

        let result;
        if (parentId) {
            const client = await this.db.getClient();
            try {
                await client.query('BEGIN');
                await lockTaskTreeClient(client);
                await assertTaskParentClient(client, { goalId, parentId });
                result = await client.query<{ id: number }>(query, args);
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK').catch(() => undefined);
                logError(error);
                return false;
            } finally {
                client.release();
            }
        } else {
            result = await this.db.query<{ id: number }>(query, args).catch(logError);
        }

        if (!result) {
            return false;
        }

        if (result.rowCount === 0) {
            return false;
        }
        return await this.fetchTaskById(result.rows[0].id);
    }

    async fetchTaskById(taskId: number): Promise<TaskItemInDb | false> {
        const task = await this.db
            .query<TaskItemInDb>(
                'select *, start_date::text, end_date::text from tasks.tasks where id = $1 order by id desc',
                [taskId]
            )
            .catch(logError);

        if (!task) {
            return false;
        }

        if (task.rows.length === 0) {
            return false;
        }

        return task.rows[0];
    }

    async fetchTagsForTasks(taskIds: number[]): Promise<TagsForTasks> {
        if (taskIds.length === 0) {
            return [];
        }

        const placeholders = taskIds.map((_v, i) => `$${i + 1}`).join(',');
        const result = await this.db
            .query<TagsForTasks[number]>(
                `SELECT tag_id, task_id FROM tasks.tasks_to_tags WHERE task_id in (${placeholders})`,
                taskIds
            )
            .catch(logError);

        if (!result) {
            return [];
        }
        return result.rows;
    }

    async fetchTagsIdsForTask(taskId: number): Promise<number[]> {
        const query = 'SELECT tag_id FROM tasks.tasks_to_tags WHERE task_id = $1';
        const result = await this.db.query<{ tag_id: number }>(query, [taskId]).catch(logError);

        if (!result || result.rows.length === 0) {
            return [];
        }

        return result.rows.map((row) => row.tag_id);
    }

    async updateTaskDescription(taskId: number, description: string): Promise<TaskItemInDb | false> {
        const queryData = updateQuery({
            table: 'tasks.tasks',
            data: { description },
            where: { id: taskId },
        });

        const result = await this.db.query(queryData.query, queryData.args).catch(logError);

        if (!result) {
            return false;
        }

        return await this.fetchTaskById(taskId);
    }

    async updateTaskComplete(taskId: number, complete: boolean): Promise<TaskItemInDb | false> {
        const queryData = updateQuery({
            table: 'tasks.tasks',
            // date_complete is maintained by the tasks.update_date_complete DB trigger.
            data: { complete: Number(complete) },
            where: { id: taskId },
        });

        const result = await this.db.query(queryData.query, queryData.args).catch(logError);

        if (!result) {
            return false;
        }

        return await this.fetchTaskById(taskId);
    }

    async deleteTask(taskId: number): Promise<boolean> {
        const result = await this.db.query('DELETE FROM tasks.tasks WHERE id = $1', [taskId]).catch(logError);

        if (!result) {
            return false;
        }

        return !!(result.rowCount && result.rowCount > 0);
    }

    async updateTaskNote(taskId: number, note: string): Promise<boolean> {
        const queryData = updateQuery({
            table: 'tasks.tasks',
            data: { note },
            where: { id: taskId },
        });

        const result = await this.db.query(queryData.query, queryData.args).catch(logError);

        return !!(result?.rowCount && result.rowCount > 0);
    }

    async updateTaskDate(
        taskId: number,
        data: UpdateTaskDeadlineArg['data'],
        status: UpdateTaskDeadlineArg['status']
    ): Promise<boolean> {
        const columnNames =
            status === 'end' ? ['end_date = $1', 'end_time = $2'] : ['start_date = $1', 'start_time = $2'];

        const query = `UPDATE tasks.tasks SET ${columnNames.join(', ')} WHERE id = $3`;
        const result = await this.db.query(query, [data.date ?? null, data.time ?? null, taskId]).catch(logError);

        return !!(result?.rowCount && result.rowCount > 0);
    }

    async getTaskDeadlineDates(taskId: number): Promise<TaskDatesFromDb | false> {
        const result = await this.db
            .query<TaskDatesFromDb>(
                'SELECT start_date::text AS "startDate", end_date::text AS "endDate", end_time AS "endTime", start_time AS "startTime" FROM tasks.tasks WHERE id = $1',
                [taskId]
            )
            .catch(logError);

        if (!result || result.rows.length === 0) {
            return false;
        }

        return result.rows[0];
    }

    async fetchSubtasks(taskId: number): Promise<TasksSchemaTypeForSelect[]> {
        const result = await callWithCatch(() =>
            this.db.dbDrizzle.select().from(TasksSchema).where(eq(TasksSchema.parentId, taskId)).orderBy(asc(TasksSchema.id))
        );

        return result ?? [];
    }

    async moveTask(taskId: number, goalListId: number | null): Promise<boolean> {
        const queryData = updateQuery({
            table: 'tasks.tasks',
            data: {
                goal_list_id: goalListId,
            },
            where: { id: taskId },
        });

        const result = await this.db.query(queryData.query, queryData.args).catch(logError);

        return !!(result?.rowCount && result.rowCount > 0);
    }

    async fetchAppPriorities(): Promise<any[]> {
        const result = await this.db
            .query<{ id: 1 | 2 | 3; code: 'low' | 'medium' | 'high' }>(
                `SELECT * 
             FROM tasks.priority 
             ORDER BY id`
            )
            .catch(logError);

        if (!result) {
            return [];
        }

        return result.rows;
    }

    async updatePriority(taskId: number, priorityId: number): Promise<boolean> {
        const queryData = updateQuery({
            table: 'tasks.tasks',
            data: { priority_id: priorityId },
            where: { id: taskId },
        });

        const result = await this.db.query(queryData.query, queryData.args).catch(logError);

        return !!(result?.rowCount && result.rowCount > 0);
    }

    async fetchTaskHistory(taskId: number): Promise<TaskHistoryItemFromServer[]> {
        const result = await this.db
            .query<TaskHistoryItemFromServer>(
                `SELECT id AS history_id, task 
             FROM history.tasks_tasks 
             WHERE task_id = $1 
             ORDER BY id DESC`,
                [taskId]
            )
            .catch(logError);

        if (result) {
            const actualTask = await this.db
                .query<TaskItemInDb>(`SELECT *, start_date::text, end_date::text FROM tasks.tasks WHERE id = $1`, [taskId])
                .catch(logError);
            if (actualTask) {
                result.rows.unshift({ history_id: null, task: actualTask.rows[0] });
            } else {
                $logger.error(`Can not fetch data for actual task`);
            }
        }

        return result?.rows || [];
    }

    async fetchTaskHistoryById(id: number): Promise<TaskHistoryItemFromDb | null> {
        const result = await this.db
            .query<TaskHistoryItemFromDb>(
                `SELECT * 
             FROM history.tasks_tasks 
             WHERE id = $1`,
                [id]
            )
            .catch(logError);

        if (!result || result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }

    async updateTaskState(taskData: TaskItemInDb): Promise<boolean> {
        const taskId = taskData.id;
        delete (taskData as Partial<TaskItemInDb>).id;
        delete (taskData as Partial<TaskItemInDb>).creator_id;
        delete (taskData as Partial<TaskItemInDb>).date_creation;
        delete (taskData as Partial<TaskItemInDb>).edit_date;

        const data = updateQuery({
            table: 'tasks.tasks',
            data: taskData,
            where: { id: taskId },
        });

        let result;
        if (Object.hasOwn(taskData, 'parent_id')) {
            const client = await this.db.getClient();
            try {
                await client.query('BEGIN');
                await lockTaskTreeClient(client);
                const current = await client.query<{ goal_id: number }>('SELECT goal_id FROM tasks.tasks WHERE id = $1 FOR UPDATE', [taskId]);
                const parentId = (taskData as TaskItemInDb).parent_id;
                if (parentId !== null && parentId !== undefined) await assertTaskParentClient(client, { goalId: current.rows[0]?.goal_id ?? -1, parentId, taskId });
                result = await client.query(data.query, data.args);
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK').catch(() => undefined);
                logError(error);
                return false;
            } finally {
                client.release();
            }
        } else {
            result = await this.db.query(data.query, data.args).catch(logError);
        }

        return !!(result?.rowCount && result.rowCount > 0);
    }

    async fetchListName(listId: number): Promise<any[]> {
        const query = 'SELECT name FROM tasks.goal_lists WHERE id = $1';
        const result = await this.db.query(query, [listId]).catch(logError);

        if (result && result.rows.length > 0) {
            return result.rows;
        }
        return [];
    }

    /**@deprecated try to use toggleTaskUsers instead */
    async updateTaskAssignee(taskId: number, userIds: number[]): Promise<boolean> {
        const deleteQuery = 'DELETE FROM tasks_auth.task_assignee WHERE task_id = $1';
        const deleteResult = await this.db.query(deleteQuery, [taskId]).catch(logError);

        if (!deleteResult) {
            $logger.error(`Can not update assignee for task ${taskId} users ${userIds}`);
        }

        if (userIds.length > 0) {
            let insertQuery = 'INSERT INTO tasks_auth.task_assignee (task_id, collab_user_id) VALUES ';
            const values: any = [];
            const args: any[] = [];

            userIds.forEach((userId, index) => {
                values.push(`($1, $${index + 2})`);
                args.push(userId);
            });

            insertQuery += values.join(',');
            const insertResult = await this.db.query(insertQuery, [taskId, ...args]).catch((err) => {
                logError(err);
            });

            return !!(insertResult?.rowCount && insertResult.rowCount > 0);
        }

        return true;
    }

    async toggleTaskUsers(data: TasksArgToggleTaskUsers): Promise<number[]> {
        const result = await callWithCatch(() =>
            this.db.dbDrizzle.transaction(async (tx) => {
                await tx.delete(TasksAssigneeSchema).where(eq(TasksAssigneeSchema.taskId, data.taskId));

                if (data.userIds.length > 0) {
                    return await tx
                        .insert(TasksAssigneeSchema)
                        .values(data.userIds.map((userId) => ({ taskId: data.taskId, collabUserId: userId })))
                        .returning();
                }
                return [];
            })
        );

        return result?.map((rec) => rec.collabUserId) ?? [];
    }

    // Fetch task assignees for a given task
    async fetchTaskAssignee(taskId: number): Promise<number[]> {
        const query = 'SELECT collab_user_id FROM tasks_auth.task_assignee WHERE task_id = $1';
        const result = await this.db.query(query, [taskId]).catch(logError);

        if (result && result.rows.length > 0) {
            return result.rows.map((rec: any) => rec.collab_user_id);
        }

        return [];
    }

    async fetchTaskAssigneeForTasks(taskIds: number[]): Promise<{ task_id: number; collab_user_id: number }[]> {
        if (taskIds.length === 0) {
            return [];
        }

        const query = `SELECT task_id, collab_user_id FROM tasks_auth.task_assignee WHERE task_id in (${taskIds.map((_, i) => `$${i + 1}`).join(',')})`;
        const result = await this.db.query<{ task_id: number; collab_user_id: number }>(query, taskIds).catch(logError);

        if (result && result.rows.length > 0) {
            return result.rows;
        }

        return [];
    }

    async recoveryTaskHistory(historyId: number, taskId: number): Promise<boolean> {
        const history = await this.fetchTaskHistoryById(historyId);
        const current = await this.fetchTaskByIdNew(taskId);

        if (!history || !current) {
            return false;
        }

        return await this.updateTaskState(this.restorableState({ snapshot: history.task, currentGoalId: current.goalId }));
    }

    private restorableState(args: TaskHistoryRestoreArgs): TaskItemInDb {
        const state: Partial<TaskItemInDb> = { ...args.snapshot };
        delete state.goal_id;
        delete state.owner;
        if (args.snapshot.goal_id !== args.currentGoalId) {
            for (const column of TASK_PROJECT_BOUND_COLUMNS) delete state[column];
        }
        return state as TaskItemInDb;
    }

    async updateTaskStatusId(data: TasksUpdateStatusId): Promise<boolean> {
        const result = await callWithCatch(() => this.db.dbDrizzle.transaction(async (tx) => {
            await lockTaskTree(tx);
            const [current] = await tx.select({ goalId: TasksSchema.goalId, statusId: TasksSchema.statusId, parentId: TasksSchema.parentId })
                .from(TasksSchema).where(eq(TasksSchema.id, data.taskId)).for('update');
            if (!current) return [];
            const patch: Partial<typeof TasksSchema.$inferInsert> = { statusId: data.statusId };
            if (current.statusId !== data.statusId) {
                const [row] = await tx.select({ min: sql<number>`MIN(${TasksSchema.kanbanOrder})` }).from(TasksSchema)
                    // The unique index covers every task in the same column,
                    // including subtasks. Excluding children can reuse their
                    // order and make the status update fail with a duplicate key.
                    .where(and(eq(TasksSchema.goalId, current.goalId), data.statusId === null ? isNull(TasksSchema.statusId) : eq(TasksSchema.statusId, data.statusId)));
                patch.kanbanOrder = (row?.min ?? 0) - TasksRepository.KANBAN_ORDER_GAP;
            }
            return tx.update(TasksSchema).set(patch).where(eq(TasksSchema.id, data.taskId)).returning({ id: TasksSchema.id });
        }));
        return !!result?.length;
    }

    async fetchAllowedListIdsForTask(taskId: TaskItemInDb['id']): Promise<GoalListInDb['id'][]> {
        const task = await this.fetchTaskById(taskId);
        if (!task) return [];
        const query = 'select id from tasks.goal_lists where goal_id = $1;';
        const result = await this.db.query<{ id: number }>(query, [task.goal_id]);
        return result.rows.map((list) => list.id);
    }

    async updateAmount(data: TaskUpdateAmount): Promise<boolean> {
        const queryData = updateQuery({
            table: 'tasks.tasks',
            data: { amount: data.amount },
            where: { id: data.taskId },
        });

        const result = await this.db.query(queryData.query, queryData.args).catch(logError);

        return !!(result?.rowCount && result.rowCount > 0);
    }

    async updateTransactionType(data: TaskUpdateTransactionType): Promise<boolean> {
        const queryData = updateQuery({
            table: 'tasks.tasks',
            data: { transaction_type: data.transactionType },
            where: { id: data.taskId },
        });

        const result = await this.db.query(queryData.query, queryData.args).catch(logError);

        return !!(result?.rowCount && result.rowCount > 0);
    }

    async updateTask(data: TaskArgUpdate): Promise<TasksSchemaTypeForSelect | null> {
        const updates: Partial<typeof TasksSchema.$inferInsert> = {};
        for (const column of TASK_UPDATABLE_COLUMNS) {
            if (data[column] !== undefined) {
                updates[column] = data[column] as never;
            }
        }

        if (Object.keys(updates).length === 0) {
            return this.fetchTaskByIdNew(data.id);
        }

        const result = (updates.parentId !== undefined || updates.statusId !== undefined)
            ? await this.db.dbDrizzle.transaction(async (tx) => {
                await lockTaskTree(tx);
                const [current] = await tx.select({ goalId: TasksSchema.goalId, statusId: TasksSchema.statusId, parentId: TasksSchema.parentId }).from(TasksSchema).where(eq(TasksSchema.id, data.id)).for('update');
                if (!current) return [];
                if (updates.parentId != null) await assertTaskParent(tx, { goalId: current.goalId, parentId: updates.parentId, taskId: data.id });
                if (updates.statusId !== undefined && updates.statusId !== current.statusId) {
                    const [row] = await tx.select({ min: sql<number>`MIN(${TasksSchema.kanbanOrder})` }).from(TasksSchema)
                        // uniq_tasks_goal_status_order includes subtasks, so
                        // choose a free order across the entire destination column.
                        .where(and(eq(TasksSchema.goalId, current.goalId), updates.statusId === null ? isNull(TasksSchema.statusId) : eq(TasksSchema.statusId, updates.statusId)));
                    updates.kanbanOrder = (row?.min ?? 0) - TasksRepository.KANBAN_ORDER_GAP;
                }
                return tx.update(TasksSchema).set(updates).where(eq(TasksSchema.id, data.id)).returning();
            }).catch((error: unknown) => {
                if (updates.parentId !== undefined || error instanceof TaskTreeIntegrityError || (error instanceof Error && error.name === 'TaskTreeIntegrityError')) throw new TaskTreeIntegrityError();
                // Do not turn a failed status/completion write into an empty
                // result. The controller must return an error so the client
                // can report the real failure instead of a misleading success.
                throw error;
            })
            : await callWithCatch(() => this.db.dbDrizzle.update(TasksSchema).set(updates).where(eq(TasksSchema.id, data.id)).returning());
        return result?.[0] ?? null;
    }

    // The tasks after the cursor in fetch()'s order. Priorities sort with nulls last, ties newest first.
    private afterCursorCondition(data: TaskArgFetchTasksNew) {
        const id = data.afterId!;
        const descending = +data.firstNew === 1;
        if (data.sortBy !== 'priority') {
            return descending ? lt(TasksSchema.id, id) : gt(TasksSchema.id, id);
        }
        const priority = data.afterPriority ?? null;
        if (priority === null) {
            return and(isNull(TasksSchema.priorityId), lt(TasksSchema.id, id))!;
        }
        return or(
            descending ? lt(TasksSchema.priorityId, priority) : gt(TasksSchema.priorityId, priority),
            and(eq(TasksSchema.priorityId, priority), lt(TasksSchema.id, id)),
            isNull(TasksSchema.priorityId)
        )!;
    }

    async fetchTaskByIdNew(taskId: number): Promise<TasksSchemaTypeForSelect | null> {
        const result = await callWithCatch(() =>
            this.db.dbDrizzle.select().from(TasksSchema).where(eq(TasksSchema.id, taskId))
        );
        return result?.[0] ?? null;
    }

    async fetchTaskParentSummaries(goalId: number, taskIds: number[]): Promise<Map<number, { issueKey: string; description: string }>> {
        if (taskIds.length === 0) return new Map();
        const rows = await callWithCatch(() => this.db.dbDrizzle
            .select({ id: TasksSchema.id, issueKey: TasksSchema.issueKey, description: TasksSchema.description })
            .from(TasksSchema)
            .where(and(eq(TasksSchema.goalId, goalId), inArray(TasksSchema.id, taskIds))));
        return new Map((rows ?? []).map(row => [row.id, { issueKey: row.issueKey, description: row.description ?? '' }]));
    }

    async fetchTaskEpicSummaries(goalId: number, taskIds: number[]): Promise<Map<number, { issueKey: string; title: string }>> {
        if (taskIds.length === 0) return new Map();
        const { rows } = await this.db.query<{ task_id: number; issue_key: string; title: string }>(
            `WITH RECURSIVE task_ancestry AS (
                SELECT id AS task_id, id, parent_id, related_task_id, work_item_type, epic_id, 0 AS depth
                FROM tasks.tasks WHERE goal_id = $1 AND id = ANY($2::int[])
                UNION ALL
                SELECT child.task_id, parent.id, parent.parent_id, parent.related_task_id,
                       parent.work_item_type, parent.epic_id, child.depth + 1
                FROM tasks.tasks parent
                JOIN task_ancestry child
                  ON parent.id = CASE WHEN child.work_item_type = 'bug' THEN child.related_task_id ELSE child.parent_id END
                WHERE child.epic_id IS NULL AND child.depth < 32
            )
            SELECT DISTINCT ON (ancestry.task_id) ancestry.task_id, epic.issue_key, epic.title
            FROM task_ancestry ancestry
            JOIN tasks.scrum_epics epic ON epic.id = ancestry.epic_id AND epic.goal_id = $1
            ORDER BY ancestry.task_id, ancestry.depth`,
            [goalId, taskIds],
        );
        return new Map(rows.map(row => [row.task_id, { issueKey: row.issue_key, title: row.title }]));
    }

    async fetch(data: TaskArgFetchTasksNew): Promise<TasksSchemaTypeForSelect[]> {
        const now = performance.now();

        const unlimited = data.unlimited ?? false;

        // Always scoped to the goal: the caller's permissions were checked for this goal, so a list from another goal yields nothing
        const conditions = [isNull(TasksSchema.parentId), eq(TasksSchema.goalId, data.goalId)];
        if (+data.componentId !== ALL_TASKS_LIST_ID && +data.componentId !== -1) {
            conditions.push(eq(TasksSchema.goalListId, data.componentId));
        }

        // priority
        if (data.filters?.priority !== undefined) {
            conditions.push(eq(TasksSchema.priorityId, data.filters.priority as 1 | 2 | 3));
        }

        if (data.filters?.priorities?.length) {
            const priorityIds = data.filters.priorities.filter((id) => id !== 0);
            const priorityMatches = [
                ...(priorityIds.length ? [inArray(TasksSchema.priorityId, priorityIds)] : []),
                ...(data.filters.priorities.includes(0) ? [isNull(TasksSchema.priorityId)] : []),
            ];
            conditions.push(or(...priorityMatches)!);
        }

        // sprint
        if (data.filters?.sprintId !== undefined) {
            conditions.push(eq(TasksSchema.sprintId, data.filters.sprintId));
        }

        // period: a task with a single date spans just that day; tasks without dates never match
        if (data.dateFrom !== undefined) {
            conditions.push(sql`COALESCE(${TasksSchema.endDate}, ${TasksSchema.startDate}) >= ${data.dateFrom}`);
        }
        if (data.dateTo !== undefined) {
            conditions.push(sql`COALESCE(${TasksSchema.startDate}, ${TasksSchema.endDate}) <= ${data.dateTo}`);
        }
        if (data.undated) {
            conditions.push(isNull(TasksSchema.startDate), isNull(TasksSchema.endDate));
        }

        // search
        if (data.searchText) {
            conditions.push(ilike(TasksSchema.description, `%${data.searchText}%`));
        }

        // complete
        if (!data.ignoreCompleted) {
            if (data.showCompleted === 0) conditions.push(eq(TasksSchema.complete, false));
            else if (data.showCompleted === 1) conditions.push(eq(TasksSchema.complete, true));
        }

        // assignee filter — через EXISTS
        if (data.filters?.selectedUser) {
            conditions.push(
                exists(
                    this.db.dbDrizzle
                        .select({ one: sql`1` })
                        .from(TasksAssigneeSchema)
                        .where(
                            and(
                                eq(TasksAssigneeSchema.taskId, TasksSchema.id),
                                eq(TasksAssigneeSchema.collabUserId, data.filters.selectedUser)
                            )
                        )
                )
            );
        }

        if (data.filters?.assignees?.length) {
            const assigneeIds = data.filters.assignees.filter((id) => id !== 0);
            const assigneeOf = (userIds?: number[]) =>
                this.db.dbDrizzle
                    .select({ one: sql`1` })
                    .from(TasksAssigneeSchema)
                    .where(
                        and(
                            eq(TasksAssigneeSchema.taskId, TasksSchema.id),
                            userIds ? inArray(TasksAssigneeSchema.collabUserId, userIds) : undefined
                        )
                    );
            const assigneeMatches = [
                ...(assigneeIds.length ? [exists(assigneeOf(assigneeIds))] : []),
                ...(data.filters.assignees.includes(0) ? [notExists(assigneeOf())] : []),
            ];
            conditions.push(or(...assigneeMatches)!);
        }

        if (data.filters?.statuses?.length) {
            const statusIds = data.filters.statuses.filter((id) => id !== 0);
            const statusMatches = [
                ...(statusIds.length ? [inArray(TasksSchema.statusId, statusIds)] : []),
                ...(data.filters.statuses.includes(0) ? [isNull(TasksSchema.statusId)] : []),
            ];
            conditions.push(or(...statusMatches)!);
        }

        // tags filter — by EXISTS (any of the list)
        if (data.filters?.selectedTags) {
            const tagIds = Object.keys(data.filters.selectedTags).map(Number);
            if (tagIds.length > 0) {
                conditions.push(
                    exists(
                        this.db.dbDrizzle
                            .select({ one: sql`1` })
                            .from(TasksToTagsSchema)
                            .where(
                                and(
                                    eq(TasksToTagsSchema.taskId, TasksSchema.id),
                                    inArray(TasksToTagsSchema.tagId, tagIds)
                                )
                            )
                    )
                );
            }
        }

        const descending = +data.firstNew === 1;
        const order =
            data.sortBy === 'priority'
                ? [
                    descending
                        ? sql`${TasksSchema.priorityId} DESC NULLS LAST`
                        : sql`${TasksSchema.priorityId} ASC NULLS LAST`,
                    desc(TasksSchema.id),
                ]
                : [descending ? desc(TasksSchema.id) : asc(TasksSchema.id)];

        if (data.afterId !== undefined) {
            conditions.push(this.afterCursorCondition(data));
        }

        const limit = 30;
        const offset = data.afterId !== undefined ? 0 : (data.page ?? 0) * limit;

        let dbv;
        if (unlimited) {
            dbv = this.db.dbDrizzle
                .select()
                .from(TasksSchema)
                .where(and(...conditions))
                .orderBy(...order);
        } else {
            dbv = this.db.dbDrizzle
                .select()
                .from(TasksSchema)
                .where(and(...conditions))
                .orderBy(...order)
                .limit(limit)
                .offset(offset);
        }

        const rows = await dbv.execute();

        console.log('TaskArgFetchTasksNew time', performance.now() - now);
        return rows;
    }

    async addTaskNew(args: TaskInsertArgs): Promise<TasksSchemaTypeForSelect[]> {
        // Validated input keeps undeclared keys, so only the declared columns are written
        const values: typeof TasksSchema.$inferInsert = { goalId: args.data.goalId, creatorId: args.creatorId };
        for (const column of TASK_CREATABLE_COLUMNS) {
            if (args.data[column] !== undefined) {
                values[column] = args.data[column] as never;
            }
        }
        const result = await callWithCatch(() => this.db.dbDrizzle.transaction(async (tx) => {
            await lockTaskTree(tx);
            if (values.parentId != null) await assertTaskParent(tx, { goalId: values.goalId, parentId: values.parentId });
            else if (values.kanbanOrder == null) {
                const [row] = await tx.select({ min: sql<number>`MIN(${TasksSchema.kanbanOrder})` }).from(TasksSchema)
                    // Keep generated root-task orders unique against child cards too.
                    .where(and(eq(TasksSchema.goalId, values.goalId), values.statusId == null ? isNull(TasksSchema.statusId) : eq(TasksSchema.statusId, values.statusId)));
                values.kanbanOrder = (row?.min ?? 0) - TasksRepository.KANBAN_ORDER_GAP;
            }
            return tx.insert(TasksSchema).values(values).returning();
        }));
        if (!result) return [];
        return result;
    }

    async deleteTaskNew(data: TaskArgDelete): Promise<boolean> {
        const result = await callWithCatch(() =>
            this.db.dbDrizzle.delete(TasksSchema).where(eq(TasksSchema.id, data.taskId))
        );
        return !!result?.rowCount;
    }

    async fetchTasksForKanbanColumn(goalId: number, columnId: number | null, cursor: number | null, filters?: KanbanArgFilters): Promise<TasksSchemaTypeForSelect[]> {
        const conditions = [
            eq(TasksSchema.goalId, goalId),
            columnId === null ? isNull(TasksSchema.statusId) : eq(TasksSchema.statusId, columnId),
            isNotNull(TasksSchema.kanbanOrder),
            ...(columnId === null ? [isNotNull(TasksSchema.taskOrder)] : []),
            ...(filters?.includeSubtasks ? [] : [isNull(TasksSchema.parentId)]),
        ];
        if (cursor !== null) {
            conditions.push(gt(columnId === null ? TasksSchema.taskOrder : TasksSchema.kanbanOrder, cursor));
        }
        if (filters?.sprintId !== undefined) {
            conditions.push(eq(TasksSchema.sprintId, filters.sprintId));
        }
        if (filters?.listIds && filters.listIds.length > 0) {
            conditions.push(inArray(TasksSchema.goalListId, filters.listIds));
        }
        if (filters?.assigneeIds && filters.assigneeIds.length > 0) {
            conditions.push(
                exists(
                    this.db.dbDrizzle
                        .select({ one: sql`1` })
                        .from(TasksAssigneeSchema)
                        .where(
                            and(
                                eq(TasksAssigneeSchema.taskId, TasksSchema.id),
                                inArray(TasksAssigneeSchema.collabUserId, filters.assigneeIds)
                            )
                        )
                )
            );
        }
        if (filters?.workItemTypes && filters.workItemTypes.length > 0) {
            conditions.push(inArray(TasksSchema.workItemType, filters.workItemTypes));
        }
        if (filters?.priorityIds && filters.priorityIds.length > 0) {
            const priorities = filters.priorityIds.filter((id): id is 1 | 2 | 3 => id === 1 || id === 2 || id === 3);
            if (priorities.length) conditions.push(inArray(TasksSchema.priorityId, priorities));
        }
        if (filters?.epicId !== undefined) {
            const epicFilter = filters.epicId === null
                ? sql`NOT EXISTS (
                    WITH RECURSIVE task_ancestry AS (
                        SELECT id, parent_id, related_task_id, work_item_type, epic_id
                        FROM tasks.tasks current_task WHERE current_task.id = ${TasksSchema.id}
                        UNION
                        SELECT parent.id, parent.parent_id, parent.related_task_id, parent.work_item_type, parent.epic_id
                        FROM tasks.tasks parent
                        JOIN task_ancestry child
                          ON parent.id = CASE WHEN child.work_item_type = 'bug' THEN child.related_task_id ELSE child.parent_id END
                    )
                    SELECT 1 FROM task_ancestry WHERE epic_id IS NOT NULL
                )`
                : sql`EXISTS (
                    WITH RECURSIVE task_ancestry AS (
                        SELECT id, parent_id, related_task_id, work_item_type, epic_id
                        FROM tasks.tasks current_task WHERE current_task.id = ${TasksSchema.id}
                        UNION
                        SELECT parent.id, parent.parent_id, parent.related_task_id, parent.work_item_type, parent.epic_id
                        FROM tasks.tasks parent
                        JOIN task_ancestry child
                          ON parent.id = CASE WHEN child.work_item_type = 'bug' THEN child.related_task_id ELSE child.parent_id END
                    )
                    SELECT 1 FROM task_ancestry WHERE epic_id = ${filters.epicId}
                )`;
            conditions.push(epicFilter);
        }

        const result = await callWithCatch(() =>
            this.db.dbDrizzle.select().from(TasksSchema).where(and(...conditions))
                .orderBy(asc(columnId === null ? TasksSchema.taskOrder : TasksSchema.kanbanOrder), asc(TasksSchema.id)).limit(20)
        );
        if (!result?.length) return [];
        // Enrich the Kanban payload in one query so Scrum-aware cards can show QA
        // state without issuing one request per card.
        const qa = await this.db.query<{ task_id: number; status: 'pending' | 'observed' | 'approved' }>(
            `SELECT DISTINCT ON (task_id) task_id, status
             FROM tasks.qa_reviews
             WHERE goal_id = $1 AND task_id = ANY($2::int[])
             ORDER BY task_id, created_at DESC, id DESC`,
            [goalId, result.map((task) => task.id)],
        ).catch(() => ({ rows: [] as { task_id: number; status: 'pending' | 'observed' | 'approved' }[] }));
        const qaByTask = new Map(qa.rows.map((row) => [row.task_id, row.status]));
        return result.map((task) => ({ ...task, qaStatus: qaByTask.get(task.id) ?? null })) as TasksSchemaTypeForSelect[];
    }

    async fetchTaskWithMinKanbanOrder(goalId: number, columnId?: number | null): Promise<number | null> {
        const conditions = [
            eq(TasksSchema.goalId, goalId),
        ];
        if (columnId !== undefined) {
            conditions.push(columnId === null ? isNull(TasksSchema.statusId) : eq(TasksSchema.statusId, columnId));
        }
        const result = await callWithCatch(() => this.db.dbDrizzle.select({
            minKanbanOrder: sql<number>`MIN(kanban_order)`
        }).from(TasksSchema).where(and(...conditions)));
        return result?.[0]?.minKanbanOrder ?? null;
    }

    async referencesOutsideGoal(args: TaskReferenceCheckArgs): Promise<boolean> {
        const db = this.db.dbDrizzle;
        if (args.goalListId != null) {
            const [list] = await db.select({ goalId: GoalsListSchema.goalId }).from(GoalsListSchema).where(eq(GoalsListSchema.id, args.goalListId));
            if (!list || list.goalId !== args.goalId) return true;
        }
        if (args.statusId != null) {
            const [status] = await db
                .select({ goalId: TasksStatusesSchema.goalId })
                .from(TasksStatusesSchema)
                .where(eq(TasksStatusesSchema.id, args.statusId));
            if (!status || status.goalId !== args.goalId) return true;
        }
        if (args.parentId != null) {
            // Walk up from the new parent: another project, or reaching the task itself (a cycle), is not allowed
            let current: number | null = args.parentId;
            const seen = new Set<number>();
            while (current !== null) {
                if (current === args.taskId || seen.has(current)) return true;
                seen.add(current);
                const [row] = await db
                    .select({ goalId: TasksSchema.goalId, parentId: TasksSchema.parentId })
                    .from(TasksSchema)
                    .where(eq(TasksSchema.id, current));
                if (!row || row.goalId !== args.goalId) return true;
                current = row.parentId;
            }
        }
        return false;
    }

    static readonly KANBAN_ORDER_GAP = 16384;

    async getNextKanbanOrder(goalId: number, columnId?: number | null): Promise<number> {
        const min = await this.fetchTaskWithMinKanbanOrder(goalId, columnId);
        return (min ?? 0) - TasksRepository.KANBAN_ORDER_GAP;
    }
}
