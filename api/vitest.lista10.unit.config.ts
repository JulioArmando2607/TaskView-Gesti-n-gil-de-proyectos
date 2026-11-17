import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/tv-modules/integrations/__tests__/gitlab.provider.lista10.spec.ts'],
        fileParallelism: false,
        maxWorkers: 1,
    },
});
