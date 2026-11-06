import { Hono } from 'hono';
import { isRateLimited } from '../utils/rateLimit.js';
import { getClientIp }   from '../utils/clientIp.js';
import { readJson }      from '../utils/json.js';

const VALID_REASONS = ['job', 'project', 'collab', 'hi'];

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const sanitize     = (s = '') => String(s).replace(/[<>]/g, '').trim().slice(0, 500);

/** Returns a list of problems with the submitted form (empty list means valid). */
export function validateContact({ reason, name, email, message }) {
    const errors = [];
    if (!reason || !VALID_REASONS.includes(reason)) errors.push('Invalid reason.');
    if (!name    || name.trim().length < 2)          errors.push('Name must be at least 2 characters.');
    if (!email   || !isValidEmail(email))             errors.push('Valid email required.');
    if (!message || message.trim().length < 5)        errors.push('Message must be at least 5 characters.');
    return errors;
}

/** POST /api/contact : emails you the message through Resend, and sends the visitor a confirmation. */
export function contactRoutes({ config, resend }) {
    const app = new Hono();

    app.post('/', async (c) => {
        if (isRateLimited(getClientIp(c), 3, 'contact')) {
            return c.json({ ok: false, error: 'Too many submissions. Please try again later.' }, 429);
        }

        const body = await readJson(c);
        if (!body) return c.json({ ok: false, error: 'Invalid request.' }, 400);

        const errors = validateContact(body);
        if (errors.length) return c.json({ ok: false, error: errors.join(' ') }, 400);

        if (!resend) {
            console.error('[contact] RESEND_API_KEY not configured');
            return c.json({ ok: false, error: 'Contact system is not configured yet.' }, 500);
        }

        const reason  = sanitize(body.reason);
        const name    = sanitize(body.name);
        const email   = sanitize(body.email);
        const message = sanitize(body.message);

        try {
            // 1. The message itself, delivered to you. reply_to lets you answer the visitor directly.
            const { error } = await resend.emails.send({
                from:     `hc_system <noreply@${config.domain}>`,
                to:       config.contactTo,
                reply_to: email,
                subject:  `[contact] ${reason} - ${name}`,
                text:     `Name: ${name}\nEmail: ${email}\nReason: ${reason}\n\nMessage:\n${message}`,
            });

            if (error) {
                console.error('[contact] Resend error:', error);
                return c.json({ ok: false, error: 'Message delivery failed. Please email me directly.' }, 502);
            }

            console.log(`[contact] sent: ${name} <${email}> - ${reason}`);

            // 2. A confirmation to the visitor. Fire and forget: a failure here must not fail the request.
            resend.emails.send({
                from:    `Prajwal HC <noreply@${config.domain}>`,
                to:      email,
                subject: 'Got your message - Prajwal HC',
                text:    `Hey ${name},\n\nThanks for reaching out. I've received your message and will get back to you soon.\n\nPrajwal\n${config.contactTo}`,
            }).catch((err) => console.error('[contact] confirmation error:', err.message));

            return c.json({ ok: true, message: "Message received. I'll get back to you soon." });

        } catch (err) {
            console.error('[contact] error:', err.message);
            return c.json({ ok: false, error: `Could not deliver message. Please email ${config.contactTo} directly.` }, 502);
        }
    });

    return app;
}
