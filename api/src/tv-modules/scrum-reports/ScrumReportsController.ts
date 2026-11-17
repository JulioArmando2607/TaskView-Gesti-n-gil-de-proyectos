import type { Request, Response } from 'express';
import { Database } from '../../modules/db';
import { GoalPermissions } from '../../types/auth.types';
import { toCsv, toXlsx, type ReportCell } from './ScrumReportsExport';

type Filters = {
    goalId: number;
    sprintId: number | null;
    ownerId: number | null;
    type: string | null;
    statusId: number | null;
    priorityId: number | null;
    from: string | null;
    to: string | null;
    page: number;
    limit: number;
};

const positive = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
};

export class ScrumReportsController {
    private readonly db = Database.getInstance();

    private async authorize(req: Request, res: Response, goalId: number): Promise<boolean> {
        const checker = await req.appUser.permissionsFetcher.getCheckerForGoal(goalId);
        if (checker.hasPermissions(GoalPermissions.SPRINT_CAN_VIEW_ANALYTICS) || checker.hasPermissions(GoalPermissions.ANALYTICS_CAN_VIEW)) return true;
        res.status(403).json({ error: 'forbidden' });
        return false;
    }

    private parseFilters(req: Request): Filters | null {
        const goalId = positive(req.params.goalId);
        if (!goalId) return null;
        const type = req.query.type === undefined ? null : String(req.query.type);
        if (type !== null && !['story', 'task', 'bug'].includes(type)) return null;
        const parseOptional = (value: unknown) => value === undefined ? null : positive(value);
        const sprintId = parseOptional(req.query.sprintId);
        const ownerId = parseOptional(req.query.ownerId);
        const statusId = parseOptional(req.query.statusId);
        const priorityId = parseOptional(req.query.priorityId);
        if ([req.query.sprintId, req.query.ownerId, req.query.statusId, req.query.priorityId].some((v) => v !== undefined && v !== null) && [sprintId, ownerId, statusId, priorityId].some((v, i) => [req.query.sprintId, req.query.ownerId, req.query.statusId, req.query.priorityId][i] !== undefined && v === null)) return null;
        const from = req.query.from === undefined ? null : String(req.query.from);
        const to = req.query.to === undefined ? null : String(req.query.to);
        if ((from && !Number.isFinite(Date.parse(from))) || (to && !Number.isFinite(Date.parse(to)))) return null;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        return { goalId, sprintId, ownerId, type, statusId, priorityId, from, to, page, limit };
    }

    private conditions(filters: Filters): { sql: string; values: unknown[] } {
        const values: unknown[] = [filters.goalId];
        const clauses = ['t.goal_id = $1'];
        const add = (sql: string, value: unknown) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
        if (filters.sprintId) add('t.sprint_id = ?', filters.sprintId);
        if (filters.ownerId) add('t.owner = ?', filters.ownerId);
        if (filters.type) add('t.work_item_type = ?', filters.type);
        if (filters.statusId) add('t.status_id = ?', filters.statusId);
        if (filters.priorityId) add('t.priority_id = ?', filters.priorityId);
        if (filters.from) add('t.date_creation >= ?', filters.from);
        if (filters.to) add('t.date_creation < (?::date + interval \'1 day\')', filters.to);
        return { sql: clauses.join(' AND '), values };
    }

    private async fetchItems(filters: Filters, exportAll = false) {
        const condition = this.conditions(filters);
        const values = [...condition.values];
        const pagination = exportAll ? '' : ` LIMIT $${values.push(filters.limit)} OFFSET $${values.push((filters.page - 1) * filters.limit)}`;
        const { rows } = await this.db.query(`
            SELECT t.id, t.issue_key AS "issueKey", t.description, t.work_item_type AS type,
                   t.complete, t.priority_id AS "priorityId", t.status_id AS "statusId",
                   t.sprint_id AS "sprintId", t.owner AS "ownerId", t.date_creation AS "createdAt",
                   t.date_complete AS "completedAt", t.related_task_id AS "relatedTaskId",
                   s.name AS "sprintName", u.login AS "ownerLogin", st.name AS "statusName"
            FROM tasks.tasks t
            LEFT JOIN tasks.sprints s ON s.id=t.sprint_id
            LEFT JOIN tv_auth.users u ON u.id=t.owner
            LEFT JOIN tasks.statuses st ON st.id=t.status_id
            WHERE ${condition.sql}
            ORDER BY t.id DESC${pagination}
        `, values);
        return rows;
    }

