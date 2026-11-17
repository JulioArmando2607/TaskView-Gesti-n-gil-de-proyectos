import { defineConfig } from 'vitest/config';
import { SCRATCH, scratchCredentials } from './vitest.lista01.pg.guard';

const groups: Record<string, string[]> = {
    auth_model: ['src/tv-modules/auth/__tests__/AuthModel.spec.ts'],
    auth_session: ['src/tv-modules/auth/__tests__/JwtStorage.spec.ts'],
    realtime_repo: ['src/tv-modules/realtime/__tests__/RealtimeRepository.integration.spec.ts'],
    task_assignment: ['src/tv-modules/tasks/__tests__/TaskMassAssignment.integration.spec.ts'],
    task_move: ['src/tv-modules/tasks/__tests__/TaskMove.integration.spec.ts'],
    token_scope: ['src/tv-modules/organizations/__tests__/TokenScope.integration.spec.ts'],
    automation: ['src/tv-modules/automations/__tests__/Automations.integration.spec.ts'],
    auth_http: ['src/tv-modules/auth/__tests__/Auth.spec.ts'],
    auth_provider: ['src/tv-modules/auth/__tests__/LoginByProvider.spec.ts'],
    integrations_permissions: ['src/tv-modules/integrations/__tests__/IntegrationsPermissions.integration.spec.ts'],
    integrations_sync: ['src/tv-modules/integrations/__tests__/IntegrationsSync.integration.spec.ts'],
    integrations_webhooks: ['src/tv-modules/integrations/__tests__/IntegrationsWebhooks.integration.spec.ts'],
    integrations_oauth: ['src/tv-modules/integrations/__tests__/IntegrationsOAuth.integration.spec.ts'],
    oauth_dcr_disabled: ['src/tv-modules/oauth/__tests__/OAuthDcrDisabled.integration.spec.ts'],
    invoices: ['src/tv-modules/invoices/__tests__/Invoices.integration.spec.ts'],
    sso_metadata: ['src/tv-modules/sso/__tests__/SsoMetadataSync.integration.spec.ts'],
    sso_scim: ['src/tv-modules/sso/__tests__/SsoSignInScim.integration.spec.ts'],
    oauth: ['src/tv-modules/oauth/__tests__/OAuth.integration.spec.ts'],
    scim_email: ['src/tv-modules/scim/__tests__/ScimEmailChange.integration.spec.ts'],
    files_local: ['src/tv-modules/files/__tests__/Files.integration.spec.ts'],
    files_quota: ['src/tv-modules/files/__tests__/FilesQuota.integration.spec.ts'],
    import: ['src/tv-modules/import/__tests__/Import.integration.spec.ts'],
    webhooks_files: ['src/tv-modules/webhooks/__tests__/WebhooksFiles.integration.spec.ts'],
};

const group = process.env.L01_PG_GROUP;
if (!group || !groups[group]) throw new Error('Set L01_PG_GROUP to one reviewed PostgreSQL test group');
const { password } = scratchCredentials();

export default defineConfig({
    test: {
        include: groups[group],
        testNamePattern: group === 'files_local' ? 'with the local provider' : undefined,
        globalSetup: './vitest.lista01.pg.guard.ts',
        fileParallelism: false,
        maxWorkers: 1,
        testTimeout: 30000,
        hookTimeout: 30000,
        env: {
            NODE_ENV: 'test',
            L01_TEST_DB_ONLY: '1',
            DB_HOST: SCRATCH.host,
            DB_PORT: String(SCRATCH.port),
            DB_NAME: SCRATCH.database,
            DB_USER: SCRATCH.user,
            DB_PASSWORD: password,
            APP_PORT: '0',
            APP_URL: 'http://127.0.0.1:1',
            JWT_SIGN: 'lista01-synthetic-signing-key-only',
            ACCESS_LIFE_TIME: '5m',
            REFRESH_LIFE_TIME: '3s',
            JWT_ALG: 'HS256',
            ENCRYPTION_KEY: 'ab'.repeat(32),
            FILE_STORAGE_PROVIDER: 'local',
            FILE_STORAGE_LOCAL_DIR: './.test-data/lista01-pg-files',
            FILE_MAX_SIZE_MB: '1',
            INVITE_EMAIL_ENABLED: 'false',
        },
    },
});
