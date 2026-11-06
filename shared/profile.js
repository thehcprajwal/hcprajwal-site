/**
 * Everything about you lives here, once.
 * The terminal commands (whoami, skills, projects) and the chat agent's instructions are both
 * built from this file, so they can never disagree. Edit this file when your details change.
 *
 * It is imported by the browser code (src/) and by the server (server/), so keep it plain data.
 */
export const profile = {
    name:     'Prajwal HC',
    role:     'Backend & Automation Engineer',
    location: 'Bangalore, India',
    github:   'github.com/prajwalhc',
    email:    'hello@hcprajwal.in',
    resumeUrl: 'https://github.com/prajwalhc/resume/releases/latest',

    focus:  'Workflow automation · WebSocket systems · AI tooling',
    openTo: 'Backend engineering roles · Freelance automation projects',

    // level is a percentage, shown as a bar in the terminal
    languages: [
        { name: 'TypeScript', level: 90 },
        { name: 'JavaScript', level: 82 },
        { name: 'Python',     level: 78 },
        { name: 'Bash',       level: 65 },
    ],

    skills: [
        { group: 'Backend',        items: ['Node.js', 'Hono', 'FastAPI', 'WebSockets', 'REST APIs'] },
        { group: 'Automation',     items: ['n8n', 'Zapier', 'Webhook pipelines', 'Cron scheduling'] },
        { group: 'Infrastructure', items: ['AWS (Lambda, CloudFront)', 'Docker', 'Caddy', 'Nginx', 'Linux'] },
        { group: 'Databases',      items: ['SQLite', 'PostgreSQL', 'MongoDB', 'Redis'] },
        { group: 'AI / ML',        items: ['LangChain', 'OpenRouter', 'OpenAI API', 'RAG pipelines', 'n8n AI nodes'] },
    ],

    projects: [
        {
            name:    'hc_system',
            summary: 'Terminal portfolio with an AI agent, fish-style autocomplete and a contact form, running serverless on AWS.',
            stack:   ['Node.js', 'Hono', 'Three.js', 'AWS Lambda', 'CloudFront'],
        },
        {
            name:    'AutoFlow Engine',
            summary: 'Webhook-driven pipeline orchestrator integrating 10+ third-party APIs with retry logic and dead-letter queues.',
            stack:   ['Node.js', 'n8n', 'Redis', 'PostgreSQL'],
        },
        {
            name:    'RAG Document Assistant',
            summary: 'Retrieval-augmented generation for querying internal knowledge bases with citations and confidence scores.',
            stack:   ['Python', 'FastAPI', 'LangChain', 'OpenRouter', 'Pinecone'],
        },
    ],
};
