/**
 * chat.js : talks to /api/agent and reads the streamed answer.
 * Keeps a short rolling memory of the conversation, saved in sessionStorage so it
 * survives a page reload (but not closing the tab).
 */

const MAX_MEMORY  = 12;
const STORAGE_KEY = 'hc_agent_memory';

let memory = loadMemory();

function loadMemory() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}

function saveMemory() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch { /* storage blocked */ }
}

function remember(role, content) {
    memory.push({ role, content });
    if (memory.length > MAX_MEMORY) memory = memory.slice(-MAX_MEMORY);
    saveMemory();
}

export const memorySize = () => memory.length;

export function resetMemory() {
    memory = [];
    saveMemory();
}

/**
 * Sends a question and streams the answer.
 *   onChunk(token)  called for each piece of text as it arrives
 *   onDone(text)    the full answer, when finished
 *   onError(msg)    something went wrong
 *   onAbort()       the visitor stopped it (Ctrl+C)
 * `signal` is an AbortSignal; abort it to stop the request.
 */
export async function streamAgent(query, { signal, onChunk, onDone, onError, onAbort }) {
    const messages = [...memory, { role: 'user', content: query }];

    try {
        const res = await fetch('/api/agent', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ messages }),
            signal,
        });

        if (!res.ok) {
            if (res.status === 429) { onError('Too many questions in a short time. Please try again in a few minutes.'); return; }
            const err = await res.json().catch(() => ({ error: res.statusText }));
            onError(err.error || 'Server error');
            return;
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText  = '';
        let buffer    = '';

        const finish = () => { remember('user', query); remember('assistant', fullText); onDone(fullText); };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();                         // keep the unfinished last line for next time

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();

                if (data === '[DONE]') { finish(); return; }

                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) { onError(parsed.error); return; }
                    if (parsed.token) { fullText += parsed.token; onChunk(parsed.token); }
                } catch { /* ignore a malformed line */ }
            }
        }

        // The stream ended without [DONE]. Still finish, so the input does not stay locked.
        if (fullText) finish();
        else onError('Stream ended unexpectedly.');

    } catch (err) {
        if (err.name === 'AbortError') onAbort();
        else onError(err.message || 'Network error. Is the server running?');
    }
}
