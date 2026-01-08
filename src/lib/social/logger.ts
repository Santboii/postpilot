

export type LogPlatform = 'bluesky' | 'linkedin' | 'twitter' | 'facebook' | 'pinterest' | 'tiktok' | 'instagram' | 'system';

export interface LogContext {
    platform: LogPlatform;
    action: string;
    postId?: string;
    userId?: string;
    requestId?: string;
    [key: string]: unknown;
}

export class SocialLogger {
    private static SENSITIVE_KEYS = new Set([
        'token',
        'access_token',
        'refresh_token',
        'secret',
        'key',
        'password',
        'authorization',
        'dpop',
        'cookie',
        'privateKey',
        'publicKey'
    ]);

    /**
     * Recursively redacts sensitive information from objects
     */
    private static redact(data: unknown): unknown {
        if (!data) return data;
        if (typeof data !== 'object') return data;

        if (Array.isArray(data)) {
            return data.map(item => this.redact(item));
        }

        const redacted: Record<string, unknown> = {};
        const dataObj = data as Record<string, unknown>;

        for (const [key, value] of Object.entries(dataObj)) {
            // Check if key is sensitive (case-insensitive partial match for safety)
            const lowerKey = key.toLowerCase();
            const isSensitive = Array.from(this.SENSITIVE_KEYS).some(k => lowerKey.includes(k.toLowerCase()));

            if (isSensitive && value) {
                redacted[key] = '[REDACTED]';
            } else if (typeof value === 'object') {
                redacted[key] = this.redact(value);
            } else {
                redacted[key] = value;
            }
        }
        return redacted;
    }

    private static log(level: 'info' | 'warn' | 'error', context: LogContext, message: string, data?: unknown) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: {
                ...context,
                requestId: context.requestId || globalThis.crypto.randomUUID(),
            },
            data: data ? this.redact(data) : undefined,
        };

        // In development, pretty print. In production, single-line JSON.
        if (process.env.NODE_ENV === 'development') {
            console[level](JSON.stringify(entry, null, 2));
        } else {
            console[level](JSON.stringify(entry));
        }
    }

    static info(context: LogContext, message: string, data?: unknown) {
        this.log('info', context, message, data);
    }

    static warn(context: LogContext, message: string, data?: unknown) {
        this.log('warn', context, message, data);
    }

    static error(context: LogContext, message: string, error?: unknown) {
        // Handle Error objects specifically to extract stack traces
        const errorData = error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            cause: error.cause
        } : error;

        this.log('error', context, message, errorData);
    }
}
