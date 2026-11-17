import { readFileSync } from 'node:fs';
import { Client } from 'pg';

export const SCRATCH = {
    host: '127.0.0.1',
    port: 25432,
    database: 'taskview_l01_scratch_20261114',
    user: 'taskview_l01_scratch',
} as const;

export function scratchCredentials() {
    const file = process.env.L01_TEST_DB_ENV_FILE;
    if (!file) throw new Error('L01_TEST_DB_ENV_FILE is required');
    const values = Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
        const cut = line.indexOf('=');
        return [line.slice(0, cut), line.slice(cut + 1)];
    }));
    const password = values.L01_TEST_DB_PASSWORD;
    const systemId = values.L01_TEST_DB_SYSTEM_ID;
    if (!password || !/^\d{19}$/.test(systemId ?? '')) throw new Error('Scratch credentials or system ID missing');
    return { password, systemId };
}

export default async function setup() {
    const { password, systemId } = scratchCredentials();
    const checks = {
        DB_HOST: SCRATCH.host,
        DB_PORT: String(SCRATCH.port),
        DB_NAME: SCRATCH.database,
        DB_USER: SCRATCH.user,
    };
    for (const [name, expected] of Object.entries(checks)) {
        if (process.env[name] !== expected) throw new Error(`Scratch guard: ${name} mismatch`);
    }
    const client = new Client({ ...SCRATCH, password, connectionTimeoutMillis: 3000 });
    try {
        await client.connect();
        const result = await client.query<{
            name: string; role: string; system_id: string; version: string; address: string;
        }>(`SELECT current_database() AS name, current_user AS role,
                   (SELECT system_identifier::text FROM pg_control_system()) AS system_id,
                   (SELECT version FROM app.version WHERE id = 1) AS version,
                   inet_server_addr()::text AS address`);
        const row = result.rows[0];
        if (row.name !== SCRATCH.database || row.role !== SCRATCH.user || row.system_id !== systemId || row.version !== '1.74.0') {
            throw new Error('Scratch guard: database identity or schema mismatch');
        }
        if (['files_local', 'files_quota', 'import', 'webhooks_files'].includes(process.env.L01_PG_GROUP ?? '')) {
            const required = await client.query(`SELECT to_regclass('tv_files.files') AS files,
              to_regclass('tv_files.file_to_task') AS links,
              to_regclass('tasks.import_jobs') AS jobs,
              pg_get_functiondef('tasks.add_roles_and_permissions()'::regprocedure) AS roles`);
            const check = required.rows[0];
            if (!check.files || !check.links || !check.jobs ||
                (check.roles.match(/'timetracking_can_log'/g) ?? []).length !== 2) {
                throw new Error('Scratch guard: required schema or current role trigger missing');
            }
        }
        process.stdout.write(`Scratch guard PASS: ${row.name}, schema ${row.version}, cluster ${row.system_id}\n`);
    } finally {
        await client.end();
    }
}
