import { Client } from 'pg';

const expected = {
    host: '127.0.0.1',
    port: '25433',
    database: 'taskview_l02_final_20261115',
    user: 'l02synthetic',
    systemId: '7708388125454340134',
};

export default async function setup() {
    if (process.env.L02_PG_TEST_ONLY !== '1') throw new Error('Lista 02 test guard is not enabled');
    for (const [name, value] of Object.entries({ DB_HOST: expected.host, DB_PORT: expected.port, DB_NAME: expected.database, DB_USER: expected.user })) {
        if (process.env[name] !== value) throw new Error(`Lista 02 database target guard failed for ${name}`);
    }
    if (!process.env.DB_PASSWORD) throw new Error('Lista 02 synthetic DB password missing');
    const client = new Client({
        host: expected.host,
        port: Number(expected.port),
        database: expected.database,
        user: expected.user,
        password: process.env.DB_PASSWORD,
        connectionTimeoutMillis: 3000,
    });
    try {
        await client.connect();
        const { rows } = await client.query<{ name: string; role: string; version: string; system_id: string; pg_version: string }>(`
            SELECT current_database() name, current_user role,
              (SELECT version FROM app.version WHERE id=1) version,
              (SELECT system_identifier::text FROM pg_control_system()) system_id,
              current_setting('server_version_num') pg_version
        `);
        const row = rows[0];
        if (row.name !== expected.database || row.role !== expected.user || row.version !== '1.76.0' || row.system_id !== expected.systemId || !/^17\d{4}$/.test(row.pg_version)) {
            throw new Error('Lista 02 database identity/schema guard failed');
        }
        const schema = await client.query<{ task_key: string | null; epic_key: string | null; sequence: string | null; trigger_count: string }>(`
            SELECT (SELECT column_name FROM information_schema.columns WHERE table_schema='tasks' AND table_name='tasks' AND column_name='issue_key') task_key,
                   (SELECT column_name FROM information_schema.columns WHERE table_schema='tasks' AND table_name='scrum_epics' AND column_name='issue_key') epic_key,
                   to_regclass('tasks.scrum_issue_sequences')::text sequence,
                   (SELECT count(*)::text FROM pg_trigger WHERE tgrelid IN ('tasks.tasks'::regclass,'tasks.scrum_epics'::regclass) AND tgname IN ('assign_tasks_scrum_issue_key','assign_epics_scrum_issue_key')) trigger_count
        `);
        if (!schema.rows[0]?.task_key || !schema.rows[0]?.epic_key || !schema.rows[0]?.sequence || schema.rows[0].trigger_count !== '2') {
            throw new Error('Lista 02 schema feature guard failed');
        }
        process.stdout.write('Lista 02 PostgreSQL guard PASS: isolated synthetic database and schema 1.76.0.\n');
    } finally {
        await client.end();
    }
}
