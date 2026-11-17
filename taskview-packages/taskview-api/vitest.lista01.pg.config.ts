import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const groups: Record<string, string[]> = {
    sprints: ['src/api/__tests__/sprints.test.ts'],
    tasks: ['src/api/__tests__/tasks.test.ts'],
    permissions: ['src/api/__tests__/permissions.test.ts'],
    tasks_access: ['src/api/__tests__/tasks-access.test.ts'],
    tasks_visibility: ['src/api/__tests__/tasks-complete-visibility.test.ts'],
    sprints_security: ['src/api/__tests__/sprints-security.test.ts'],
    kanban: ['src/api/__tests__/kanban.test.ts'],
    collaboration: ['src/api/__tests__/collaboration.test.ts'],
    goals: ['src/api/__tests__/goals.test.ts'],
    time_tracking: ['src/api/__tests__/time-tracking.test.ts'],
    organizations: ['src/api/__tests__/organizations.test.ts'],
};
for (const name of [
    'analytics.access', 'api-tokens', 'automations.access', 'automations',
    'billing-invoices', 'collaboration-goal-access', 'collaboration-roles.access',
    'collaboration-roles-token-scope', 'default-roles', 'goals-list',
    'graph', 'graph-access', 'guard-param-confusion', 'kanban.access',
    'kanban-columns-order', 'notifications', 'recurrence',
    'recurrence-after-completion', 'sessions', 'scim', 'scim-group-projects',
    'start', 'start-calendar', 'start-dashboard', 'start-shared-projects',
    'start-token-scope', 'tags', 'tasks-cross-goal', 'token-scope-organization',
    'ui-preferences',
    'integrations-access',
]) {
    groups[name] = [`src/api/__tests__/${name}.test.ts`];
}
const group = process.env.L01_SDK_PG_GROUP;
if (!group || !groups[group]) throw new Error('Set L01_SDK_PG_GROUP to one reviewed SDK test group');

export default defineConfig({
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
    test: {
        include: groups[group],
        globalSetup: './vitest.lista01.pg.setup.ts',
        fileParallelism: false,
        maxWorkers: 1,
        testTimeout: 30000,
        hookTimeout: 30000,
    },
});
