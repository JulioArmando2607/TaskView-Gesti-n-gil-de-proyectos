import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe('Lista 10 GitLab provider safety', () => {
    it('requires an explicitly allowed HTTPS host and uses read_api in read-only mode', async () => {
        process.env.GITLAB_BASE_URL = 'https://repositorio.fovipol.gob.pe';
        process.env.GITLAB_ALLOWED_HOSTS = 'repositorio.fovipol.gob.pe';
        process.env.GITLAB_READ_ONLY = 'true';
        process.env.GITLAB_INTEGRATION_CLIENT_ID = 'synthetic-client';
        process.env.GITLAB_INTEGRATION_CALLBACK_URL = 'https://taskview.invalid/callback';

        const provider = await import('../providers/gitlab.provider');
        const state = provider.getGitLabOAuthUrl('synthetic-state');
        const url = new URL(state);

        expect(url.origin).toBe('https://repositorio.fovipol.gob.pe');
        expect(url.searchParams.get('scope')).toBe('read_api');
    });

    it('fails closed for a host that is not explicitly allowed', async () => {
        process.env.GITLAB_BASE_URL = 'https://internal.example.invalid';
        process.env.GITLAB_ALLOWED_HOSTS = 'repositorio.fovipol.gob.pe';

        await expect(import('../providers/gitlab.provider')).rejects.toThrow('explicitly allowed host');
    });

    it('rejects GitLab write operations when read-only mode is enabled', async () => {
        process.env.GITLAB_BASE_URL = 'https://repositorio.fovipol.gob.pe';
        process.env.GITLAB_ALLOWED_HOSTS = 'repositorio.fovipol.gob.pe';
        process.env.GITLAB_READ_ONLY = 'true';

        const provider = await import('../providers/gitlab.provider');
        await expect(provider.createGitLabWebhook('synthetic', 1, 'https://taskview.invalid/hook', 'secret'))
            .rejects.toThrow('read-only');
        await expect(provider.updateGitLabIssueState('synthetic', 1, 1, 'close'))
            .rejects.toThrow('read-only');
    });
});
