import type { Request, Response } from 'express';
import { GoalPermissions } from '../../types/auth.types';
import { Database } from '../../modules/db';
import { EntryUpdatePermissionChecker } from '../auth/EntryUpdatePermissionChecker';
import { TaskFieldPermissionsForEditOrCreation } from '../tasks/tasks.server.types';
import { assertTaskParentClient, lockTaskTreeClient } from '../tasks/TaskTreeIntegrity';

type WorkType = 'story' | 'task' | 'bug';
const positiveId = (value: unknown): number | null => {
    const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
    return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const workType = (value: unknown): WorkType | null =>
    value === 'story' || value === 'task' || value === 'bug' ? value : null;

export class ScrumController {
    private readonly db = Database.getInstance();

    private async cleanRows(req: Request, rows: Array<Record<string, unknown>>) {
        if (!rows.length) return rows;
        const goalId = Number(rows[0].goal_id);
        const checker = await req.appUser.permissionsFetcher.getCheckerForGoal(goalId);
        for (const row of rows) {
            const watchMap = {
                description: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                note: GoalPermissions.TASK_CAN_WATCH_NOTE,
                goal_list_id: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                priority_id: GoalPermissions.TASKS_CAN_WATCH_PRIORITY,
                start_date: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                end_date: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                start_time: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                end_time: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                parent_id: GoalPermissions.TASKS_CAN_WATCH_SUBTASKS,
                status_id: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                task_order: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                kanban_order: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                amount: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                transaction_type: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                node_graph_position: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT,
                acceptance_criteria: GoalPermissions.TASKS_CAN_WATCH_DETAILS,
            } as const;
            for (const [column, permission] of Object.entries(watchMap)) {
                if (!checker.hasPermissions(permission as never)) row[column] = null;
            }
        }
        return rows;
    }

    private async permit(req: Request, res: Response, goalId: number, mode: 'read' | 'create' | 'edit' = 'read'): Promise<boolean> {
        const checker = await req.appUser.permissionsFetcher.getCheckerForGoal(goalId);
        const allowed = mode === 'read'
            ? checker.hasPermissions(GoalPermissions.COMPONENT_CAN_WATCH_CONTENT)
            : mode === 'create'
                ? checker.hasPermissions(GoalPermissions.COMPONENT_CAN_ADD_TASKS)
                : checker.hasPermissions(GoalPermissions.COMPONENT_CAN_EDIT) || checker.hasPermissions(GoalPermissions.COMPONENT_CAN_EDIT_ALL_TASKS);
        if (allowed) return true;
        res.status(403).json({ error: 'forbidden' });
        return false;
    }

    private async itemGoal(taskId: number): Promise<number | null> {
        const { rows } = await this.db.query<{ goal_id: number }>('SELECT goal_id FROM tasks.tasks WHERE id = $1', [taskId]);
        return rows[0]?.goal_id ?? null;
    }
    private async epicGoal(epicId: number): Promise<number | null> {
        const { rows } = await this.db.query<{ goal_id: number }>('SELECT goal_id FROM tasks.scrum_epics WHERE id = $1', [epicId]);
        return rows[0]?.goal_id ?? null;
    }
    private async sprintGoal(sprintId: number): Promise<number | null> {
        const { rows } = await this.db.query<{ goal_id: number }>('SELECT goal_id FROM tasks.sprints WHERE id = $1', [sprintId]);
        return rows[0]?.goal_id ?? null;
    }
    listEpics = async (req: Request, res: Response) => {
        const goalId = positiveId(req.params.goalId);
        if (!goalId) return res.status(400).json({ error: 'invalid_goal_id' });
        if (!(await this.permit(req, res, goalId))) return;
        const { rows } = await this.db.query('SELECT id, goal_id AS "goalId", issue_key AS "issueKey", title, details, archived, creator_id AS "creatorId", created_at AS "createdAt", edited_at AS "editedAt" FROM tasks.scrum_epics WHERE goal_id = $1 ORDER BY id', [goalId]);
        return res.tvJson(rows);
    };

    createEpic = async (req: Request, res: Response) => {
        const goalId = positiveId(req.params.goalId);
        const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
        if (!goalId || !title || title.length > 500 || (req.body.details != null && typeof req.body.details !== 'string')) return res.status(400).json({ error: 'invalid_epic' });
        if (!(await this.permit(req, res, goalId, 'create'))) return;
        const { rows } = await this.db.query('INSERT INTO tasks.scrum_epics (goal_id,title,details,creator_id) VALUES ($1,$2,$3,$4) RETURNING id, goal_id AS "goalId", issue_key AS "issueKey", title, details, archived, creator_id AS "creatorId", created_at AS "createdAt", edited_at AS "editedAt"', [goalId, title, req.body.details ?? null, req.appUser.getUserData()?.id ?? null]);
        return res.status(201).tvJson(rows[0]);
    };

    getEpic = async (req: Request, res: Response) => {
        const id = positiveId(req.params.epicId);
        if (!id) return res.status(400).json({ error: 'invalid_epic_id' });
        const goalId = await this.epicGoal(id);
        if (!goalId) return res.status(404).json({ error: 'not_found' });
        if (!(await this.permit(req, res, goalId))) return;
        const { rows } = await this.db.query('SELECT id, goal_id AS "goalId", issue_key AS "issueKey", title, details, archived, creator_id AS "creatorId", created_at AS "createdAt", edited_at AS "editedAt" FROM tasks.scrum_epics WHERE id = $1', [id]);
        return res.tvJson(rows[0]);
    };

    updateEpic = async (req: Request, res: Response) => {
        const id = positiveId(req.params.epicId);
        if (!id) return res.status(400).json({ error: 'invalid_epic_id' });
        const goalId = await this.epicGoal(id);
        if (!goalId) return res.status(404).json({ error: 'not_found' });
        if (!(await this.permit(req, res, goalId, 'edit'))) return;
        const title = req.body?.title;
        const details = req.body?.details;
        if ((title !== undefined && (typeof title !== 'string' || !title.trim() || title.length > 500)) || (details !== undefined && details !== null && typeof details !== 'string')) return res.status(400).json({ error: 'invalid_epic' });
        const { rows } = await this.db.query('UPDATE tasks.scrum_epics SET title = COALESCE($2,title), details = CASE WHEN $3 THEN $4 ELSE details END, edited_at = now() WHERE id = $1 RETURNING id, goal_id AS "goalId", issue_key AS "issueKey", title, details, archived, creator_id AS "creatorId", created_at AS "createdAt", edited_at AS "editedAt"', [id, title?.trim(), details !== undefined, details ?? null]);
        return res.tvJson(rows[0]);
    };

    archiveEpic = async (req: Request, res: Response) => {
        const id = positiveId(req.params.epicId);
        if (!id) return res.status(400).json({ error: 'invalid_epic_id' });
        const goalId = await this.epicGoal(id);
        if (!goalId) return res.status(404).json({ error: 'not_found' });
        if (!(await this.permit(req, res, goalId, 'edit'))) return;
        // Archive is intentionally non-destructive; linked stories remain linked.
        const { rows } = await this.db.query('UPDATE tasks.scrum_epics SET archived = true, edited_at = now() WHERE id = $1 RETURNING id, archived', [id]);
        return res.tvJson(rows[0]);
    };

    deleteEpic = async (req: Request, res: Response) => {
        const id = positiveId(req.params.epicId);
        if (!id) return res.status(400).json({ error: 'invalid_epic_id' });
        const goalId = await this.epicGoal(id);
        if (!goalId) return res.status(404).json({ error: 'not_found' });
        if (!(await this.permit(req, res, goalId, 'edit'))) return;
        // The epic FK uses ON DELETE SET NULL, so its work items remain intact.
        const { rowCount } = await this.db.query('DELETE FROM tasks.scrum_epics WHERE id = $1', [id]);
        return rowCount ? res.tvJson({ id, deleted: true }) : res.status(404).json({ error: 'not_found' });
    };

    listEpicStories = async (req: Request, res: Response) => {
        const id = positiveId(req.params.epicId);
        if (!id) return res.status(400).json({ error: 'invalid_epic_id' });
        const goalId = await this.epicGoal(id);
        if (!goalId) return res.status(404).json({ error: 'not_found' });
        if (!(await this.permit(req, res, goalId))) return;
        const { rows } = await this.db.query('SELECT * FROM tasks.tasks WHERE goal_id = $1 AND epic_id = $2 AND work_item_type = $3 ORDER BY id', [goalId, id, 'story']);
        return res.tvJson(await this.cleanRows(req, rows));
    };

    listItems = async (req: Request, res: Response) => {
        const goalId = positiveId(req.params.goalId);
        if (!goalId) return res.status(400).json({ error: 'invalid_goal_id' });
        if (!(await this.permit(req, res, goalId))) return;
        const type = req.query.type === undefined ? null : workType(req.query.type);
        if (req.query.type !== undefined && !type) return res.status(400).json({ error: 'invalid_type' });
        const limit = Math.min(Math.max(positiveId(req.query.limit) ?? 100, 1), 500);
        const offset = Math.max(Number(req.query.offset) || 0, 0);
        const epicFilter = req.query.epicId === undefined ? null : req.query.epicId === 'none' ? 'none' : positiveId(req.query.epicId);
        const parentFilter = req.query.parentId === undefined ? null : req.query.parentId === 'none' ? 'none' : positiveId(req.query.parentId);
        if ((req.query.epicId !== undefined && epicFilter === null) || (req.query.parentId !== undefined && parentFilter === null)) return res.status(400).json({ error: 'invalid_relation_filter' });
        const { rows } = await this.db.query('SELECT * FROM tasks.tasks WHERE goal_id = $1 AND ($2::varchar IS NULL OR work_item_type = $2) AND ($3::varchar IS NULL OR ($3 = \'none\' AND epic_id IS NULL) OR epic_id = NULLIF($3, \'none\')::integer) AND ($4::varchar IS NULL OR ($4 = \'none\' AND parent_id IS NULL) OR parent_id = NULLIF($4, \'none\')::integer) ORDER BY id LIMIT $5 OFFSET $6', [goalId, type, epicFilter === null ? null : String(epicFilter), parentFilter === null ? null : String(parentFilter), limit, offset]);
        return res.tvJson(await this.cleanRows(req, rows));
    };

    getItem = async (req: Request, res: Response) => {
        const id = positiveId(req.params.taskId);
        if (!id) return res.status(400).json({ error: 'invalid_item_id' });
        const goalId = await this.itemGoal(id);
        if (!goalId) return res.status(404).json({ error: 'not_found' });
        if (!(await this.permit(req, res, goalId))) return;
        const { rows } = await this.db.query('SELECT * FROM tasks.tasks WHERE id = $1', [id]);
        return res.tvJson((await this.cleanRows(req, rows))[0]);
    };

    createItem = async (req: Request, res: Response) => {
        const goalId = positiveId(req.params.goalId);
        const type = workType(req.body?.type ?? 'task');
        const title = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
        if (!goalId || !type || !title) return res.status(400).json({ error: 'invalid_item' });
        if (!(await this.permit(req, res, goalId, 'create'))) return;
        const epicId = req.body?.epicId == null ? null : positiveId(req.body.epicId);
        const relatedTaskId = req.body?.relatedTaskId == null ? null : positiveId(req.body.relatedTaskId);
        const parentId = req.body?.parentId == null ? null : positiveId(req.body.parentId);
        if ((req.body?.epicId != null && !epicId) || (req.body?.relatedTaskId != null && !relatedTaskId) || (req.body?.parentId != null && !parentId)) return res.status(400).json({ error: 'invalid_relation' });
        if (epicId && !['story', 'task'].includes(type)) return res.status(400).json({ error: 'invalid_epic_relation' });
        if (relatedTaskId && type !== 'bug') return res.status(400).json({ error: 'invalid_related_item' });
        if (parentId) {
            const checker = await req.appUser.permissionsFetcher.getCheckerForGoal(goalId);
            if (!checker.hasPermissions(GoalPermissions.TASKS_CAN_ADD_SUBTASKS)) return res.status(403).json({ error: 'forbidden' });
        }
        if (req.body.sprintId != null) {
            const sprintId = positiveId(req.body.sprintId);
            if (!sprintId) return res.status(400).json({ error: 'invalid_sprint' });
            const checker = await req.appUser.permissionsFetcher.getCheckerForGoal(goalId);
            if (!checker.hasPermissions(GoalPermissions.SPRINT_CAN_ASSIGN_TASKS)) return res.status(403).json({ error: 'forbidden' });
        }
        if (req.body.priorityId != null && ![1, 2, 3].includes(Number(req.body.priorityId))) return res.status(400).json({ error: 'invalid_priority' });
        if (req.body.owner != null && !positiveId(req.body.owner)) return res.status(400).json({ error: 'invalid_owner' });
        if (['note', 'acceptanceCriteria'].some((field) => req.body[field] != null && typeof req.body[field] !== 'string')) return res.status(400).json({ error: 'invalid_text_field' });
        if (req.body.estimateValue != null && (!Number.isFinite(Number(req.body.estimateValue)) || Number(req.body.estimateValue) < 0)) return res.status(400).json({ error: 'invalid_estimate' });
        const statusId = req.body.statusId == null ? null : positiveId(req.body.statusId);
        if (req.body.statusId != null && !statusId) return res.status(400).json({ error: 'invalid_status' });
        const client = await this.db.getClient();
        let rows: Array<Record<string, unknown>>;
        try {
            await client.query('BEGIN');
            await lockTaskTreeClient(client);
            if (parentId) await assertTaskParentClient(client, { goalId, parentId });
            if (epicId) {
                const target = await client.query('SELECT goal_id, archived FROM tasks.scrum_epics WHERE id=$1', [epicId]);
                if (target.rows[0]?.goal_id !== goalId || target.rows[0]?.archived) throw new Error('invalid_epic_relation');
            }
            if (relatedTaskId) {
                const target = await client.query('SELECT goal_id,work_item_type FROM tasks.tasks WHERE id=$1', [relatedTaskId]);
                if (target.rows[0]?.goal_id !== goalId || !['task', 'story'].includes(target.rows[0]?.work_item_type)) throw new Error('invalid_related_item');
            }
            if (statusId) {
                const target = await client.query('SELECT goal_id FROM tasks.statuses WHERE id=$1', [statusId]);
                if (target.rows[0]?.goal_id !== goalId) throw new Error('invalid_status');
            }
            if (req.body.sprintId != null) {
                const target = await client.query('SELECT goal_id, status FROM tasks.sprints WHERE id=$1', [Number(req.body.sprintId)]);
                if (target.rows[0]?.goal_id !== goalId || target.rows[0]?.status === 'completed') throw new Error('invalid_sprint');
            }
            let kanbanOrder: number | null = null;
            if (parentId === null) {
                const bucket = await client.query<{ min_order: number | null }>('SELECT MIN(kanban_order) AS min_order FROM tasks.tasks WHERE goal_id=$1 AND status_id IS NOT DISTINCT FROM $2 AND parent_id IS NULL', [goalId, statusId]);
                kanbanOrder = (bucket.rows[0]?.min_order ?? 0) - 16384;
            }
            const inserted = await client.query('INSERT INTO tasks.tasks (goal_id,creator_id,description,note,work_item_type,epic_id,acceptance_criteria,related_task_id,parent_id,priority_id,owner,sprint_id,status_id,estimate_value,kanban_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *', [goalId, req.appUser.getUserData()?.id ?? null, title, req.body.note ?? null, type, epicId, req.body.acceptanceCriteria ?? null, relatedTaskId, parentId, req.body.priorityId ?? null, req.body.owner ?? null, req.body.sprintId ?? null, statusId, req.body.estimateValue ?? null, kanbanOrder]);
            rows = inserted.rows;
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => undefined);
            const reason = error instanceof Error ? error.message : '';
            if (['invalid_epic_relation', 'invalid_related_item', 'invalid_status', 'invalid_sprint'].includes(reason)) return res.status(400).json({ error: reason });
            if (error instanceof Error && (error.name === 'TaskTreeIntegrityError' || reason === 'Invalid task hierarchy')) return res.status(400).json({ error: 'invalid_parent' });
            const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
            if (code === '23503' || code === '23514' || code === '23505') return res.status(409).json({ error: 'invalid_relation' });
            return res.status(500).json({ error: 'internal_error' });
        } finally {
            client.release();
        }
        return res.status(201).tvJson((await this.cleanRows(req, rows))[0]);
    };

    updateItem = async (req: Request, res: Response) => {
        const id = positiveId(req.params.taskId);
        if (!id) return res.status(400).json({ error: 'invalid_item_id' });
        const goalId = await this.itemGoal(id);
        if (!goalId) return res.status(404).json({ error: 'not_found' });
        const allowed = ['description', 'note', 'priorityId', 'owner', 'sprintId', 'statusId', 'estimateValue', 'acceptanceCriteria', 'epicId', 'relatedTaskId'] as const;
        const sets: string[] = [];
        const values: unknown[] = [id];
        const cols: Record<(typeof allowed)[number], string> = { description: 'description', note: 'note', priorityId: 'priority_id', owner: 'owner', sprintId: 'sprint_id', statusId: 'status_id', estimateValue: 'estimate_value', acceptanceCriteria: 'acceptance_criteria', epicId: 'epic_id', relatedTaskId: 'related_task_id' };
        for (const key of allowed) if (Object.hasOwn(req.body ?? {}, key)) { values.push(req.body[key]); sets.push(`${cols[key]} = $${values.length}`); }
        if (sets.length === 0) return res.status(400).json({ error: 'empty_update' });
        const fieldPatch = Object.fromEntries(Object.entries(req.body ?? {}).filter(([key]) => key in TaskFieldPermissionsForEditOrCreation));
        if (Object.keys(fieldPatch).length > 0) {
            const checker = new EntryUpdatePermissionChecker({ id, ...fieldPatch }, 'task', req.appUser.permissionsFetcher);
            if (!(await checker.check())) return res.status(403).json({ error: 'forbidden' });
        }
        const specialFields = ['owner', 'sprintId', 'acceptanceCriteria', 'epicId', 'relatedTaskId', 'estimateValue'];
        if (specialFields.some((key) => Object.hasOwn(req.body ?? {}, key))) {
            const checker = await req.appUser.permissionsFetcher.getCheckerForGoal(goalId);
            if (!checker.hasPermissions(GoalPermissions.COMPONENT_CAN_EDIT) && !checker.hasPermissions(GoalPermissions.COMPONENT_CAN_EDIT_ALL_TASKS)) return res.status(403).json({ error: 'forbidden' });
            if (Object.hasOwn(req.body ?? {}, 'owner') && !checker.hasPermissions(GoalPermissions.TASKS_CAN_ASSIGN_USERS)) return res.status(403).json({ error: 'forbidden' });
        }
        // Recheck mutable relationships after acquiring the same lock used by hierarchy and project moves.
        if (req.body.epicId != null && !positiveId(req.body.epicId)) return res.status(400).json({ error: 'invalid_epic_relation' });
        if (req.body.relatedTaskId != null && !positiveId(req.body.relatedTaskId)) return res.status(400).json({ error: 'invalid_related_item' });
        if (req.body.sprintId != null) {
            const sprintId = positiveId(req.body.sprintId);
            if (!sprintId || await this.sprintGoal(sprintId) !== goalId) return res.status(400).json({ error: 'invalid_sprint' });
            const checker = await req.appUser.permissionsFetcher.getCheckerForGoal(goalId);
            if (!checker.hasPermissions(GoalPermissions.SPRINT_CAN_ASSIGN_TASKS)) return res.status(403).json({ error: 'forbidden' });
        }
        if (req.body.statusId != null && !positiveId(req.body.statusId)) return res.status(400).json({ error: 'invalid_status' });
        if (req.body.priorityId != null && ![1, 2, 3].includes(Number(req.body.priorityId))) return res.status(400).json({ error: 'invalid_priority' });
        if (req.body.owner != null && !positiveId(req.body.owner)) return res.status(400).json({ error: 'invalid_owner' });
        if (['description', 'note', 'acceptanceCriteria'].some((field) => req.body[field] != null && typeof req.body[field] !== 'string')) return res.status(400).json({ error: 'invalid_text_field' });
        if (req.body.estimateValue != null && (!Number.isFinite(Number(req.body.estimateValue)) || Number(req.body.estimateValue) < 0)) return res.status(400).json({ error: 'invalid_estimate' });
        const client = await this.db.getClient();
        let rows: Array<Record<string, unknown>>;
        try {
            await client.query('BEGIN');
            await lockTaskTreeClient(client);
            const current = await client.query<{ goal_id: number; parent_id: number | null; status_id: number | null }>('SELECT goal_id,parent_id,status_id FROM tasks.tasks WHERE id=$1 FOR UPDATE', [id]);
            if (!current.rows.length || current.rows[0].goal_id !== goalId) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'not_found' });
            }
            if (req.body.epicId != null) {
                const currentType = await client.query<{ work_item_type: string }>('SELECT work_item_type FROM tasks.tasks WHERE id=$1', [id]);
                if (!['story', 'task'].includes(currentType.rows[0]?.work_item_type)) throw new Error('invalid_epic_relation');
                const target = await client.query('SELECT goal_id,archived FROM tasks.scrum_epics WHERE id=$1', [Number(req.body.epicId)]);
                if (target.rows[0]?.goal_id !== goalId || target.rows[0]?.archived) throw new Error('invalid_epic_relation');
            }
            if (req.body.relatedTaskId != null) {
                const target = await client.query("SELECT goal_id,work_item_type FROM tasks.tasks WHERE id=$1", [Number(req.body.relatedTaskId)]);
                if (target.rows[0]?.goal_id !== goalId || !['task', 'story'].includes(target.rows[0]?.work_item_type)) throw new Error('invalid_related_item');
            }
            if (req.body.sprintId != null) {
                const target = await client.query('SELECT goal_id,status FROM tasks.sprints WHERE id=$1', [Number(req.body.sprintId)]);
                if (target.rows[0]?.goal_id !== goalId || target.rows[0]?.status === 'completed') throw new Error('invalid_sprint');
            }
            if (req.body.statusId != null) {
                const target = await client.query('SELECT goal_id FROM tasks.statuses WHERE id=$1', [Number(req.body.statusId)]);
                if (target.rows[0]?.goal_id !== goalId) throw new Error('invalid_status');
            }
            if (Object.hasOwn(req.body ?? {}, 'statusId') && req.body.statusId !== current.rows[0].status_id && current.rows[0].parent_id === null) {
                const bucket = await client.query<{ min_order: number | null }>('SELECT MIN(kanban_order) AS min_order FROM tasks.tasks WHERE goal_id=$1 AND status_id IS NOT DISTINCT FROM $2 AND parent_id IS NULL', [goalId, req.body.statusId]);
                values.push((bucket.rows[0]?.min_order ?? 0) - 16384);
                sets.push(`kanban_order = $${values.length}`);
            }
            const updated = await client.query(`UPDATE tasks.tasks SET ${sets.join(',')} WHERE id = $1 RETURNING *`, values);
            rows = updated.rows;
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => undefined);
            const reason = error instanceof Error ? error.message : '';
            if (['invalid_epic_relation', 'invalid_related_item', 'invalid_sprint', 'invalid_status'].includes(reason)) return res.status(400).json({ error: reason });
            const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
            if (code === '23503' || code === '23514' || code === '23505') return res.status(409).json({ error: 'invalid_relation' });
            return res.status(500).json({ error: 'internal_error' });
        } finally {
            client.release();
        }
        return rows.length ? res.tvJson((await this.cleanRows(req, rows))[0]) : res.status(404).json({ error: 'not_found' });
    };

    listSubtasks = async (req: Request, res: Response) => {
        const id = positiveId(req.params.taskId);
        if (!id) return res.status(400).json({ error: 'invalid_item_id' });
        const goalId = await this.itemGoal(id);
        if (!goalId) return res.status(404).json({ error: 'not_found' });
        if (!(await this.permit(req, res, goalId))) return;
        const { rows } = await this.db.query('SELECT * FROM tasks.tasks WHERE goal_id = $1 AND parent_id = $2 ORDER BY id', [goalId, id]);
        return res.tvJson(await this.cleanRows(req, rows));
    };

    private async qaTask(taskId: number) {
        const { rows } = await this.db.query<{ goal_id: number; work_item_type: WorkType }>('SELECT goal_id, work_item_type FROM tasks.tasks WHERE id = $1', [taskId]);
        return rows[0] ?? null;
    }

    private async qaWritePermit(req: Request, res: Response, goalId: number): Promise<boolean> {
        return this.permit(req, res, goalId, 'edit');
    }

    listQaReviews = async (req: Request, res: Response) => {
        const taskId = positiveId(req.params.taskId);
        if (!taskId) return res.status(400).json({ error: 'invalid_item_id' });
        const task = await this.qaTask(taskId);
        if (!task) return res.status(404).json({ error: 'not_found' });
        if (!(await this.permit(req, res, task.goal_id))) return;
        const { rows } = await this.db.query(`
            SELECT r.id, r.goal_id AS "goalId", r.task_id AS "taskId", r.status, r.evidence,
                   r.validated_by AS "validatedBy", r.validated_at AS "validatedAt",
                   r.created_at AS "createdAt", r.edited_at AS "editedAt",
                   COALESCE(json_agg(json_build_object(
                       'id', o.id, 'note', o.note, 'bugTaskId', o.bug_task_id,
                       'createdBy', o.created_by, 'createdAt', o.created_at
                   ) ORDER BY o.created_at) FILTER (WHERE o.id IS NOT NULL), '[]'::json) AS observations
            FROM tasks.qa_reviews r
            LEFT JOIN tasks.qa_observations o ON o.goal_id = r.goal_id AND o.review_id = r.id
            WHERE r.goal_id = $1 AND r.task_id = $2
            GROUP BY r.id ORDER BY r.created_at DESC, r.id DESC`, [task.goal_id, taskId]);
        return res.tvJson(rows);
    };

    createQaReview = async (req: Request, res: Response) => {
        const taskId = positiveId(req.params.taskId);
        const status = req.body?.status;
        const evidence = req.body?.evidence;
        if (!taskId || !['pending', 'approved', 'observed'].includes(status) || (evidence != null && typeof evidence !== 'string')) return res.status(400).json({ error: 'invalid_qa_review' });
        const task = await this.qaTask(taskId);
        if (!task) return res.status(404).json({ error: 'not_found' });
        if (!(await this.qaWritePermit(req, res, task.goal_id))) return;
        const validated = status === 'pending' ? null : req.appUser.getUserData()?.id ?? null;
        const { rows } = await this.db.query(`
            INSERT INTO tasks.qa_reviews (goal_id, task_id, status, evidence, validated_by, validated_at)
            VALUES ($1,$2,$3,$4,$5,CASE WHEN $3::varchar = 'pending' THEN NULL ELSE now() END)
            RETURNING id, goal_id AS "goalId", task_id AS "taskId", status, evidence,
                      validated_by AS "validatedBy", validated_at AS "validatedAt", created_at AS "createdAt", edited_at AS "editedAt"`,
        [task.goal_id, taskId, status, evidence ?? null, validated]);
        return res.status(201).tvJson({ ...rows[0], observations: [] });
    };

    addQaObservation = async (req: Request, res: Response) => {
        const taskId = positiveId(req.params.taskId);
        const reviewId = positiveId(req.body?.reviewId);
        const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
        const bugTaskId = req.body?.bugTaskId == null ? null : positiveId(req.body.bugTaskId);
        if (!taskId || !reviewId || !note || note.length > 5000 || (req.body?.bugTaskId != null && !bugTaskId)) return res.status(400).json({ error: 'invalid_qa_observation' });
        const task = await this.qaTask(taskId);
        if (!task) return res.status(404).json({ error: 'not_found' });
        if (!(await this.qaWritePermit(req, res, task.goal_id))) return;
        const review = await this.db.query<{ id: number }>('SELECT id FROM tasks.qa_reviews WHERE id=$1 AND goal_id=$2 AND task_id=$3', [reviewId, task.goal_id, taskId]);
        if (!review.rows.length) return res.status(404).json({ error: 'qa_review_not_found' });
        if (bugTaskId) {
            const bug = await this.db.query<{ goal_id: number; work_item_type: WorkType }>('SELECT goal_id, work_item_type FROM tasks.tasks WHERE id=$1', [bugTaskId]);
            if (bug.rows[0]?.goal_id !== task.goal_id || bug.rows[0]?.work_item_type !== 'bug') return res.status(400).json({ error: 'invalid_bug_relation' });
        }
        const { rows } = await this.db.query(`
            INSERT INTO tasks.qa_observations (goal_id, task_id, review_id, note, bug_task_id, created_by)
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING id, goal_id AS "goalId", task_id AS "taskId", review_id AS "reviewId", note,
                      bug_task_id AS "bugTaskId", created_by AS "createdBy", created_at AS "createdAt"`,
        [task.goal_id, taskId, reviewId, note, bugTaskId, req.appUser.getUserData()?.id ?? null]);
        return res.status(201).tvJson(rows[0]);
    };

    getSprintReviewSummary = async (req: Request, res: Response) => {
        const sprintId = positiveId(req.params.sprintId);
        if (!sprintId) return res.status(400).json({ error: 'invalid_sprint_id' });
        const goal = await this.sprintGoal(sprintId);
        if (!goal) return res.status(404).json({ error: 'not_found' });
        if (!(await this.permit(req, res, goal, 'read'))) return;
        const { rows } = await this.db.query(`
            SELECT t.id, t.issue_key AS "issueKey", t.description, t.work_item_type AS "workItemType",
                   t.complete, t.owner, t.sprint_id AS "sprintId",
                   qa.status AS "qaStatus", qa.validated_at AS "qaValidatedAt",
                   acc.status AS "acceptanceStatus", acc.reviewed_at AS "reviewedAt",
                   acc.reviewed_by AS "reviewedBy"
            FROM tasks.tasks t
            LEFT JOIN LATERAL (
                SELECT status, validated_at FROM tasks.qa_reviews
                WHERE goal_id=t.goal_id AND task_id=t.id ORDER BY created_at DESC, id DESC LIMIT 1
            ) qa ON true
            LEFT JOIN tasks.sprint_review_acceptances acc ON acc.goal_id=t.goal_id AND acc.sprint_id=t.sprint_id AND acc.task_id=t.id
            WHERE t.goal_id=$1 AND t.sprint_id=$2
            ORDER BY t.id`, [goal, sprintId]);
        const bugs = await this.db.query(`
            SELECT b.id, b.issue_key AS "issueKey", b.description, b.related_task_id AS "relatedTaskId", b.status_id AS "statusId"
            FROM tasks.tasks b
            JOIN tasks.tasks parent ON parent.goal_id=b.goal_id AND parent.id=b.related_task_id
            WHERE b.goal_id=$1 AND b.work_item_type='bug' AND parent.sprint_id=$2 AND b.complete=false
            ORDER BY b.id`, [goal, sprintId]);
        return res.tvJson({ sprintId, goalId: goal, items: rows, openBugs: bugs.rows });
    };

    saveSprintReviewAcceptance = async (req: Request, res: Response) => {
        const sprintId = positiveId(req.params.sprintId);
        const taskId = positiveId(req.params.taskId);
        const status = req.body?.status;
        const notes = req.body?.notes;
        if (!sprintId || !taskId || !['accepted', 'observed', 'rejected'].includes(status) || (notes != null && typeof notes !== 'string')) return res.status(400).json({ error: 'invalid_review_acceptance' });
        const goal = await this.sprintGoal(sprintId);
        if (!goal) return res.status(404).json({ error: 'not_found' });
        const checker = await req.appUser.permissionsFetcher.getCheckerForGoal(goal);
        if (!checker.hasPermissions(GoalPermissions.SPRINT_CAN_MANAGE)) return res.status(403).json({ error: 'forbidden' });
        const task = await this.db.query<{ goal_id: number; sprint_id: number | null }>('SELECT goal_id, sprint_id FROM tasks.tasks WHERE id=$1', [taskId]);
        if (task.rows[0]?.goal_id !== goal || task.rows[0]?.sprint_id !== sprintId) return res.status(400).json({ error: 'item_not_in_sprint' });
        const { rows } = await this.db.query(`
            INSERT INTO tasks.sprint_review_acceptances (goal_id, sprint_id, task_id, status, notes, reviewed_by)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (sprint_id, task_id) DO UPDATE SET status=EXCLUDED.status, notes=EXCLUDED.notes, reviewed_by=EXCLUDED.reviewed_by, reviewed_at=now(), edited_at=now()
            RETURNING id, goal_id AS "goalId", sprint_id AS "sprintId", task_id AS "taskId", status, notes,
                      reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt", created_at AS "createdAt", edited_at AS "editedAt"`,
        [goal, sprintId, taskId, status, notes ?? null, req.appUser.getUserData()?.id ?? null]);
        return res.tvJson(rows[0]);
    };
}
