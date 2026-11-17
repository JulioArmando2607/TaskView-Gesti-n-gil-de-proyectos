import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/tv-modules/scrum/__tests__/Scrum.integration.spec.ts'],
        globalSetup: './vitest.lista02.pg.guard.ts',
        fileParallelism: false,
        maxWorkers: 1,
        testTimeout: 30000,
        hookTimeout: 30000,
        env: {
            NODE_ENV: 'test',
            L02_PG_TEST_ONLY: '1',
            APP_PORT: '0',
            APP_URL: 'http://127.0.0.1:1',
            JWT_SIGN: 'lista02-synthetic-signing-key-only',
            ACCESS_LIFE_TIME: '5m',
            REFRESH_LIFE_TIME: '3s',
            JWT_ALG: 'HS256',
            ENCRYPTION_KEY: 'cd'.repeat(32),
            FILE_STORAGE_PROVIDER: 'local',
            FILE_STORAGE_LOCAL_DIR: './.test-data/lista02-pg-files',
            FILE_MAX_SIZE_MB: '1',
            INVITE_EMAIL_ENABLED: 'false',
        },
    },
});
