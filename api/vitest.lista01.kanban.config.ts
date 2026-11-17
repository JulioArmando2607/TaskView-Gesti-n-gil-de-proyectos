import { defineConfig } from 'vitest/config';

// Focused Lista 01 regression: in-memory synthetic Kanban repository only.
export default defineConfig({
    test: {
        include: ['src/tv-modules/kanban/__tests__/KanbanOrder.lista01.spec.ts'],
        env: {
            NODE_ENV: 'test',
            DB_HOST: '127.0.0.1',
            DB_PORT: '1',
            DB_NAME: 'taskview_l01_unreachable',
            DB_USER: 'taskview_l01_unreachable',
            DB_PASSWORD: 'synthetic-unreachable',
        },
    },
});
