import { A } from '../ansi.js';

export default {
    name: 'resume',
    desc: 'View my resume',
    run({ print, pulse, profile }) {
        // A hidden link click is used so browsers treat it as a normal user-initiated new tab.
        const a = document.createElement('a');
        a.href = profile.resumeUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();

        print('');
        print(`  ${A.GREEN}✓${A.RESET} Opening resume in a new tab...`);
        print('');
        pulse();
    },
};
