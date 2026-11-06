import { A } from '../ansi.js';

export default {
    name: 'agent',
    desc: 'Ask the AI agent',
    run({ print, askAgent }, args) {
        // accept: agent <question>   or   agent --ask "<question>"
        const query = args
            .replace(/^--ask\s*/i, '')
            .replace(/^["']|["']$/g, '')
            .trim();

        print('');
        if (!query) {
            print(`  Usage:   ${A.GREEN}agent <your question>${A.RESET}`);
            print(`  Example: ${A.GREEN}agent do you have n8n experience?${A.RESET}`);
            print('');
            return;
        }
        askAgent(query);
    },
};
