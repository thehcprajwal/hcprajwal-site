/**
 * autocomplete.js — fish-style ghost text + hint bar
 * Pure UI module; no knowledge of commands or terminal state.
 */

export function initAutocomplete({ input, ghost, hintBar, commands }) {
    const names = commands.map(c => c.cmd);

    function getBestMatch(typed) {
        if (!typed) return null;
        const t = typed.toLowerCase();
        return names.find(n => n.startsWith(t)) || null;
    }

    function updateGhost() {
        const typed = input.value;
        const match = getBestMatch(typed);
        ghost.textContent = (match && typed && match !== typed)
            ? typed + match.slice(typed.length)
            : '';
        updateHintBar(typed);
    }

    function accept() {
        const match = getBestMatch(input.value);
        if (match && match !== input.value) {
            input.value = match;
            updateGhost();
        }
    }

    function updateHintBar(typed) {
        hintBar.innerHTML = '';
        if (!typed) { hintBar.classList.remove('visible'); return; }

        const t       = typed.toLowerCase();
        const matches = commands.filter(c => c.cmd.startsWith(t) && c.cmd !== t);

        if (!matches.length) { hintBar.classList.remove('visible'); return; }

        matches.forEach((m, i) => {
            const item = document.createElement('div');
            item.className = 'hint-item' + (i === 0 ? ' active-hint' : '');
            item.innerHTML = `<span class="hint-cmd">${m.cmd}</span>
                              <span class="hint-desc">${m.desc}</span>`;
            item.addEventListener('click', () => {
                input.value = m.cmd;
                updateGhost();
                input.focus();
            });
            hintBar.appendChild(item);
        });

        hintBar.classList.add('visible');
    }

    input.addEventListener('input', updateGhost);

    return { accept, updateGhost };
}
