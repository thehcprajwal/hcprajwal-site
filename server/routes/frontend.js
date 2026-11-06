import { serveStatic }   from '@hono/node-server/serve-static';
import { relative }      from 'node:path';
import { fileURLToPath } from 'node:url';

// serveStatic wants a path relative to the working directory, so convert the absolute dist/ path.
const DIST = relative(process.cwd(), fileURLToPath(new URL('../../dist', import.meta.url))) || '.';

const HTML_CACHE   = 'public, max-age=300';                      // 5 min: CloudFront can answer without waking Lambda
const ASSET_CACHE  = 'public, max-age=31536000, immutable';      // Vite adds a hash to asset file names

/** Serves the built website (dist/) and falls back to index.html for unknown paths. */
export function mountFrontend(app) {
    app.use('*', async (c, next) => {
        await next();
        const isHtml = (c.res.headers.get('Content-Type') || '').startsWith('text/html');
        if (c.res.ok && isHtml && !c.res.headers.has('Cache-Control')) {
            c.res.headers.set('Cache-Control', HTML_CACHE);
        }
    });

    app.use('/assets/*', async (c, next) => {
        await next();
        if (c.res.ok) c.res.headers.set('Cache-Control', ASSET_CACHE);
    });

    app.use('*', serveStatic({ root: DIST }));
    app.get('*', serveStatic({ path: `${DIST}/index.html` }));    // single-page-app fallback
}
