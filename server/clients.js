import OpenAI     from 'openai';
import { Resend } from 'resend';

/**
 * Creates the third-party API clients.
 * A client is null when its key is missing, so the server still starts and binds its port.
 * (A server that crashes at startup is much harder to debug on Lambda than one that
 * answers /api/health with "missing".)
 */
export function createClients(config) {
    const openai = config.openrouterKey
        ? new OpenAI({
            apiKey:         config.openrouterKey,
            baseURL:        'https://openrouter.ai/api/v1',     // OpenRouter speaks the OpenAI API
            defaultHeaders: { 'HTTP-Referer': config.siteUrl, 'X-Title': 'hc_system' },
        })
        : null;

    const resend = config.resendKey ? new Resend(config.resendKey) : null;

    return { openai, resend };
}
