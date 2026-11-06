import { Hono } from 'hono';

/** GET /api/health : tells you which secrets actually reached the app. Check this after every deploy. */
export function healthRoutes({ config, openai, resend }) {
    const app = new Hono();

    app.get('/', (c) => c.json({
        ok:         true,
        model:      config.model,
        openrouter: openai ? 'configured' : 'missing',
        resend:     resend ? 'configured' : 'missing',
        time:       new Date().toISOString(),
    }));

    return app;
}
