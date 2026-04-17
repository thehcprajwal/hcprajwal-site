import { A } from './ansi.js';

const REASONS = [
    { value: 'job',     label: 'I have a job opportunity'    },
    { value: 'project', label: 'I want to discuss a project' },
    { value: 'collab',  label: 'Looking to collaborate'      },
    { value: 'hi',      label: 'Just saying hi 👋'           }
];

export function createContactForm({ print, pulse, onDone }) {
    const data = { reason: '', name: '', email: '', message: '' };
    let step       = 0;
    let reasonIdx  = 0;
    let active     = false;
    let submitting = false;

    // ── Step 0: reason selector ───────────────────────────────────
    function renderReason() {
        print(`${A.CYAN}  What brings you here?${A.RESET}`);
        REASONS.forEach((r, i) => {
            const marker = i === reasonIdx ? `${A.GREEN_B}❯${A.RESET}` : `${A.DIM}○${A.RESET}`;
            const color  = i === reasonIdx ? A.GREEN_B : A.DIM;
            print(`    ${marker} ${color}${r.label}${A.RESET}`);
        });
        print(`${A.DIM}  ↑↓ select · Enter confirm${A.RESET}`);
    }

    // ── Steps 1–3: text prompts ───────────────────────────────────
    function renderTextPrompt() {
        const prompts = {
            1: ['Your name',    'e.g. John Doe'                  ],
            2: ['Your email',   'e.g. you@example.com'           ],
            3: ['Your message', 'keep it brief — I read every one']
        };
        const [label, hint] = prompts[step];
        print('');
        print(`${A.CYAN}  ${label}${A.RESET} ${A.DIM}(${hint})${A.RESET}`);
    }

    // ── Step 4: confirm ───────────────────────────────────────────
    function renderConfirm() {
        const reasonLabel = REASONS.find(r => r.value === data.reason)?.label || data.reason;
        print('');
        print(`${A.CYAN_B}◇  Review your message${A.RESET}`);
        print(`${A.DIM}  │ Reason :${A.RESET} ${reasonLabel}`);
        print(`${A.DIM}  │ Name   :${A.RESET} ${data.name}`);
        print(`${A.DIM}  │ Email  :${A.RESET} ${data.email}`);
        print(`${A.DIM}  │ Message:${A.RESET} ${data.message}`);
        print('');
        print(`${A.GREEN}  Enter → Send${A.RESET}  ${A.DIM}│${A.RESET}  ${A.YELLOW}Esc → Cancel${A.RESET}`);
    }

    // ── Validate + store current text field ───────────────────────
    function validateAndSet(value) {
        const v = value.trim();
        if (step === 1) {
            if (v.length < 2) {
                print(`${A.RED}  ⚠ Name must be at least 2 characters.${A.RESET}`);
                renderTextPrompt();
                return false;
            }
            data.name = v;
            return true;
        }
        if (step === 2) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
                print(`${A.RED}  ⚠ Please enter a valid email address.${A.RESET}`);
                renderTextPrompt();
                return false;
            }
            data.email = v;
            return true;
        }
        if (step === 3) {
            if (v.length < 5) {
                print(`${A.RED}  ⚠ Message must be at least 5 characters.${A.RESET}`);
                renderTextPrompt();
                return false;
            }
            data.message = v;
            return true;
        }
        return true;
    }

    // ── Advance to next step ──────────────────────────────────────
    function advance() {
        step++;
        if (step >= 1 && step <= 3) { renderTextPrompt(); return 'input'; }
        if (step === 4)              { renderConfirm();    return 'confirm'; }
        return null;
    }

    // ── Submit to /api/contact ────────────────────────────────────
    async function submit() {
        if (submitting) return;
        submitting = true;

        print('');
        print('\x1b[90m  ⟳ Sending...\x1b[0m');

        try {
            const res  = await fetch('/api/contact', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(data)
            });
            const json = await res.json();

            if (res.ok && json.ok) {
                print('');
                print(`\x1b[1;32m  ✓ ${json.message}\x1b[0m`);
                pulse();

                // Track submission — fire and forget
                fetch('/api/track', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ event: 'contact_submit', reason: data.reason })
                }).catch(() => {});

            } else {
                print(`\x1b[31m  ✗ ${json.error || 'Something went wrong.'}\x1b[0m`);
                if (res.status === 429) {
                    print('\x1b[90m    Rate limited — try again in a few minutes.\x1b[0m');
                }
            }
        } catch (err) {
            print(`\x1b[31m  ✗ Network error: ${err.message}\x1b[0m`);
            print('\x1b[90m    Email prajwal@hcprajwal.in directly.\x1b[0m');
        }

        print('');
        submitting = false;
        active     = false;
        onDone();
    }

    // ── Public: start the form ────────────────────────────────────
    function start() {
        active    = true;
        step      = 0;
        reasonIdx = 0;
        data.reason = data.name = data.email = data.message = '';

        print('');
        print(`${A.CYAN_B}◇  Contact Form${A.RESET}`);
        print(`${A.DIM}│  Navigate with ↑↓, confirm with Enter, Esc to cancel.${A.RESET}`);
        print('');
        renderReason();
    }

    // ── Public: route key events from terminal.js ─────────────────
    function handleKey(key, inputValue) {
        if (key === 'Escape') {
            active = false;
            print('\x1b[90m  contact form cancelled.\x1b[0m');
            print('');
            onDone();
            return { consumed: true, mode: 'shell' };
        }

        if (step === 0) {
            if (key === 'ArrowUp') {
                reasonIdx = Math.max(0, reasonIdx - 1);
                renderReason();
                return { consumed: true };
            }
            if (key === 'ArrowDown') {
                reasonIdx = Math.min(REASONS.length - 1, reasonIdx + 1);
                renderReason();
                return { consumed: true };
            }
            if (key === 'Enter') {
                data.reason = REASONS[reasonIdx].value;
                const mode = advance();
                return { consumed: true, mode };
            }
            return { consumed: true };
        }

        if (step >= 1 && step <= 3 && key === 'Enter') {
            if (validateAndSet(inputValue)) {
                print(`\x1b[32m  ✓\x1b[0m ${inputValue.trim()}`);
                const mode = advance();
                return { consumed: true, mode, clearInput: true };
            }
            return { consumed: true };
        }

        if (step === 4 && key === 'Enter') {
            submit();
            return { consumed: true, mode: 'submitting' };
        }

        return { consumed: false };
    }

    return { start, handleKey, isActive: () => active };
}
