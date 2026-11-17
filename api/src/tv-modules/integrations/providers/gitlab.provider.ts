import axios from 'axios';

const configuredBaseUrl = process.env.GITLAB_BASE_URL || 'https://gitlab.com';
const parsedBaseUrl = new URL(configuredBaseUrl);
const allowedHosts = (process.env.GITLAB_ALLOWED_HOSTS || 'gitlab.com')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

if (
    parsedBaseUrl.protocol !== 'https:' ||
    parsedBaseUrl.username ||
    parsedBaseUrl.password ||
    parsedBaseUrl.pathname !== '/' ||
    parsedBaseUrl.search ||
    parsedBaseUrl.hash ||
    !allowedHosts.includes(parsedBaseUrl.hostname.toLowerCase())
) {
    throw new Error('Invalid GitLab base URL: HTTPS and an explicitly allowed host are required');
}

export const GITLAB_BASE_URL = parsedBaseUrl.toString().replace(/\/$/, '');
export const GITLAB_API_URL = process.env.GITLAB_API_URL || `${GITLAB_BASE_URL}/api/v4`;
const parsedApiUrl = new URL(GITLAB_API_URL);
if (parsedApiUrl.protocol !== 'https:' || parsedApiUrl.hostname.toLowerCase() !== parsedBaseUrl.hostname.toLowerCase()) {
    throw new Error('Invalid GitLab API URL: it must use HTTPS and the configured GitLab host');
}
const GITLAB_OAUTH_URL = `${GITLAB_BASE_URL}/oauth/authorize`;
const GITLAB_TOKEN_URL = `${GITLAB_BASE_URL}/oauth/token`;
export const GITLAB_READ_ONLY = process.env.GITLAB_READ_ONLY === 'true';

export type GitLabRepo = {
    id: number;
    path_with_namespace: string;
    name: string;
    visibility: 'private' | 'internal' | 'public';
    description: string | null;
    web_url: string;
};

export type GitLabIssue = {
    iid: number;
    title: string;
    description: string | null;
    state: 'opened' | 'closed';
    web_url: string;
};

export function getGitLabOAuthUrl(state: string): string {
    const clientId = process.env.GITLAB_INTEGRATION_CLIENT_ID;
    const redirectUri = process.env.GITLAB_INTEGRATION_CALLBACK_URL;
    if (!clientId || !redirectUri) {
        throw new Error('GitLab integration OAuth is not configured');
    }
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GITLAB_READ_ONLY ? 'read_api' : 'api',
        state,
    });
    return `${GITLAB_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeGitLabCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await axios.post<{ access_token: string; refresh_token: string; token_type: string }>(
        GITLAB_TOKEN_URL,
        {
            client_id: process.env.GITLAB_INTEGRATION_CLIENT_ID,
            client_secret: process.env.GITLAB_INTEGRATION_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.GITLAB_INTEGRATION_CALLBACK_URL,
        },
    );
    if (!res.data.access_token) {
        throw new Error('Failed to exchange GitLab code for token');
    }
    return {
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token,
    };
}

export async function refreshGitLabToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await axios.post<{ access_token: string; refresh_token: string; token_type: string }>(
        GITLAB_TOKEN_URL,
        {
            client_id: process.env.GITLAB_INTEGRATION_CLIENT_ID,
            client_secret: process.env.GITLAB_INTEGRATION_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            redirect_uri: process.env.GITLAB_INTEGRATION_CALLBACK_URL,
        },
    );
    if (!res.data.access_token) {
        throw new Error('Failed to refresh GitLab token');
    }
    return {
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token,
    };
}

export async function fetchGitLabRepos(accessToken: string): Promise<GitLabRepo[]> {
    const repos: GitLabRepo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const res = await axios.get<GitLabRepo[]>(`${GITLAB_API_URL}/projects`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                membership: true,
                per_page: perPage,
                page,
                order_by: 'updated_at',
                sort: 'desc',
            },
        });
        repos.push(...res.data);
        if (res.data.length < perPage) break;
        page++;
    }

    return repos;
}

export async function fetchGitLabIssues(accessToken: string, projectId: number, updatedAfter?: string): Promise<GitLabIssue[]> {
    const issues: GitLabIssue[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const res = await axios.get<GitLabIssue[]>(`${GITLAB_API_URL}/projects/${projectId}/issues`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                state: 'all',
                per_page: perPage,
                page,
                order_by: updatedAfter ? 'updated_at' : 'created_at',
                sort: 'desc',
                ...(updatedAfter ? { updated_after: updatedAfter } : {}),
            },
        });
        issues.push(...res.data);
        if (res.data.length < perPage) break;
        page++;
    }

    return issues;
}

export async function createGitLabWebhook(
    accessToken: string,
    projectId: number,
    webhookUrl: string,
    secret: string,
): Promise<{ id: number }> {
    if (GITLAB_READ_ONLY) throw new Error('GitLab integration is configured as read-only');
    const res = await axios.post<{ id: number }>(
        `${GITLAB_API_URL}/projects/${projectId}/hooks`,
        {
            url: webhookUrl,
            issues_events: true,
            token: secret,
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    );
    return { id: res.data.id };
}

export function verifyGitLabWebhookToken(headerToken: string, secret: string): boolean {
    return headerToken === secret;
}

export async function updateGitLabIssueState(
    accessToken: string,
    projectId: number,
    issueIid: number,
    stateEvent: 'close' | 'reopen',
): Promise<void> {
    if (GITLAB_READ_ONLY) throw new Error('GitLab integration is configured as read-only');
    await axios.put(
        `${GITLAB_API_URL}/projects/${projectId}/issues/${issueIid}`,
        { state_event: stateEvent },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    );
}
