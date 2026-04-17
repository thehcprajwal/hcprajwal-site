import { Hono }        from 'hono';
import { cors }        from 'hono/cors';
import { logger }      from 'hono/logger';
import { streamSSE }   from 'hono/streaming';
import { serve }       from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import Groq            from 'groq-sdk';
import 'dotenv/config';

import { db, migrate }   from './db.js';
import { isRateLimited } from './utils/rateLimit.js';
import trackRouter,
       { getClientIP }   from './routes/track.js';
import analyticsRouter   from './routes/analytics.js';
import resumeRouter      from './routes/resume.js';

const PORT   = parseInt(process.env.PORT)   || 3001;
const MODEL  = process.env.GROQ_MODEL       || 'llama-3.3-70b-versatile';
const ORIGIN = process.env.DOMAIN           ? `https://${process.env.DOMAIN}` : '*';
const isProd = process.env.NODE_ENV         === 'production';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const app  = new Hono();

// ── Middleware ────────────────────────────────────────────────────
app.use(logger());
app.use(cors({ origin: isProd ? ORIGIN : '*', allowMethods: ['GET', 'POST'] }));

// ── API routes ────────────────────────────────────────────────────
app.route('/api/track',     trackRouter);
app.route('/api/analytics', analyticsRouter);
app.route('/api/resume',    resumeRouter);

// ── GET /api/health ───────────────────────────────────────────────
app.get('/api/health', (c) => {
    try {
        db.prepare('SELECT 1').get();
        return c.json({
            ok:      true,
            model:   MODEL,
            db:      'connected',
            webhook: process.env.N8N_WEBHOOK_URL ? 'configured' : 'missing',
            time:    new Date().toISOString()
        });
    } catch {
        return c.json({ ok: false, db: 'disconnected' }, 503);
    }
});

// ── Validation helpers ────────────────────────────────────────────
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function sanitize(s = '') { return String(s).replace(/[<>]/g, '').trim().slice(0, 500); }

const VALID_REASONS = ['job', 'project', 'collab', 'hi'];

// ── POST /api/contact ─────────────────────────────────────────────
app.post('/api/contact', async (c) => {
    const ip = getClientIP(c);

    if (isRateLimited(ip, 3, 'contact')) {
        return c.json({ ok: false, error: 'Too many submissions. Please try again later.' }, 429);
    }

    const { reason, name, email, message } = await c.req.json();
    const errors = [];

    if (!reason || !VALID_REASONS.includes(reason)) errors.push('Invalid reason.');
    if (!name    || name.trim().length < 2)          errors.push('Name must be at least 2 characters.');
    if (!email   || !isValidEmail(email))             errors.push('Valid email required.');
    if (!message || message.trim().length < 5)        errors.push('Message must be at least 5 characters.');

    if (errors.length) return c.json({ ok: false, error: errors.join(' ') }, 400);

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
        console.error('[contact] N8N_WEBHOOK_URL not configured');
        return c.json({ ok: false, error: 'Contact system is not configured yet.' }, 500);
    }

    const payload = {
        reason:    sanitize(reason),
        name:      sanitize(name),
        email:     sanitize(email),
        message:   sanitize(message),
        source:    'hc_system_terminal',
        timestamp: new Date().toISOString(),
        ip:        ip || 'unknown'
    };

    try {
        const webhookRes = await fetch(webhookUrl, {
            method:  'POST',
            headers: {
                'Content-Type':     'application/json',
                'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET || ''
            },
            body:   JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
        });

        if (!webhookRes.ok) {
            const body = await webhookRes.text().catch(() => 'unknown error');
            console.error(`[contact] n8n returned ${webhookRes.status}: ${body}`);
            return c.json({ ok: false, error: 'Message delivery failed. Please email me directly.' }, 502);
        }

        console.log(`[contact] delivered: ${name} <${email}> — ${reason}`);
        return c.json({ ok: true, message: "Message received. I'll get back to you soon." });

    } catch (err) {
        console.error('[contact] webhook error:', err.message);
        return c.json({ ok: false, error: 'Could not deliver message. Please email prajwal@hcprajwal.in directly.' }, 502);
    }
});

// ── POST /api/agent ───────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an AI assistant embedded inside hc_system,
the terminal-based developer portfolio of Prajwal HC.

YOUR ROLE:
Answer questions about Prajwal on his behalf, in first person.
Be concise, direct, and slightly technical in tone — matching the terminal aesthetic.
Use plain text only. No markdown, no asterisks, no bullet points.
Answer in 2-5 sentences unless the question genuinely needs more.
Never make up projects, skills, or experience not listed below.

ABOUT PRAJWAL HC:
- Role: Backend & Automation Engineer
- Location: Bangalore, India
- GitHub: github.com/prajwalhc
- Email: prajwal@hcprajwal.in
- Open to: Backend engineering roles, freelance automation projects

SKILLS:
- Languages: TypeScript (90%), JavaScript (82%), Python (78%), Bash (65%)
- Backend: Node.js, Hono, FastAPI, WebSockets, REST APIs
- Automation: n8n, Zapier, Webhook pipelines, Cron scheduling
- Infrastructure: Docker, AWS Lightsail, Caddy, Nginx, Linux
- Databases: SQLite, PostgreSQL, MongoDB, Redis
- AI/ML: LangChain, Groq, OpenAI API, RAG pipelines, n8n AI nodes

PROJECTS:
1. hc_system — Terminal portfolio with AI agent, fish-style autocomplete,
   n8n automation. Stack: Node.js, Hono, Three.js, SQLite, Docker, Caddy.

2. AutoFlow Engine — Webhook-driven pipeline orchestrator integrating
   10+ third-party APIs with retry logic and dead-letter queues.
   Stack: Node.js, n8n, Redis, PostgreSQL.

3. RAG Document Assistant — Retrieval-augmented generation for querying
   internal knowledge bases with citations and confidence scores.
   Stack: Python, FastAPI, LangChain, Groq, Pinecone.`;

app.post('/api/agent', async (c) => {
    const ip = getClientIP(c);
    if (isRateLimited(ip, 5, 'agent')) {
        return c.json({ error: 'Rate limited. Please wait before sending more messages.' }, 429);
    }

    const { messages } = await c.req.json();
    if (!messages || !Array.isArray(messages)) {
        return c.json({ error: 'messages array required' }, 400);
    }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 30_000);

    return streamSSE(c, async (stream) => {
        try {
            const groqStream = await groq.chat.completions.create({
                model:       MODEL,
                messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
                stream:      true,
                max_tokens:  400,
                temperature: 0.65,
                signal:      abort.signal
            });

            for await (const chunk of groqStream) {
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

// ── Static frontend (fallback when Caddy not present) ─────────────
if (isProd) {
    app.use(serveStatic({ root: './dist' }));
    app.get('*', serveStatic({ path: './dist/index.html' }));
}

// ── Start ─────────────────────────────────────────────────────────
migrate();

serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[hc_system] running  → http://localhost:${PORT}`);
    console.log(`[hc_system] model    → ${MODEL}`);
    console.log(`[hc_system] env      → ${process.env.NODE_ENV || 'development'}`);
    console.log(`[hc_system] n8n      → ${process.env.N8N_WEBHOOK_URL || 'not set'}`);
});
