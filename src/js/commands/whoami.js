import { A } from '../ansi.js';

export default {
    name: 'whoami',
    desc: 'About Prajwal HC',
    run({ print, profile }) {
        print('');
        print(`  ${A.CYAN_B}${profile.name}${A.RESET} - ${profile.role}`);
        print(`  ${profile.location}`);
        print('');
        print(`  ${A.YELLOW}Current Focus${A.RESET}  →  ${profile.focus}`);
        print(`  ${A.YELLOW}Open to${A.RESET}        →  ${profile.openTo}`);
        print(`  ${A.YELLOW}GitHub${A.RESET}         →  ${A.CYAN}${profile.github}${A.RESET}`);
        print('');
    },
};
