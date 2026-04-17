/**
 * main.js — entry point, wires HCBg + HCTerminal together
 */
window.addEventListener('load', () => {
    HCBg.init();

    HCTerminal.init({
        onIdle: (idle) => HCBg.setIdle(idle)
    });

    HCTerminal.start();
});
