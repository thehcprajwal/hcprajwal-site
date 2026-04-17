import { Hono }       from 'hono';
import { createHash } from 'crypto';
import { db }         from '../db.js';

const app    = new Hono();
const isProd = process.env.NODE_ENV === 'production';

function hashIP(ip) {
    const salt = new Date().toISOString().slice(0, 10);
    return createHash('sha256')
        .update(ip + salt + 'hc_system_salt')
        .digest('hex')
        .slice(0, 16);
}

function getClientIP(c) {
    if (isProd) {
        const fwd = c.req.header('x-forwarded-for');
        if (fwd) return fwd.split(',')[0].trim();
    }
    return '127.0.0.1';
}

const countryCache = new Map();
const CACHE_TTL    = 60 * 60 * 1000;

async function getCountry(ip) {
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168')) {
        return { country: 'localhost', code: 'xx' };
    }
    const cached = countryCache.get(ip);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return { country: cached.country, code: cached.code };
    }
    try {
        const res    = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode`, {
            signal: AbortSignal.timeout(3000)
        });
        const data   = await res.json();
        const result = { country: data.country || 'unknown', code: data.countryCode || 'xx' };
        countryCache.set(ip, { ...result, ts: Date.now() });
        return result;
    } catch {
        return { country: 'unknown', code: 'xx' };
    }
}

const ALLOWED_EVENTS = new Set(['pageview', 'command', 'agent_query', 'contact_submit']);

const insertEvent = db.prepare(
    `INSERT INTO analytics_events (event_type, payload, ip_hash, country, country_code)
     VALUES (?, ?, ?, ?, ?)`
);

app.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}));

    // Respond immediately — tracking is fire-and-forget
    ;(async () => {
        try {
            const { event, ...rest } = body;
            if (!ALLOWED_EVENTS.has(event)) return;

            const ip     = getClientIP(c);
            const ipHash = hashIP(ip);
            const { country, code } = await getCountry(ip);

            const payload = {};
            for (const key of ['cmd', 'query', 'reason', 'duration']) {
                if (rest[key] !== undefined) payload[key] = String(rest[key]).slice(0, 200);
            }

            insertEvent.run(event, JSON.stringify(payload), ipHash, country, code);
        } catch (err) {
            console.error('[track] error:', err.message);
        }
    })();

    return c.json({ ok: true }, 202);
});

export { getClientIP };
export default app;
