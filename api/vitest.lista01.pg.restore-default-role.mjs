// Restore only the current default-role function on the verified Lista 01 scratch database.
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const expected = {
    host: '127.0.0.1', port: 25432,
    database: 'taskview_l01_scratch_20261114', user: 'taskview_l01_scratch',
};
for (const [key, value] of Object.entries({
    DB_HOST: expected.host, DB_PORT: String(expected.port),
    DB_NAME: expected.database, DB_USER: expected.user,
})) {
    if (process.env[key] !== value) throw new Error(`Scratch restore guard: ${key} mismatch`);
}
const envPath = process.env.L01_TEST_DB_ENV_FILE;
if (!envPath) throw new Error('Scratch restore guard: private env path missing');
const values = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
    const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)];
}));
if (!values.L01_TEST_DB_PASSWORD || !values.L01_TEST_DB_SYSTEM_ID) {
    throw new Error('Scratch restore guard: credentials or cluster ID missing');
}
const source = readFileSync(new URL('./src/migrations/taskview/sql/1.73.0/all-triggers.sql', import.meta.url), 'utf8');
const match = source.match(/CREATE OR REPLACE FUNCTION tasks\.add_roles_and_permissions\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/);
if (!match || (match[0].match(/'timetracking_can_log'/g) ?? []).length !== 2) {
    throw new Error('Current migration function not found or unexpected');
}
const client = new Client({ ...expected, password: values.L01_TEST_DB_PASSWORD, connectionTimeoutMillis: 3000 });
try {
    await client.connect();
    await client.query('BEGIN');
    const result = await client.query(`SELECT current_database() AS db, current_user AS role,
      (SELECT system_identifier::text FROM pg_control_system()) AS system_id,
      (SELECT version FROM app.version WHERE id=1) AS version`);
    const row = result.rows[0];
    if (row.db !== expected.database || row.role !== expected.user ||
        row.system_id !== values.L01_TEST_DB_SYSTEM_ID || row.version !== '1.74.0') {
        throw new Error('Scratch restore guard: database identity mismatch');
    }
    await client.query(match[0]);
    const check = await client.query(`SELECT pg_get_functiondef('tasks.add_roles_and_permissions()'::regprocedure) AS body`);
    if ((check.rows[0].body.match(/'timetracking_can_log'/g) ?? []).length !== 2) {
        throw new Error('Scratch restore: function did not contain both grants');
    }
    await client.query('COMMIT');
    process.stdout.write(`Restored current default-role function on ${row.db}, schema ${row.version}, cluster ${row.system_id}\n`);
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
} finally {
    await client.end();
}
