/**
 * terminal.js : the controller that ties the terminal together.
 *
 * It owns the input box and the keyboard, and hands the real work to small modules:
 *   render.js        drawing text on screen
 *   commands/        what each command does (help, skills, projects, ...)
 *   agentSession.js  asking the AI agent and showing the streamed answer
 *   contact.js       the step-by-step contact form
 *   autocomplete.js  the grey "ghost" suggestion and hint bar
 *   history.js       up and down arrow recall
 *   boot.js          the start-up animation
 */
import { profile }                  from '../../shared/profile.js';
import { createRenderer }           from './render.js';
import { createHistory }            from './history.js';
import { createAgentSession }       from './agentSession.js';
import { createContactForm }        from './contact.js';
import { initAutocomplete }         from './autocomplete.js';
import { runBoot }                  from './boot.js';
import { resetMemory, memorySize }  from './chat.js';
import { setIdle }                  from './background.js';
import { COMMANDS, findCommand, suggestCommand } from './commands/index.js';
import { A } from './ansi.js';

const IDLE_AFTER_MS = 45_000;   // matrix rain starts after this long without activity

export function initTerminal() {
    // ── Page elements ──────────────────────────────────────────────
    const app      = document.getElementById('app');
    const cmdInput = document.getElementById('cmd-input');
    const ghostEl  = document.getElementById('ghost-text');
    const hintBar  = document.getElementById('hint-bar');

    const render = createRenderer({
        output:   document.getElementById('output'),
        app,
        statusEl: document.getElementById('agent-status'),
    });
    const { print, printPrompt, pulse, clear } = render;

    const history = createHistory();
    let formMode  = null;      // null while in the shell, otherwise which contact-form step is active
    let idleTimer = null;

    // The matrix rain starts when nobody has touched the terminal for a while.
    function resetIdleTimer() {
        setIdle(false);
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => setIdle(true), IDLE_AFTER_MS);
    }

    // ── Pieces ─────────────────────────────────────────────────────
    const { accept, updateGhost } = initAutocomplete({
        input:    cmdInput,
        ghost:    ghostEl,
        hintBar,
        commands: COMMANDS.map((c) => ({ cmd: c.name, desc: c.desc })),
    });

    const agent = createAgentSession({ render, input: cmdInput, onFinished: resetIdleTimer });

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
        },
    });

    // What a command is allowed to use. Commands never touch the page directly.
    const context = {
        profile,
        commands: COMMANDS,
        print,
        pulse,
        clear,
        resetMemory,
        askAgent:     (query) => agent.ask(query),
        startContact: () => { formMode = 'reason'; contactForm.start(); },
    };

    // ── Running a command ──────────────────────────────────────────
    function processCommand(raw) {
        const trimmed = raw.trim();
        if (!trimmed) return;

        history.add(trimmed);
        printPrompt(trimmed);
        pulse();

        const [word, ...rest] = trimmed.split(/\s+/);
        const name = word.toLowerCase();
        const command = findCommand(name);

        if (command) {
            command.run(context, rest.join(' '));
            return;
        }

        // Unknown command: suggest the closest one if it looks like a typo
        const close = suggestCommand(name);
        print('');
        print(`  ${A.RED}Command not found: ${name}${A.RESET}`);
        print(close
            ? `  Did you mean ${A.GREEN_B}${close}${A.RESET}? (Tab to autocomplete)`
            : `  Type ${A.GREEN_B}help${A.RESET} to see what is available.`);
        print('');
    }

    // ── Keyboard: while the contact form is active ─────────────────
    function handleContactKey(e) {
        const result = contactForm.handleKey(e.key, cmdInput.value);
        if (!result.consumed) return;
        e.preventDefault();

        if (result.clearInput) cmdInput.value = '';

        switch (result.mode) {
            case 'input':
                formMode = 'input';
                cmdInput.placeholder = 'Type here...';
                cmdInput.disabled = false;
                cmdInput.focus();
                break;
            case 'confirm':
                formMode = 'confirm';
                cmdInput.placeholder = '';
                cmdInput.value = '';
                break;
            case 'submitting':
                formMode = 'submitting';
                cmdInput.disabled = true;
                cmdInput.placeholder = 'sending...';
                break;
            case 'shell':
                formMode = null;
                cmdInput.placeholder = '';
                cmdInput.value = '';
                cmdInput.disabled = false;
                break;
        }
    }

    // ── Keyboard: normal shell ─────────────────────────────────────
    function handleShellKey(e) {
        const atEnd = cmdInput.selectionStart === cmdInput.value.length;

        if (e.key === 'Tab' || (e.key === 'ArrowRight' && atEnd)) {
            e.preventDefault();
            accept();
        } else if (e.key === 'Escape') {
            cmdInput.value = '';
            updateGhost();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (agent.isBusy()) return;
            const value = cmdInput.value;
            cmdInput.value = '';
            ghostEl.textContent = '';
            hintBar.classList.remove('visible');
            processCommand(value);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const older = history.older();
            if (older !== null) { cmdInput.value = older; updateGhost(); }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            cmdInput.value = history.newer();
            updateGhost();
        }
    }

    cmdInput.addEventListener('input', () => {
        if (!formMode) updateGhost();
        resetIdleTimer();
    });

    cmdInput.addEventListener('keydown', (e) => {
        resetIdleTimer();
        if (contactForm.isActive()) handleContactKey(e);
        else handleShellKey(e);
    });

    // Ctrl+C stops a streaming answer. (The input is disabled while the agent answers,
    // so this listens on the whole page.)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'c' && agent.isBusy()) {
            e.preventDefault();
            agent.cancel();
        }
    });

    app.addEventListener('click', () => { if (!formMode) cmdInput.focus(); });

    // ── Start ──────────────────────────────────────────────────────
    runBoot({
        print,
        pulse,
        restoredMessages: memorySize(),
        onReady() {
            cmdInput.focus();
            resetIdleTimer();
        },
    });
}
