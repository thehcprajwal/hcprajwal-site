/**
 * terminal.js — fish-style DOM terminal
 * Integrates: streaming Groq agent · inline contact form · autocomplete · analytics
 */
import { streamAgent, resetMemory } from './agent.js';
import { initAutocomplete }         from './autocomplete.js';
import { setIdle, triggerPulse }    from './three-bg.js';
import { createContactForm }        from './contact.js';
import {
    initAnalytics,
    openAnalytics,
    closeAnalytics,
    isAnalyticsActive
} from './analytics.js';
import { A } from './ansi.js';

const COMMANDS = [
    { cmd: 'help',      desc: 'Show all commands'                        },
    { cmd: 'whoami',    desc: 'About Prajwal HC'                         },
    { cmd: 'skills',    desc: 'Tech skills matrix'                       },
    { cmd: 'projects',  desc: 'Portfolio projects'                       },
    { cmd: 'contact',   desc: 'Send a message'                           },
    { cmd: 'agent',     desc: 'Ask the AI agent'                         },
    { cmd: 'analytics', desc: 'View site analytics (password protected)' },
    { cmd: 'resume',    desc: 'Download my resume PDF'                   },
    { cmd: 'reset',     desc: 'Reset agent memory'                       },
    { cmd: 'clear',     desc: 'Clear terminal'                           }
];

const BOOT_LINES = [
    `${A.GREEN_B}[OK]${A.RESET} Initializing hc_system v1.0.0...`,
    `${A.GREEN_B}[OK]${A.RESET} Mounting virtual filesystem...`,
    `${A.GREEN_B}[OK]${A.RESET} Establishing secure connection...`,
    `${A.GREEN_B}[OK]${A.RESET} Loading developer profile...`,
    `${A.GREEN_B}[OK]${A.RESET} Waking up background agents...`
];

