import { A } from '../ansi.js';

export default {
    name: 'reset',
    desc: 'Reset agent memory',
    run({ print, resetMemory }) {
        resetMemory();
        print('');
        print(`${A.GREEN}  ✓ Agent memory cleared.${A.RESET}`);
        print('');
    },
};
