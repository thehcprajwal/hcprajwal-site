import { Hono }      from 'hono';
import { cors }      from 'hono/cors';
import { logger }    from 'hono/logger';
import { streamSSE } from 'hono/streaming';
import { serve }     from '@hono/node-server';
import OpenAI        from 'openai';
import { Resend }    from 'resend';
import 'dotenv/config';

import { isRateLimited } from './utils/rateLimit.js';

const PORT   = parseInt(process.env.PORT)   || 3001;
const MODEL  = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';
const ORIGIN = process.env.DOMAIN           ? `https://${process.env.DOMAIN}` : '*';
const isProd = process.env.NODE_ENV         === 'production';

const openai = new OpenAI({
    apiKey:         process.env.OPENROUTER_API_KEY,
    baseURL:        'https://openrouter.ai/api/v1',
    defaultHeaders: {
        'HTTP-Referer': process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'http://localhost:3001',
        'X-Title':      'hc_system',
    }
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const app = new Hono();

function getClientIP(c) {
    if (isProd) {
        const fwd = c.req.header('x-forwarded-for');
        if (fwd) return fwd.split(',')[0].trim();
    }
    return '127.0.0.1';
}

// ── Middleware ────────────────────────────────────────────────────
app.use(logger());
app.use(cors({ origin: isProd ? ORIGIN : '*', allowMethods: ['GET', 'POST'] }));

// ── GET /api/health ───────────────────────────────────────────────
app.get('/api/health', (c) => {
    return c.json({
        ok:     true,
        model:  MODEL,
        resend: resend ? 'configured' : 'missing',
        time:   new Date().toISOString()
    });
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

    if (!resend) {
        console.error('[contact] RESEND_API_KEY not configured');
        return c.json({ ok: false, error: 'Contact system is not configured yet.' }, 500);
    }

    try {
        const { error } = await resend.emails.send({
            from:     `hc_system <noreply@${process.env.DOMAIN || 'hcprajwal.in'}>`,
            to:       process.env.CONTACT_TO_EMAIL || 'hello@hcprajwal.in',
            reply_to: sanitize(email),
            subject:  `[contact] ${sanitize(reason)} — ${sanitize(name)}`,
            text:     `Name: ${sanitize(name)}\nEmail: ${sanitize(email)}\nReason: ${sanitize(reason)}\n\nMessage:\n${sanitize(message)}`,
        });

        if (error) {
            console.error('[contact] Resend error:', error);
            return c.json({ ok: false, error: 'Message delivery failed. Please email me directly.' }, 502);
        }

        console.log(`[contact] sent: ${name} <${email}> — ${reason}`);

        // Confirmation to sender — fire and forget
        resend.emails.send({
            from:    `Prajwal HC <noreply@${process.env.DOMAIN || 'hcprajwal.in'}>`,
            to:      sanitize(email),
            subject: `Got your message — Prajwal HC`,
            text:    `Hey ${sanitize(name)},\n\nThanks for reaching out — I've received your message and will get back to you soon.\n\n— Prajwal\nhello@hcprajwal.in`,
        }).catch(err => console.error('[contact] confirmation error:', err.message));

        return c.json({ ok: true, message: "Message received. I'll get back to you soon." });

    } catch (err) {
        console.error('[contact] error:', err.message);
        return c.json({ ok: false, error: 'Could not deliver message. Please email hello@hcprajwal.in directly.' }, 502);
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
- Email: hello@hcprajwal.in
- Open to: Backend engineering roles, freelance automation projects

SKILLS:
- Languages: TypeScript (90%), JavaScript (82%), Python (78%), Bash (65%)
- Backend: Node.js, Hono, FastAPI, WebSockets, REST APIs
- Automation: n8n, Zapier, Webhook pipelines, Cron scheduling
- Infrastructure: Docker, Caddy, Nginx, Linux
- Databases: SQLite, PostgreSQL, MongoDB, Redis
- AI/ML: LangChain, OpenRouter, OpenAI API, RAG pipelines, n8n AI nodes

PROJECTS:
1. hc_system — Terminal portfolio with AI agent, fish-style autocomplete,
   contact form. Stack: Node.js, Hono, Three.js, Docker, Caddy.

2. AutoFlow Engine — Webhook-driven pipeline orchestrator integrating
   10+ third-party APIs with retry logic and dead-letter queues.
   Stack: Node.js, n8n, Redis, PostgreSQL.

3. RAG Document Assistant — Retrieval-augmented generation for querying
   internal knowledge bases with citations and confidence scores.
   Stack: Python, FastAPI, LangChain, OpenRouter, Pinecone.`;

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
            const aiStream = await openai.chat.completions.create({
                model:       MODEL,
                messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
                stream:      true,
                max_tokens:  400,
                temperature: 0.65,
            }, { signal: abort.signal });

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

// ── Start ─────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[hc_system] running  → http://localhost:${PORT}`);
    console.log(`[hc_system] model    → ${MODEL}`);
    console.log(`[hc_system] env      → ${process.env.NODE_ENV || 'development'}`);
    console.log(`[hc_system] resend   → ${resend ? 'configured' : 'not set'}`);
});
