import { sql, type SQL } from 'drizzle-orm';
import type { PoolClient } from 'pg';

// A single transaction-scoped lock serializes only hierarchy mutations. It is
// intentionally global: project moves acquire two project permissions and may
// reparent several rows, so a global key avoids lock-order races between trees.
const TREE_LOCK_NAMESPACE = 172902;
const TREE_LOCK_KEY = 1;

export type TaskTreeTx = { execute: (query: SQL) => Promise<unknown> };

export class TaskTreeIntegrityError extends Error {
    constructor() {
        super('Invalid task hierarchy');
        this.name = 'TaskTreeIntegrityError';
    }
}

export async function lockTaskTree(tx: TaskTreeTx): Promise<void> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${TREE_LOCK_NAMESPACE}, ${TREE_LOCK_KEY})`);
}

export async function lockTaskTreeClient(client: Pick<PoolClient, 'query'>): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [TREE_LOCK_NAMESPACE, TREE_LOCK_KEY]);
}

/** Must run after lockTaskTree and inside the same READ COMMITTED transaction as the write. */
export async function assertTaskParent(tx: TaskTreeTx, args: { goalId: number; parentId: number; taskId?: number }): Promise<void> {
    const result = await tx.execute(sql`
        WITH RECURSIVE ancestors(id, parent_id, goal_id, path, cycle) AS (
            SELECT id, parent_id, goal_id, ARRAY[id]::integer[], false
            FROM tasks.tasks WHERE id = ${args.parentId}
            UNION ALL
            SELECT parent.id, parent.parent_id, parent.goal_id,
                   ancestors.path || parent.id, parent.id = ANY(ancestors.path)
            FROM tasks.tasks parent
            JOIN ancestors ON parent.id = ancestors.parent_id
            WHERE NOT ancestors.cycle
        )
        SELECT NOT EXISTS (SELECT 1 FROM ancestors)
            OR EXISTS (SELECT 1 FROM ancestors WHERE goal_id <> ${args.goalId})
            OR EXISTS (SELECT 1 FROM ancestors WHERE cycle)
            OR (${args.taskId ?? null}::integer IS NOT NULL AND EXISTS (
                SELECT 1 FROM ancestors WHERE id = ${args.taskId ?? null}
            )) AS invalid
    `);
    const rows = (result as { rows?: Array<{ invalid: boolean }> }).rows ?? [];
    if (rows[0]?.invalid !== false) throw new TaskTreeIntegrityError();
}

export async function assertTaskParentClient(client: Pick<PoolClient, 'query'>, args: { goalId: number; parentId: number; taskId?: number }): Promise<void> {
    const result = await client.query<{ invalid: boolean }>(`
        WITH RECURSIVE ancestors(id, parent_id, goal_id, path, cycle) AS (
            SELECT id, parent_id, goal_id, ARRAY[id]::integer[], false FROM tasks.tasks WHERE id = $1
            UNION ALL
            SELECT parent.id, parent.parent_id, parent.goal_id, ancestors.path || parent.id, parent.id = ANY(ancestors.path)
            FROM tasks.tasks parent JOIN ancestors ON parent.id = ancestors.parent_id WHERE NOT ancestors.cycle
        )
        SELECT NOT EXISTS (SELECT 1 FROM ancestors)
            OR EXISTS (SELECT 1 FROM ancestors WHERE goal_id <> $2)
            OR EXISTS (SELECT 1 FROM ancestors WHERE cycle)
            OR ($3::integer IS NOT NULL AND EXISTS (SELECT 1 FROM ancestors WHERE id = $3)) AS invalid
    `, [args.parentId, args.goalId, args.taskId ?? null]);
    if (result.rows[0]?.invalid !== false) throw new TaskTreeIntegrityError();
}
