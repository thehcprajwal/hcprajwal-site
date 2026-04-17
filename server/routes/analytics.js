import { Hono } from 'hono';
import { db }   from '../db.js';

const app = new Hono();

function requirePassword(c, next) {
    const provided = c.req.header('x-analytics-password');
    const expected = process.env.ANALYTICS_PASSWORD;
    if (!expected)                       return c.json({ error: 'Analytics password not configured' }, 500);
    if (!provided || provided !== expected) return c.json({ error: 'Invalid password' }, 401);
    return next();
}

const STOP_WORDS = new Set([
    'a','an','the','is','are','do','you','have','what','how',
    'can','i','your','about','with','for','to','in','of'
]);

function topWords(rows, n = 5) {
    const freq = {};
    for (const { query } of rows) {
        if (!query) continue;
        for (const word of query.toLowerCase().split(/\s+/)) {
            if (word.length > 2 && !STOP_WORDS.has(word)) {
                freq[word] = (freq[word] || 0) + 1;
            }
        }
    }
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([word]) => word);
}

app.get('/', requirePassword, (c) => {
    const daysParam = parseInt(c.req.query('days'), 10) || 30;
    const days      = Math.max(1, Math.min(daysParam, 365));

    try {
        const since = `datetime('now', '-${days} days')`;

        const visitors = db.prepare(`
            SELECT
                COUNT(*)                                            AS total_pageviews,
                COUNT(DISTINCT ip_hash)                             AS unique_visitors,
                ROUND(CAST(COUNT(*) AS REAL) / MAX(?, 1), 1)       AS avg_per_day
            FROM analytics_events
            WHERE event_type = 'pageview'
            AND   created_at >= datetime('now', '-' || ? || ' days')
        `).get(days, days);

        const commandStats = db.prepare(`
            SELECT
                json_extract(payload, '$.cmd') AS cmd,
                COUNT(*)                        AS count
            FROM analytics_events
            WHERE event_type = 'command'
            AND   created_at >= datetime('now', '-' || ? || ' days')
            AND   json_extract(payload, '$.cmd') IS NOT NULL
            GROUP BY json_extract(payload, '$.cmd')
            ORDER BY count DESC
            LIMIT 8
        `).all(days);

        const topCountries = db.prepare(`
            WITH counts AS (
                SELECT
                    country,
                    country_code,
                    COUNT(DISTINCT ip_hash) AS visitors
                FROM analytics_events
                WHERE event_type = 'pageview'
                AND   created_at >= datetime('now', '-' || ? || ' days')
                GROUP BY country, country_code
            ),
            total AS (SELECT COALESCE(SUM(visitors), 1) AS t FROM counts)
            SELECT
                c.country,
                c.country_code,
                c.visitors,
                ROUND(c.visitors * 100.0 / t.t) AS pct
            FROM counts c, total t
            ORDER BY c.visitors DESC
            LIMIT 6
        `).all(days);

        const agentCount = db.prepare(`
            SELECT COUNT(*) AS total_queries
            FROM analytics_events
            WHERE event_type = 'agent_query'
            AND   created_at >= datetime('now', '-' || ? || ' days')
        `).get(days);

        const agentQueries = db.prepare(`
            SELECT json_extract(payload, '$.query') AS query
            FROM analytics_events
            WHERE event_type  = 'agent_query'
            AND   created_at >= datetime('now', '-' || ? || ' days')
            AND   json_extract(payload, '$.query') IS NOT NULL
        `).all(days);

        const contactStats = db.prepare(`
            SELECT
                json_extract(payload, '$.reason') AS reason,
                COUNT(*)                           AS reason_count
            FROM analytics_events
            WHERE event_type = 'contact_submit'
            AND   created_at >= datetime('now', '-' || ? || ' days')
            GROUP BY json_extract(payload, '$.reason')
            ORDER BY reason_count DESC
        `).all(days);

        const dailyChart = db.prepare(`
            SELECT
                date(created_at, '+5 hours', '+30 minutes') AS day,
                COUNT(DISTINCT ip_hash)                      AS visitors
            FROM analytics_events
            WHERE event_type = 'pageview'
            AND   created_at >= datetime('now', '-14 days')
            GROUP BY day
            ORDER BY day ASC
        `).all();

        const sessionStats = db.prepare(`
            SELECT ROUND(AVG(cmd_count), 1) AS avg_commands_per_session
            FROM (
                SELECT ip_hash, date(created_at) AS day, COUNT(*) AS cmd_count
                FROM analytics_events
                WHERE event_type = 'command'
                AND   created_at >= datetime('now', '-' || ? || ' days')
                GROUP BY ip_hash, date(created_at)
            )
        `).get(days);

        const totalContacts = contactStats.reduce((s, r) => s + r.reason_count, 0);

        return c.json({
            ok:          true,
            days,
            generatedAt: new Date().toISOString(),
            visitors: {
                total:     visitors?.total_pageviews  || 0,
                unique:    visitors?.unique_visitors  || 0,
                avgPerDay: visitors?.avg_per_day      || 0
            },
            commands: {
                total:  commandStats.reduce((s, r) => s + r.count, 0),
                ranked: commandStats.map(r => ({ cmd: r.cmd, count: r.count }))
            },
            countries: topCountries.map(r => ({
                country:  r.country,
                code:     r.country_code,
                visitors: r.visitors,
                pct:      r.pct || 0
            })),
            agent: {
                totalQueries: agentCount?.total_queries || 0,
                topWords:     topWords(agentQueries)
            },
            contact: {
                total:     totalContacts,
                breakdown: contactStats.map(r => ({
                    reason: r.reason || 'unknown',
                    count:  r.reason_count
                }))
            },
            chart: dailyChart.map(r => ({ day: r.day, visitors: r.visitors })),
            session: {
                avgCommands: sessionStats?.avg_commands_per_session || 0
            }
        });

    } catch (err) {
        console.error('[analytics] error:', err.message);
        return c.json({ error: 'Failed to aggregate analytics' }, 500);
    }
});

export default app;
