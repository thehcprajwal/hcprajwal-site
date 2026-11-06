import { A } from '../ansi.js';

const WIDTH = 54;   // inner width of the box

export default {
    name: 'help',
    desc: 'Show all commands',
    run({ print, commands }) {
        const title  = '─ Commands ';
        const top    = `┌${title}${'─'.repeat(WIDTH - title.length)}┐`;
        const bottom = `└${'─'.repeat(WIDTH)}┘`;

        print('');
        print(`${A.GREEN_B}${top}${A.RESET}`);
        for (const c of commands) {
            const row = `  ${c.name.padEnd(12)}${c.desc}`.padEnd(WIDTH);
            print(`${A.GREEN_B}│${A.RESET}${row}${A.GREEN_B}│${A.RESET}`);
        }
        print(`${A.GREEN_B}${bottom}${A.RESET}`);
        print('');
    },
};
