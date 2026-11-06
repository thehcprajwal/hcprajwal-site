/**
 * main.js : entry point.
 * The terminal starts immediately. The 3D background loads once the browser is idle.
 */
import { initTerminal }     from './terminal.js';
import { loadBackground }   from './background.js';

document.addEventListener('DOMContentLoaded', () => {
    initTerminal();
    const later = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
    later(() => loadBackground());
});
