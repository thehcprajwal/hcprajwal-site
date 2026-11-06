/**
 * background.js : loads the three.js particle background AFTER the terminal is on screen.
 *
 * three.js is the biggest file on the site (about 130 KB compressed). Loading it lazily means the
 * terminal appears first. Visitors who prefer reduced motion never download it at all.
 */
let bg = null;

export async function loadBackground() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    bg = await import('./three-bg.js');
    bg.initThreeBackground();
}

/** Starts or stops the "matrix rain" shown when the visitor has been idle. No-op until loaded. */
export function setIdle(isIdle) { bg?.setIdle(isIdle); }
