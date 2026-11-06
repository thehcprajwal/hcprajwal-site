import 'dotenv/config';                         // local development: reads .env
import { serve } from '@hono/node-server';

import { loadSecrets }   from './utils/secrets.js';
import { loadConfig }    from './config.js';
import { createClients } from './clients.js';
import { createApp }     from './app.js';

// 1. On Lambda, API keys come from SSM Parameter Store (locally they came from .env above).
await loadSecrets();

// 2. Settings, third-party clients, and the web app.
const config = loadConfig();
const { openai, resend } = createClients(config);
const app = createApp({ config, openai, resend });

// 3. Start listening on the address Lambda gave us (or PORT locally).
serve({ fetch: app.fetch, port: config.port, hostname: config.host }, () => {
    console.log(`[hc_system] listening on ${config.host || 'localhost'}:${config.port}`);
    console.log(`[hc_system] env=${config.nodeEnv} model=${config.model}`);
    console.log(`[hc_system] openrouter=${openai ? 'configured' : 'MISSING'} resend=${resend ? 'configured' : 'MISSING'}`);
});
