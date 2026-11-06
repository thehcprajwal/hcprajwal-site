/**
 * render.js : everything that writes to the terminal screen.
 * Text is written with ANSI colour codes (see ansi.js) and converted to HTML here.
 */

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

/** Returns the helpers that draw on screen. `app` is the whole terminal window element. */
export function createRenderer({ output, app, statusEl }) {
    const scrollToEnd = () => { output.scrollTop = output.scrollHeight; };

    /** Adds one line of (coloured) text. Returns the element so it can be removed later. */
    function print(text = '') {
        const el = document.createElement('span');
        el.className = 'line fade-in';
        el.innerHTML = ansiToHtml(text);
        output.appendChild(el);
        scrollToEnd();
        return el;
    }

    /** Echoes the command the visitor typed, like a shell does. */
    function printPrompt(cmd) {
        print(`\x1b[1;32mguest@hc_system\x1b[0m:\x1b[36m~\x1b[0m$ ${cmd}`);
    }

    /** A short glow on the terminal window. */
    function pulse() {
        app.classList.remove('pulse');
        void app.offsetWidth;                       // restart the CSS animation
        app.classList.add('pulse');
        setTimeout(() => app.classList.remove('pulse'), 800);
    }

    /** Updates the small "agent - standby" label in the title bar. */
    function setStatus(state, text) {
        statusEl.className   = state;
        statusEl.textContent = text;
    }

    function clear() { output.innerHTML = ''; }

    return { print, printPrompt, pulse, setStatus, clear, scrollToEnd, output };
}
