import { A } from './ansi.js';

const BOOT_LINES = [
    `${A.GREEN_B}[OK]${A.RESET} Initializing hc_system v1.0.0...`,
    `${A.GREEN_B}[OK]${A.RESET} Mounting virtual filesystem...`,
    `${A.GREEN_B}[OK]${A.RESET} Establishing secure connection...`,
    `${A.GREEN_B}[OK]${A.RESET} Loading developer profile...`,
    `${A.GREEN_B}[OK]${A.RESET} Waking up background agents...`,
];

/** Plays the fake start-up messages, then the welcome text. */
export function runBoot({ print, pulse, restoredMessages, onReady }) {
    let i = 0;

    function next() {
        if (i < BOOT_LINES.length) {
            print(BOOT_LINES[i++]);
            pulse();
            setTimeout(next, 320);
            return;
        }
        print('');
        print(`  Welcome to ${A.GREEN_B}hc_system${A.RESET}. Type ${A.GREEN_B}help${A.RESET} to begin.`);
        print(`  Try ${A.GREEN}contact${A.RESET} to send a message or ${A.GREEN}agent tell me about yourself${A.RESET}.`);
        if (restoredMessages > 0) {
            print(`${A.DIM}  Restored ${restoredMessages} earlier chat messages. Type reset to start fresh.${A.RESET}`);
        }
        print('');
        onReady();
    }

    setTimeout(next, 500);
}
