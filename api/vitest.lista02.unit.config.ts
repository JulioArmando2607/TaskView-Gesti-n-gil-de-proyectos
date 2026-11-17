import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: [
            'src/core/__tests__/GoalPermissionsFetcher.lista02.spec.ts',
            'src/tv-modules/tasks/__tests__/TaskMovePlanner.spec.ts',
            'src/tv-modules/tasks/__tests__/TasksMassAssignment.spec.ts',
            'src/tv-modules/kanban/__tests__/KanbanOrder.lista01.spec.ts',
        ],
        env: {
            NODE_ENV: 'test',
            DB_HOST: '127.0.0.1',
            DB_PORT: '1',
            DB_NAME: 'taskview_l02_unreachable',
            DB_USER: 'taskview_l02_synthetic',
            DB_PASSWORD: 'synthetic-unreachable',
            APP_PORT: '0',
            APP_URL: 'http://127.0.0.1:1',
            JWT_SIGN: 'lista02-unit-only-synthetic-signing-key',
            ACCESS_LIFE_TIME: '5m',
            REFRESH_LIFE_TIME: '5m',
            JWT_ALG: 'HS256',
            ENCRYPTION_KEY: 'ef'.repeat(32),
            FILE_STORAGE_PROVIDER: 'local',
            FILE_STORAGE_LOCAL_DIR: './.test-data/lista02-unit-files',
            FILE_MAX_SIZE_MB: '1',
        },
    },
});
