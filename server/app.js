import { Hono }          from 'hono';
import { logger }        from 'hono/logger';
import { compress }      from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';

import { healthRoutes }  from './routes/health.js';
import { contactRoutes } from './routes/contact.js';
import { agentRoutes }   from './routes/agent.js';
import { mountFrontend } from './routes/frontend.js';

/** Builds the whole web app: middleware, the three API routes, then the static website. */
export function createApp({ config, openai, resend }) {
    const app = new Hono();

    app.use(logger());

    // Lambda does not add these headers for us (Caddy used to on EC2).
    app.use(secureHeaders({
        strictTransportSecurity: 'max-age=31536000; includeSubDomains',
        xFrameOptions:           'DENY',
        referrerPolicy:          'strict-origin-when-cross-origin',
    }));

    // Lambda does not compress responses either. The chat stream is skipped so tokens are not buffered.
    app.use('*', (c, next) => c.req.path === '/api/agent' ? next() : compress()(c, next));

    app.route('/api/health',  healthRoutes({ config, openai, resend }));
    app.route('/api/contact', contactRoutes({ config, resend }));
    app.route('/api/agent',   agentRoutes({ config, openai }));
    app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

    mountFrontend(app);

    app.onError((err, c) => {
        console.error('[error]', err);
        return c.json({ error: 'Internal server error' }, 500);
    });

    return app;
}
