import { Hono }          from 'hono';
import { isRateLimited } from '../utils/rateLimit.js';
import { getClientIP }   from './track.js';

const app   = new Hono();
const OWNER = process.env.GITHUB_OWNER       || 'prajwalhc';
const REPO  = process.env.GITHUB_RESUME_REPO || 'resume';

function ghHeaders(accept) {
    const h = {
        'Accept':               accept || 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
    if (process.env.GITHUB_TOKEN) h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    return h;
}

// 1-hour cache for GitHub releases list
let releaseCache = { data: null, expiry: 0 };

app.get('/assets', async (c) => {
    const ip = getClientIP(c);
    if (isRateLimited(ip, 10, 'resume')) {
        return c.json({ error: 'Too many requests.' }, 429);
    }

    if (Date.now() < releaseCache.expiry) {
        return c.json(releaseCache.data);
    }

    try {
        const r = await fetch(
            `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
            { headers: ghHeaders() }
        );

        if (r.status === 404) return c.json({ error: 'No releases found.' }, 404);
        if (!r.ok)            return c.json({ error: `GitHub API error ${r.status}` }, r.status);

        const release = await r.json();
        const assets  = release.assets
            .filter(a => a.name.endsWith('.pdf'))
            .map(a => ({ id: a.id, name: a.name, size: a.size }));

        const payload = { ok: true, tag: release.tag_name, assets };
        releaseCache  = { data: payload, expiry: Date.now() + 3_600_000 };

        return c.json(payload);

    } catch (err) {
        console.error('[resume] assets error:', err.message);
        return c.json({ error: 'Could not reach GitHub API.' }, 502);
    }
});

app.get('/download/:assetId', async (c) => {
    const assetId = parseInt(c.req.param('assetId'), 10);
    if (!assetId || assetId < 1) return c.json({ error: 'Invalid asset ID.' }, 400);

    try {
        const r = await fetch(
            `https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${assetId}`,
            { headers: ghHeaders('application/octet-stream') }
        );

        if (!r.ok) return c.json({ error: `Asset not found (${r.status}).` }, r.status);

        const disposition = r.headers.get('content-disposition') || '';
        const nameMatch   = disposition.match(/filename="?([^"]+)"?/);
        const filename    = nameMatch ? nameMatch[1] : `resume-${assetId}.pdf`;

        const buffer = await r.arrayBuffer();

        return new Response(buffer, {
            headers: {
                'Content-Type':        'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });

    } catch (err) {
        console.error('[resume] download error:', err.message);
        return c.json({ error: 'Could not download asset.' }, 502);
    }
});

export default app;
