import { Client } from 'pg';
import legacySetup from './src/api/__tests__/setup-db';

export default async function setup() {
    const expected = {
        DB_HOST: '127.0.0.1',
        DB_PORT: '25432',
        DB_NAME: 'taskview_l01_scratch_20261114',
        DB_USER: 'taskview_l01_scratch',
        TASKVIEW_TEST_URL: 'http://127.0.0.1:21401',
        L01_TEST_DB_ONLY: '1',
    };
    for (const [name, value] of Object.entries(expected)) {
        if (process.env[name] !== value) throw new Error(`SDK scratch guard: ${name} mismatch`);
    }
    const password = process.env.L01_TEST_DB_PASSWORD;
    const systemId = process.env.L01_TEST_DB_SYSTEM_ID;
    if (!password || !systemId) throw new Error('SDK scratch guard: credentials or cluster ID missing');
    const client = new Client({
        host: expected.DB_HOST, port: Number(expected.DB_PORT),
        database: expected.DB_NAME, user: expected.DB_USER, password,
        connectionTimeoutMillis: 3000,
    });
    try {
        await client.connect();
        const { rows } = await client.query(`SELECT current_database() AS db, current_user AS role,
          (SELECT system_identifier::text FROM pg_control_system()) AS system_id,
          (SELECT version FROM app.version WHERE id=1) AS version`);
        const row = rows[0];
        if (row.db !== expected.DB_NAME || row.role !== expected.DB_USER || row.system_id !== systemId || row.version !== '1.74.0') {
            throw new Error('SDK scratch guard: database identity or schema mismatch');
        }
        process.stdout.write(`SDK scratch guard PASS: ${row.db}, schema ${row.version}, cluster ${row.system_id}\n`);
    } finally {
        await client.end();
    }
    return legacySetup();
}
