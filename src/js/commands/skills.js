import { A } from '../ansi.js';

const BAR = 20;   // characters in a skill bar

export default {
    name: 'skills',
    desc: 'Tech skills matrix',
    run({ print, profile }) {
        print('');
        print(`  ${A.YELLOW}● Languages${A.RESET}`);
        for (const { name, level } of profile.languages) {
            const filled = Math.round((level / 100) * BAR);
            const bar = `${A.GREEN}${'█'.repeat(filled)}${A.DIM}${'░'.repeat(BAR - filled)}${A.RESET}`;
            print(`    ${name.padEnd(12)} ${bar}  ${level}%`);
        }
        print('');
        for (const { group, items } of profile.skills) {
            print(`  ${A.YELLOW}● ${group}${A.RESET}`);
            print(`    ${items.join('  ')}`);
            print('');
        }
    },
};
