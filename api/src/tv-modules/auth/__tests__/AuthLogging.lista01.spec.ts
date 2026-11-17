import { Writable } from 'node:stream';
import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_LOG_REDACTION } from '../../../modules/log-redaction';
import { Email } from '../../../core/Email';
import AuthModel from '../AuthModel';

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    sendAsync: vi.fn(),
}));

vi.mock('../../../modules/db', () => ({
    Database: { getInstance: () => ({ query: mocks.query }) },
}));
vi.mock('../../../modules/logget', () => ({
    $logger: { info: mocks.info, debug: mocks.debug, error: mocks.error },
}));
vi.mock('emailjs', () => ({
    SMTPClient: vi.fn().mockImplementation(() => ({ sendAsync: mocks.sendAsync })),
}));

// Test-only markers are deliberately never written to the test output.
const markers = {
    login: 'synthetic-login-marker-L01',
    password: 'synthetic-password-marker-L01',
    code: 'synthetic-code-marker-L01',
    token: 'synthetic-token-marker-L01',
};

function capturedLogs() {
    return JSON.stringify([
        ...mocks.info.mock.calls,
        ...mocks.debug.mock.calls,
        ...mocks.error.mock.calls,
    ]);
}

function expectSafeLogs() {
    const output = capturedLogs();
    for (const marker of Object.values(markers)) expect(output.includes(marker)).toBe(false);
    expect(output.includes('rows')).toBe(false);
}

describe('Lista 01 authentication logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps the login result while logging only an allowlisted outcome', async () => {
        const user = {
            id: 7,
            login: markers.login,
            password: markers.password,
            confirm_email_code: markers.code,
            remember_token: markers.token,
        };
        mocks.query.mockResolvedValue({ rows: [user], rowCount: 1 });
        const result = await new AuthModel().getUserByLogin(markers.login);
        expect(result && result.id).toBe(7);
        expect(mocks.debug).toHaveBeenCalledWith({ field: 'login', found: true }, 'Auth lookup completed');
        expectSafeLogs();
    });

    it('preserves invalid-login behavior and a safe diagnostic', async () => {
        mocks.query.mockResolvedValue({ rows: [], rowCount: 0 });
        expect(await new AuthModel().getUserByLogin(markers.login)).toBe(false);
        expect(mocks.debug).toHaveBeenCalledWith({ field: 'login', found: false }, 'Auth lookup completed');
        expectSafeLogs();
    });

    it('does not serialize a secret-bearing database exception', async () => {
        mocks.query.mockRejectedValue(new Error(`database detail ${markers.password} ${markers.code}`));
        expect(await new AuthModel().getUserByLogin(markers.login)).toBe(false);
        expect(mocks.error).toHaveBeenCalledWith({ operation: 'getUserByLogin' }, 'Auth lookup failed');
        expectSafeLogs();
    });

    it('does not log confirmation or recovery codes on database errors', async () => {
        mocks.query.mockRejectedValue(new Error(`database detail ${markers.code}`));
        const model = new AuthModel();
        expect(await model.confirmEmail(markers.login, markers.code, 0)).toBe(false);
        expect(await model.setReminderCodeAndTime(markers.login, markers.code, 123)).toBe(false);
        expect(mocks.error).toHaveBeenCalledWith({ operation: 'confirmEmail' }, 'Auth database operation failed');
        expect(mocks.error).toHaveBeenCalledWith({ operation: 'setReminderCodeAndTime' }, 'Auth database operation failed');
        expectSafeLogs();
    });

    it('keeps an operational delivery error without serializing a mail exception', async () => {
        vi.stubEnv('SMTP_HOST', 'synthetic-mail-host');
        try {
            mocks.sendAsync.mockRejectedValue(new Error(`mail detail ${markers.code} ${markers.token}`));
            expect(await Email.send({ from: 'synthetic@taskview-l01.invalid', to: 'synthetic@taskview-l01.invalid', subject: 'Synthetic', text: 'Synthetic' })).toBe(false);
            expect(mocks.error).toHaveBeenCalledWith({ operation: 'sendEmail' }, 'Email delivery failed');
            expectSafeLogs();
        } finally {
            vi.unstubAllEnvs();
        }
    });

    it('redacts structured secret fields with the installed Pino API', () => {
        const lines: string[] = [];
        const destination = new Writable({
            write(chunk, _encoding, done) {
                lines.push(chunk.toString());
                done();
            },
        });
        const logger = pino({ level: 'info', redact: AUTH_LOG_REDACTION }, destination);
        logger.info({
            password: markers.password,
            code: markers.code,
            headers: { authorization: markers.token },
            operation: 'synthetic-redaction-check',
        }, 'Auth operation completed');
        const output = lines.join('');
        expect(output).toContain('synthetic-redaction-check');
        expect(output).toContain('[REDACTED]');
        for (const marker of Object.values(markers).filter((value) => value !== markers.login)) {
            expect(output.includes(marker)).toBe(false);
        }
    });
});
