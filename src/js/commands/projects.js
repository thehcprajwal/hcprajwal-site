import { A } from '../ansi.js';

const WRAP = 56;   // characters per line of description

/** Splits text into lines no longer than `width`, breaking on spaces. */
function wrap(text, width) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
        if ((line + ' ' + word).trim().length > width) { lines.push(line); line = word; }
        else line = (line + ' ' + word).trim();
    }
    if (line) lines.push(line);
    return lines;
}

export default {
    name: 'projects',
    desc: 'Portfolio projects',
    run({ print, profile }) {
        print('');
        profile.projects.forEach((p, i) => {
            print(`  ${A.GREEN_B}▸ ${p.name}${A.RESET}`);
            wrap(p.summary, WRAP).forEach((line) => print(`    ${line}`));
            print(`    ${A.DIM}Stack: ${p.stack.join(' · ')}${A.RESET}`);
            print('');
            if (i < profile.projects.length - 1) {
                print(`  ${A.DIM}${'╌'.repeat(48)}${A.RESET}`);
                print('');
            }
        });
    },
};
