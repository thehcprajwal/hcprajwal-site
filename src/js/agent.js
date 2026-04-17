/**
 * agent.js — streams from /api/agent backend proxy
 * Keeps rolling conversation memory in the frontend session.
 */

const MAX_MEMORY = 12;
let memory = [];

export function resetMemory() {
    memory = [];
}

function addToMemory(role, content) {
    memory.push({ role, content });
    if (memory.length > MAX_MEMORY) {
        memory = memory.slice(-MAX_MEMORY);
    }
}

export async function streamAgent(query, { onChunk, onDone, onError }) {
    const messages = [...memory, { role: 'user', content: query }];

    try {
        const res = await fetch('/api/agent', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ messages })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            onError(err.error || 'Server error');
            return;
        }

        const reader   = res.body.getReader();
        const decoder  = new TextDecoder();
        let fullText   = '';
        let buffer     = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // hold incomplete line

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();

                if (data === '[DONE]') {
                    addToMemory('user', query);
                    addToMemory('assistant', fullText);
                    onDone(fullText);
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) { onError(parsed.error); return; }
                    if (parsed.token) { fullText += parsed.token; onChunk(parsed.token); }
                } catch (_) {}
            }
        }

    } catch (err) {
        onError(err.message || 'Network error — is the server running?');
    }
}