    overview = async (req: Request, res: Response) => {
        const filters = this.parseFilters(req);
        if (!filters) return res.status(400).json({ error: 'invalid_filters' });
        if (!(await this.authorize(req, res, filters.goalId))) return;
        const condition = this.conditions(filters);
        const [items, sprint, assignees, qa, bugs, retro] = await Promise.all([
            this.fetchItems(filters),
            this.db.query(`SELECT s.id, s.name, s.start_date AS "startDate", s.end_date AS "endDate", s.status,
                count(t.id) FILTER (WHERE t.work_item_type='story' AND t.parent_id IS NULL)::int AS committed,
                count(t.id) FILTER (WHERE t.work_item_type='story' AND t.parent_id IS NULL AND t.complete=true)::int AS completed,
                count(t.id) FILTER (WHERE t.work_item_type='story' AND t.parent_id IS NULL AND coalesce(acc.status,'')='accepted')::int AS accepted,
                count(t.id) FILTER (WHERE t.work_item_type='story' AND t.parent_id IS NULL AND t.complete=false)::int AS pending,
                count(t.id) FILTER (WHERE t.work_item_type='story' AND t.parent_id IS NULL AND out.outcome IN ('carried-over','incomplete'))::int AS carried_over
                FROM tasks.sprints s LEFT JOIN tasks.tasks t ON t.sprint_id=s.id
                LEFT JOIN tasks.sprint_review_acceptances acc ON acc.sprint_id=s.id AND acc.task_id=t.id
                LEFT JOIN tasks.sprint_task_outcomes out ON out.sprint_id=s.id AND out.task_id=t.id
                WHERE s.goal_id=$1 ${filters.sprintId ? 'AND s.id=$2' : ''}
                GROUP BY s.id ORDER BY s.start_date DESC`, filters.sprintId ? [filters.goalId, filters.sprintId] : [filters.goalId]),
            this.db.query(`SELECT coalesce(t.owner,0)::int AS "ownerId", coalesce(u.login,'Sin responsable') AS "ownerLogin",
                count(*) FILTER (WHERE t.work_item_type='story')::int AS stories,
                count(*) FILTER (WHERE t.work_item_type='task')::int AS tasks,
                count(*) FILTER (WHERE t.work_item_type='bug')::int AS bugs,
                count(*) FILTER (WHERE coalesce(t.complete,false)=false)::int AS pending,
                count(*) FILTER (WHERE t.complete=true)::int AS completed
                FROM tasks.tasks t LEFT JOIN tv_auth.users u ON u.id=t.owner WHERE ${condition.sql} GROUP BY t.owner,u.login ORDER BY u.login`, condition.values),
            this.db.query(`WITH latest AS (SELECT DISTINCT ON (task_id) task_id,status,validated_at,validated_by FROM tasks.qa_reviews ORDER BY task_id,created_at DESC)
                SELECT count(*) FILTER (WHERE t.work_item_type IN ('story','task') AND latest.status='pending')::int AS pending,
                count(*) FILTER (WHERE latest.status='approved')::int AS approved,
                count(*) FILTER (WHERE latest.status='observed')::int AS observed,
                count(DISTINCT CASE WHEN t.work_item_type='bug' THEN t.id END)::int AS bugs,
                count(latest.task_id)::int AS reviewed FROM tasks.tasks t LEFT JOIN latest ON latest.task_id=t.id WHERE ${condition.sql}` , condition.values),
            this.db.query(`SELECT t.id,t.issue_key AS "issueKey",t.description,t.priority_id AS "priorityId",t.status_id AS "statusId",t.owner AS "ownerId",t.related_task_id AS "relatedTaskId",t.date_creation AS "createdAt",t.date_complete AS "resolvedAt" FROM tasks.tasks t WHERE ${condition.sql} AND t.work_item_type='bug' ORDER BY t.id DESC`, condition.values),
            this.db.query(`SELECT ra.sprint_id AS "sprintId",count(*)::int AS total,count(*) FILTER (WHERE ra.status='done')::int AS done FROM tasks.sprint_retro_actions ra JOIN tasks.sprints s ON s.id=ra.sprint_id WHERE s.goal_id=$1 ${filters.sprintId ? 'AND ra.sprint_id=$2' : ''} GROUP BY ra.sprint_id`, filters.sprintId ? [filters.goalId, filters.sprintId] : [filters.goalId]),
        ]);
        const sprintRows = sprint.rows.map((row) => ({ ...row, progressPercent: row.committed ? Math.round((Number(row.completed) / Number(row.committed)) * 10000) / 100 : 0 }));
        return res.tvJson({ filters, items, sprints: sprintRows, assignees: assignees.rows, qa: qa.rows[0] ?? { pending: 0, approved: 0, observed: 0, bugs: 0, reviewed: 0 }, bugs: bugs.rows, retrospectives: retro.rows });
    };

    export = async (req: Request, res: Response) => {
        const filters = this.parseFilters(req);
        if (!filters) return res.status(400).json({ error: 'invalid_filters' });
        if (!(await this.authorize(req, res, filters.goalId))) return;
        const rows = await this.fetchItems(filters, true);
        const headers = ['ID', 'Clave', 'Tipo', 'Descripción', 'Responsable', 'Sprint', 'Estado', 'Prioridad', 'Completado', 'Creado'];
        const data: ReportCell[][] = rows.map((row) => [row.id, row.issueKey, row.type, row.description, row.ownerLogin, row.sprintName, row.statusName, row.priorityId, row.complete ? 'Sí' : 'No', row.createdAt]);
        const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
        if (format === 'xlsx') {
            res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="scrum-report.xlsx"');
            return res.send(toXlsx('Scrum', headers, data));
        }
        res.type('text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="scrum-report.csv"');
        return res.send(`\uFEFF${toCsv(headers, data)}`);
    };
}
