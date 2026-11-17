import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/tv-modules/auth/__tests__/AuthLogging.lista01.spec.ts'],
        env: {
            NODE_ENV: 'test',
            DB_HOST: '127.0.0.1',
            DB_PORT: '1',
            DB_NAME: 'taskview_l01_unreachable',
            DB_USER: 'taskview_l01_test',
            DB_PASSWORD: 'synthetic-unreachable',
        },
    },
});
