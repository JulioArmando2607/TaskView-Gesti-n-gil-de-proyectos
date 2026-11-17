// Defense in depth for structured log fields. Callers must still avoid logging
// complete authentication objects or secret-bearing error messages.
export const AUTH_LOG_REDACTION = {
    paths: [
        'password', 'passwordHash', 'code', 'token', 'access', 'refresh', 'refreshToken',
        'authorization', 'cookie', 'headers.authorization', 'headers.Authorization', 'headers.cookie',
        'req.headers.authorization', 'req.headers.cookie',
        'err.config.headers.Authorization', 'err.config.headers.authorization', 'err.config.data',
    ],
    censor: '[REDACTED]',
};