// ── ANSI escape → inline HTML ──────────────────────────────────────
function ansiToHtml(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\x1b\[0m/g,       '</span>')
        .replace(/\x1b\[1;32m/g,    '<span style="color:#39ff14;font-weight:700">')
        .replace(/\x1b\[32m/g,      '<span style="color:#39ff14">')
        .replace(/\x1b\[1;36m/g,    '<span style="color:#56b6c2;font-weight:700">')
        .replace(/\x1b\[36m/g,      '<span style="color:#56b6c2">')
        .replace(/\x1b\[33m/g,      '<span style="color:#f6c177">')
        .replace(/\x1b\[31m/g,      '<span style="color:#ef6b73">')
        .replace(/\x1b\[90m/g,      '<span style="color:#3a4a42">')
        .replace(/\x1b\[2m/g,       '<span style="opacity:0.5">')
        .replace(/\x1b\[[0-9;]*m/g, '');
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m+1 }, (_, i) =>
        Array.from({ length: n+1 }, (_, j) => i || j)
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
}

// ── Passive tracker — fire and forget ─────────────────────────────
function track(event, payload = {}) {
    fetch('/api/track', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ event, ...payload })
    }).catch(() => {});
}

export function initTerminal() {
    // ── DOM refs ───────────────────────────────────────────────────
    const output         = document.getElementById('output');
    const cmdInput       = document.getElementById('cmd-input');
    const ghostEl        = document.getElementById('ghost-text');
    const hintBar        = document.getElementById('hint-bar');
    const statusEl       = document.getElementById('agent-status');
    const app            = document.getElementById('app');
    const analyticsBlock = document.getElementById('analytics-block');

    let cmdHistory = [];
    let histIdx    = -1;
    let agentBusy  = false;
    let formMode   = null;
    let idleTimer  = null;

    // ── Output helpers ─────────────────────────────────────────────
    function print(text = '') {
        const el = document.createElement('span');
        el.className = 'line fade-in';
        el.innerHTML = ansiToHtml(text);
        output.appendChild(el);
        output.scrollTop = output.scrollHeight;
        return el;
    }

    function printPrompt(cmd) {
        print(`\x1b[1;32mguest@hc_system\x1b[0m:\x1b[36m~\x1b[0m$ ${cmd}`);
    }

    function pulse() {
        app.classList.remove('pulse');
        void app.offsetWidth;
        app.classList.add('pulse');
        setTimeout(() => app.classList.remove('pulse'), 800);
    }

    function setStatus(state, text) {
        statusEl.className   = state;
        statusEl.textContent = text;
    }

    // ── Idle timer ─────────────────────────────────────────────────
    function resetIdleTimer() {
        setIdle(false);
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => setIdle(true), 45_000);
    }

    // ── Autocomplete ───────────────────────────────────────────────
    const { accept, updateGhost } = initAutocomplete({
        input:    cmdInput,
        ghost:    ghostEl,
        hintBar,
        commands: COMMANDS
    });

    // ── Analytics ──────────────────────────────────────────────────
    initAnalytics({ refs: { analyticsBlock }, print });

    // ── Contact form ───────────────────────────────────────────────
    const contactForm = createContactForm({
        print,
        pulse,
        onDone() {
            formMode             = null;
            cmdInput.disabled    = false;
            cmdInput.placeholder = '';
            cmdInput.value       = '';
            cmdInput.focus();
            resetIdleTimer();
        }
    });

    // ── Agent streaming UI ─────────────────────────────────────────
    function runAgent(query) {
        if (agentBusy) {
            print('\x1b[33m  Agent is busy — please wait.\x1b[0m');
            return;
        }

        agentBusy         = true;
        cmdInput.disabled = true;
        setStatus('thinking', 'agent • thinking');

        const thinkEl = document.createElement('span');
        thinkEl.className = 'line';
        thinkEl.innerHTML = `
            <span class="agent-label">◈ hc_agent
                <span class="model-tag">[llama-3.3-70b]</span>
            </span>
            <span class="thinking-dots">
                <span></span><span></span><span></span>
            </span>`;
        output.appendChild(thinkEl);
        output.scrollTop = output.scrollHeight;

        const blockWrap = document.createElement('span');
        blockWrap.className = 'line';
        const block  = document.createElement('span');
        block.className = 'agent-block';
        const cursor = document.createElement('span');
        cursor.className = 'agent-cursor';
        block.appendChild(cursor);
        blockWrap.appendChild(block);

        let fullText      = '';
        let streamStarted = false;

        streamAgent(query, {
            onChunk(token) {
                if (!streamStarted) {
                    streamStarted = true;
                    thinkEl.remove();
                    output.appendChild(blockWrap);
                    setStatus('streaming', 'agent • streaming');
                }
                fullText += token;
                block.textContent = fullText;
                block.appendChild(cursor);
                output.scrollTop = output.scrollHeight;
            },

            onDone() {
                cursor.remove();
                block.textContent = fullText;
                print('');
                setStatus('', 'agent • standby');
                agentBusy         = false;
                cmdInput.disabled = false;
                cmdInput.focus();
                pulse();
                resetIdleTimer();
            },

            onError(msg) {
                thinkEl.remove();
                if (blockWrap.parentNode) blockWrap.remove();
                print(`\x1b[31m  ✗ ${msg}\x1b[0m`);
                print('');
                setStatus('error', 'agent • error');
                setTimeout(() => setStatus('', 'agent • standby'), 3000);
                agentBusy         = false;
                cmdInput.disabled = false;
                cmdInput.focus();
            }
        });
    }

    // ── Command processor ──────────────────────────────────────────
    function processCommand(raw) {
        const trimmed = raw.trim();
        const base    = trimmed.toLowerCase().split(/\s+/)[0];
        if (!trimmed) return;

        if (cmdHistory[0] !== trimmed) cmdHistory.unshift(trimmed);
        if (cmdHistory.length > 80)   cmdHistory.pop();
        histIdx = -1;

        printPrompt(trimmed);
        pulse();

        // Track every command
        track('command', { cmd: base });

        if (base === 'clear') { output.innerHTML = ''; return; }

        if (base === 'reset') {
            resetMemory();
            print('');
            print('\x1b[32m  ✓ Agent memory cleared.\x1b[0m');
            print('');
            return;
        }

        if (base === 'contact') {
            formMode = 'reason';
            contactForm.start();
            return;
        }

        if (base === 'resume') {
            const hasList     = trimmed.includes('--list');
            const hasDownload = trimmed.includes('--download');
            const variantMatch = trimmed.match(/--variant\s+(\S+)/);
            const variant     = variantMatch ? variantMatch[1].toLowerCase() : null;

            if (hasList) {
                print('');
                print('\x1b[90m  Fetching resume variants...\x1b[0m');
                fetch('/api/resume/assets')
                    .then(r => r.json())
                    .then(data => {
                        if (!data.ok) { print(`\x1b[31m  ✗ ${data.error}\x1b[0m`); print(''); return; }
                        print(`  Release \x1b[32m${data.tag}\x1b[0m — ${data.assets.length} variant(s):`);
                        print('');
                        data.assets.forEach(a => {
                            const kb = (a.size / 1024).toFixed(0);
                            const name = a.name.replace(/\.pdf$/i, '');
                            print(`  \x1b[32m▸\x1b[0m ${name.padEnd(32)} \x1b[90m${kb} KB\x1b[0m`);
                        });
                        print('');
                        print('  \x1b[90mUsage: resume --download --variant <name>\x1b[0m');
                        print('');
                    })
                    .catch(() => { print('\x1b[31m  ✗ Network error.\x1b[0m'); print(''); });
                return;
            }

            if (hasDownload) {
                print('');
                print('\x1b[90m  Fetching release assets...\x1b[0m');
                fetch('/api/resume/assets')
                    .then(r => r.json())
                    .then(data => {
                        if (!data.ok) { print(`\x1b[31m  ✗ ${data.error}\x1b[0m`); print(''); return; }
                        if (!data.assets.length) {
                            print('\x1b[31m  ✗ No PDF assets found in latest release.\x1b[0m');
                            print('');
                            return;
                        }

                        let asset;
                        if (variant) {
                            asset = data.assets.find(a =>
                                a.name.toLowerCase().includes(variant)
                            );
                            if (!asset) {
                                print(`\x1b[31m  ✗ Variant "${variant}" not found.\x1b[0m`);
                                print('  Run \x1b[32mresume --list\x1b[0m to see available variants.');
                                print('');
                                return;
                            }
                        } else {
                            asset = data.assets[0];
                        }

                        // Trigger download via hidden <a> — server proxies the PDF
                        const a = document.createElement('a');
                        a.href     = `/api/resume/download/${asset.id}`;
                        a.download = asset.name;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();

                        print(`  \x1b[32m✓\x1b[0m Downloading \x1b[32m${asset.name}\x1b[0m...`);
                        print('');
                        pulse();
                    })
                    .catch(() => { print('\x1b[31m  ✗ Network error.\x1b[0m'); print(''); });
                return;
            }

            // Usage
            print('');
            print('  \x1b[1;36mresume\x1b[0m — Download my resume PDF');
            print('');
            print('  \x1b[32mresume --download\x1b[0m                    latest variant');
            print('  \x1b[32mresume --download --variant <name>\x1b[0m   specific variant');
            print('  \x1b[32mresume --list\x1b[0m                        list all variants');
            print('');
            return;
        }

        if (base === 'analytics') {
            const parts    = trimmed.split(/\s+/);
            const passFlag = parts.indexOf('--pass');
            const password = passFlag !== -1 ? parts[passFlag + 1] : '';

            if (!password) {
                print('');
                print('  Usage: \x1b[32manalytics --pass <password>\x1b[0m');
                print('');
                return;
            }

            openAnalytics(password);
            return;
        }

        if (base === 'agent') {
            const query = trimmed
                .replace(/^agent\s*/i, '')
                .replace(/^--ask\s*/i, '')
                .replace(/^["']|["']$/g, '')
                .trim();

            if (!query) {
                print('');
                print('  Usage:   \x1b[32magent <your question>\x1b[0m');
                print('  Example: \x1b[32magent do you have n8n experience?\x1b[0m');
                print('');
                return;
            }
            print('');
            runAgent(query);
            track('agent_query', { query: query.slice(0, 200) });
            return;
        }

        if (base === 'help') {
            print('');
            print('\x1b[1;32m┌─ Commands ───────────────────────────────────────────┐');
            print('│\x1b[0m  help        Show this menu                          \x1b[1;32m│');
            print('│\x1b[0m  whoami      About me                                \x1b[1;32m│');
            print('│\x1b[0m  skills      Technical skills                        \x1b[1;32m│');
            print('│\x1b[0m  projects    My work                                 \x1b[1;32m│');
            print('│\x1b[0m  contact     Send a message                          \x1b[1;32m│');
            print('│\x1b[0m  agent       Ask the AI agent                        \x1b[1;32m│');
            print('│\x1b[0m  resume      Download my resume PDF                  \x1b[1;32m│');
            print('│\x1b[0m  analytics   View site analytics                     \x1b[1;32m│');
            print('│\x1b[0m  reset       Clear agent memory                      \x1b[1;32m│');
            print('│\x1b[0m  clear       Clear terminal                          \x1b[1;32m│');
            print('└──────────────────────────────────────────────────────\x1b[0m');
            print('');
            return;
        }

        if (base === 'whoami') {
            print('');
            print('  \x1b[1;36mPrajwal HC\x1b[0m — Backend & Automation Engineer');
            print('  Bangalore, India');
            print('');
            print('  \x1b[33mCurrent Focus\x1b[0m  →  Workflow automation · WebSocket systems · AI tooling');
            print('  \x1b[33mOpen to\x1b[0m        →  Backend roles · Freelance automation projects');
            print('  \x1b[33mGitHub\x1b[0m         →  \x1b[36mgithub.com/prajwalhc\x1b[0m');
            print('');
            return;
        }

        if (base === 'skills') {
            print('');
            print('  \x1b[33m● Languages\x1b[0m');
            print('    TypeScript   \x1b[32m████████████████\x1b[90m░░░░\x1b[0m  90%');
            print('    Python       \x1b[32m██████████████\x1b[90m░░░░░░\x1b[0m  78%');
            print('    JavaScript   \x1b[32m███████████████\x1b[90m░░░░░\x1b[0m  82%');
            print('');
            print('  \x1b[33m● Backend\x1b[0m');
            print('    Node.js  Hono  FastAPI  WebSockets  REST APIs');
            print('');
            print('  \x1b[33m● Automation\x1b[0m');
            print('    n8n  Zapier  Webhook Pipelines  Cron Scheduling');
            print('');
            print('  \x1b[33m● Infrastructure\x1b[0m');
            print('    Docker  AWS Lightsail  Caddy  Nginx  Linux');
            print('');
            print('  \x1b[33m● AI / ML\x1b[0m');
            print('    LangChain  Groq  OpenAI API  RAG Pipelines');
            print('');
            return;
        }

        if (base === 'projects') {
            print('');
            print('  \x1b[1;32m▸ hc_system\x1b[0m');
            print('    Terminal portfolio with WebSocket backend, AI agent,');
            print('    fish-style autocomplete, and n8n automation.');
            print('    \x1b[90mStack: TypeScript · Node.js · Three.js · Docker · Caddy\x1b[0m');
            print('');
            print('  \x1b[90m╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌\x1b[0m');
            print('');
            print('  \x1b[1;32m▸ AutoFlow Engine\x1b[0m');
            print('    Webhook-driven pipeline orchestrator with retry logic');
            print('    and dead-letter queues.');
            print('    \x1b[90mStack: Node.js · n8n · Redis · PostgreSQL\x1b[0m');
            print('');
            print('  \x1b[90m╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌\x1b[0m');
            print('');
            print('  \x1b[1;32m▸ RAG Document Assistant\x1b[0m');
            print('    RAG system for querying internal knowledge bases');
            print('    with citations and confidence scores.');
            print('    \x1b[90mStack: Python · FastAPI · LangChain · Groq · Pinecone\x1b[0m');
            print('');
            return;
        }

        // Typo tolerance
        const names = COMMANDS.map(c => c.cmd);
        const close = names.find(n => levenshtein(base, n) <= 2);
        if (close) {
            print(`\n  \x1b[31mCommand not found: ${base}\x1b[0m`);
            print(`  Did you mean \x1b[1;32m${close}\x1b[0m? (Tab to autocomplete)`);
        } else {
            print(`\n  \x1b[31mCommand not found: ${base}\x1b[0m. Type \x1b[1;32mhelp\x1b[0m.`);
        }
        print('');
    }

    // ── Keyboard ───────────────────────────────────────────────────
    cmdInput.addEventListener('input', () => {
        if (!formMode) updateGhost();
        resetIdleTimer();
    });

    cmdInput.addEventListener('keydown', e => {
        resetIdleTimer();

        // Analytics dashboard takes full focus
        if (isAnalyticsActive()) return;

        // ── Contact form active ───────────────────────────────────
        if (contactForm.isActive()) {
            const result = contactForm.handleKey(e.key, cmdInput.value);
            if (result.consumed) {
                e.preventDefault();

                if (result.clearInput) cmdInput.value = '';

                if (result.mode === 'input') {
                    formMode             = 'input';
                    cmdInput.placeholder = 'Type here...';
                    cmdInput.disabled    = false;
                    cmdInput.focus();
                } else if (result.mode === 'confirm') {
                    formMode             = 'confirm';
                    cmdInput.placeholder = '';
                    cmdInput.value       = '';
                } else if (result.mode === 'submitting') {
                    formMode             = 'submitting';
                    cmdInput.disabled    = true;
                    cmdInput.placeholder = 'sending...';
                } else if (result.mode === 'shell') {
                    formMode             = null;
                    cmdInput.placeholder = '';
                    cmdInput.value       = '';
                    cmdInput.disabled    = false;
                }
            }
            return;
        }

        // ── Normal shell mode ─────────────────────────────────────
        if (e.key === 'Tab') { e.preventDefault(); accept(); return; }

        if (e.key === 'ArrowRight' &&
            cmdInput.selectionStart === cmdInput.value.length) {
            e.preventDefault(); accept(); return;
        }

        if (e.key === 'Escape') { cmdInput.value = ''; updateGhost(); return; }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (agentBusy) return;
            const val = cmdInput.value;
            cmdInput.value = '';
            ghostEl.textContent = '';
            hintBar.classList.remove('visible');
            processCommand(val);
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (histIdx < cmdHistory.length - 1) {
                cmdInput.value = cmdHistory[++histIdx];
                updateGhost();
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            histIdx = histIdx > 0 ? histIdx - 1 : -1;
            cmdInput.value = histIdx >= 0 ? cmdHistory[histIdx] : '';
            updateGhost();
            return;
        }
    });

    app.addEventListener('click', () => {
        if (!formMode && !isAnalyticsActive()) cmdInput.focus();
    });

    // ── Boot sequence ──────────────────────────────────────────────
    function runBoot(i) {
        if (i < BOOT_LINES.length) {
            print(BOOT_LINES[i]);
            triggerPulse();
            setTimeout(() => runBoot(i + 1), 320);
        } else {
            print('');
            print('  Welcome to \x1b[1;32mhc_system\x1b[0m. Type \x1b[1;32mhelp\x1b[0m to begin.');
            print('  Try \x1b[32mcontact\x1b[0m to send a message or \x1b[32magent tell me about yourself\x1b[0m.');
            print('');
            track('pageview');
            cmdInput.focus();
            resetIdleTimer();
        }
    }

    setTimeout(() => runBoot(0), 500);
}
