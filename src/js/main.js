/**
 * main.js — entry point
 * Three.js and terminal are self-contained; no wiring needed.
 */
import { initThreeBackground } from './three-bg.js';
import { initTerminal }        from './terminal.js';

document.addEventListener('DOMContentLoaded', () => {
    initThreeBackground();
    initTerminal();
});
