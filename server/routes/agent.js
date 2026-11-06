import { Hono }      from 'hono';
import { streamSSE } from 'hono/streaming';
import { isRateLimited } from '../utils/rateLimit.js';
import { getClientIp }   from '../utils/clientIp.js';
import { readJson }      from '../utils/json.js';
import { SYSTEM_PROMPT } from '../prompts/portfolio-agent.js';

const MAX_MESSAGES   = 20;       // the browser keeps at most 13
const MAX_CONTENT    = 2000;     // characters per message
const ABORT_AFTER_MS = 30_000;   // stop waiting for the model (the Lambda request timeout is 60 s)

/**
 * Keeps only what the model should see from the browser: user and assistant turns,
 * as plain text, in bounded size. This stops a visitor from sending their own "system"
 * message or a huge payload (which would cost money).
 */
export function cleanMessages(messages) {
    return messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT) }));
}

/** POST /api/agent : streams the model's answer back to the browser as server-sent events (SSE). */
export function agentRoutes({ config, openai }) {
    const app = new Hono();

    app.post('/', async (c) => {
        if (isRateLimited(getClientIp(c), 5, 'agent')) {
            return c.json({ error: 'Rate limited. Please wait before sending more messages.' }, 429);
        }
        if (!openai) return c.json({ error: 'Agent is not configured yet.' }, 500);

        const body = await readJson(c);
        if (!body || !Array.isArray(body.messages)) {
            return c.json({ error: 'messages array required' }, 400);
        }
        const messages = cleanMessages(body.messages);
        if (messages.length === 0) return c.json({ error: 'No valid messages.' }, 400);

        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), ABORT_AFTER_MS);

        return streamSSE(c, async (stream) => {
            try {
                const aiStream = await openai.chat.completions.create({
                    model:       config.model,
                    messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
                    stream:      true,
                    max_tokens:  400,
                    temperature: 0.65,
                }, { signal: abort.signal });

                // Forward each token as soon as it arrives. The browser prints it immediately.
                for await (const chunk of aiStream) {
                    const token = chunk.choices[0]?.delta?.content;
                    if (token) await stream.writeSSE({ data: JSON.stringify({ token }) });
                }
                await stream.writeSSE({ data: '[DONE]' });

            } catch (err) {
                console.error('[agent] error:', err.message);
                await stream.writeSSE({ data: JSON.stringify({ error: err.message }) });
            } finally {
                clearTimeout(timer);
            }
        });
    });

    return app;
}
