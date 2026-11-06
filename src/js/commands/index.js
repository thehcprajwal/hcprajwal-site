/**
 * The command list. To add a command: create commands/<name>.js exporting
 * { name, desc, run(ctx, args) } and add it to COMMANDS below.
 * `help`, autocomplete and "did you mean" suggestions all read this one list.
 */
import help     from './help.js';
import whoami   from './whoami.js';
import skills   from './skills.js';
import projects from './projects.js';
import contact  from './contact.js';
import agent    from './agent.js';
import resume   from './resume.js';
import reset    from './reset.js';
import clear    from './clear.js';

export const COMMANDS = [help, whoami, skills, projects, contact, agent, resume, reset, clear];

export const findCommand = (name) => COMMANDS.find((c) => c.name === name);

/** How many single-character edits turn a into b (used to spot typos). */
function distance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => i || j));
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

/** The closest command to a mistyped one, or undefined if nothing is close. */
export const suggestCommand = (typed) =>
    COMMANDS.map((c) => c.name).find((name) => distance(typed, name) <= 2);
