/**
 * terminal.js — xterm.js setup, boot sequence, command handler
 * Exposed as window.HCTerminal
 */
window.HCTerminal = (() => {
    const PROMPT = '\r\n\x1b[1;32mguest@hc_system\x1b[0m:\x1b[34m~\x1b[0m$ ';
    const IDLE_DELAY = 45_000;

    const BOOT_LINES = [
        '\x1b[1;32m[OK]\x1b[0m Initializing hc_system v1.0.0...',
        '\x1b[1;32m[OK]\x1b[0m Mounting virtual filesystem...',
        '\x1b[1;32m[OK]\x1b[0m Establishing secure connection...',
        '\x1b[1;32m[OK]\x1b[0m Loading developer profile...',
        '\x1b[1;32m[OK]\x1b[0m Waking up background agents...'
    ];

    const COMMANDS = {
        help() {
            term.writeln('\n\x1b[1;32m┌─ Commands ──────────────────────────────────────┐\x1b[0m');
            term.writeln('  whoami     About me');
            term.writeln('  projects   My projects');
            term.writeln('  skills     Technical skills');
            term.writeln('  agent      Talk to my AI assistant');
            term.writeln('  contact    Send me a message');
            term.writeln('  clear      Clear terminal');
            term.writeln('\x1b[1;32m└────────────────────────────────────────────────┘\x1b[0m');
        },
        whoami() {
            term.writeln('\n\x1b[1;36mPrajwal HC\x1b[0m — Backend & Automation Engineer');
            term.writeln('Bangalore, India');
            term.writeln('Building systems, workflows and developer tools.');
        },
        clear() {
            term.clear();
        },
        projects() {
            term.writeln('\n\x1b[33m[PROJECTS] Coming soon in next iteration...\x1b[0m');
        },
        skills() {
            term.writeln('\n\x1b[33m[SKILLS] Coming soon in next iteration...\x1b[0m');
        },
        contact() {
            term.writeln('\n\x1b[33m[CONTACT] Coming soon in next iteration...\x1b[0m');
        },
        agent() {
            term.writeln('\n\x1b[2m[Agentic System Processing...]\x1b[0m');
            setTimeout(() => {
                term.writeln('\nI specialize in workflow automation, WebSocket systems, and n8n pipelines.');
                term.write(PROMPT);
            }, 700);
            return true; // signals async — skip default prompt write
        }
    };

    let term, fitAddon;
    let inputBuffer  = '';
    let inputEnabled = false;
    let idleTimer    = null;
    let onIdleChange = null;

    function pulseGlow() {
        const app = document.getElementById('app');
        app.classList.remove('glow');
        void app.offsetWidth; // reflow to restart animation
        app.classList.add('glow');
        setTimeout(() => app.classList.remove('glow'), 800);
    }

    function resetIdleTimer() {
        if (onIdleChange) onIdleChange(false);
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            if (onIdleChange) onIdleChange(true);
        }, IDLE_DELAY);
    }

    function runBoot(index = 0) {
        if (index < BOOT_LINES.length) {
            term.writeln(BOOT_LINES[index]);
            pulseGlow();
            setTimeout(() => runBoot(index + 1), 320);
        } else {
            term.writeln('');
            term.write("Welcome to hc_system. Type \x1b[1;32mhelp\x1b[0m to begin.");
            term.write(PROMPT);
            inputEnabled = true;
            resetIdleTimer();
        }
    }

    function processCommand(raw) {
        resetIdleTimer();
        const cmd = raw.toLowerCase().trim();
        const handler = COMMANDS[cmd] || COMMANDS[cmd.split(' ')[0]];

        if (handler) {
            const async = handler();
            if (async) return;
        } else if (cmd !== '') {
            term.writeln(`\x1b[31mCommand not found: ${cmd}\x1b[0m. Try 'help'.`);
        }

        term.write(PROMPT);
    }

    function bindKeys() {
        term.onKey(({ key, domEvent }) => {
            if (!inputEnabled) return;

            if (domEvent.key === 'Enter') {
                term.write('\r\n');
                processCommand(inputBuffer);
                inputBuffer = '';
            } else if (domEvent.key === 'Backspace') {
                if (inputBuffer.length > 0) {
                    inputBuffer = inputBuffer.slice(0, -1);
                    term.write('\b \b');
                }
            } else if (key.length === 1) {
                inputBuffer += key;
                term.write(key);
            }
        });
    }

    function init({ onIdle } = {}) {
        onIdleChange = onIdle || null;

        term = new Terminal({
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14.5,
            lineHeight: 1.6,
            cursorBlink: true,
            theme: {
                background: '#0f1416',
                foreground: '#d4d4d4',
                cursor: '#39ff14',
                green: '#39ff14',
                cyan: '#56b6c2',
                yellow: '#f6c177',
                red: '#ef6b73'
            }
        });

        fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(document.getElementById('terminal'));
        fitAddon.fit();

        bindKeys();
        window.addEventListener('resize', () => fitAddon.fit());
        document.getElementById('app').addEventListener('click', () => term.focus());
    }

    function start() {
        setTimeout(() => runBoot(0), 800);
    }

    return { init, start };
})();
