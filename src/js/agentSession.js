import { streamAgent } from './chat.js';
import { A } from './ansi.js';

/**
 * agentSession.js : the on-screen part of asking the AI agent a question:
 * the "thinking" dots, the streamed answer with a cursor, errors, and stopping with Ctrl+C.
 */
export function createAgentSession({ render, input, onFinished }) {
    const { print, pulse, setStatus, output, scrollToEnd } = render;
    let busy  = false;
    let abort = null;

    function release() {
        busy = false;
        abort = null;
        input.disabled = false;
        input.focus();
        onFinished();
    }

    function ask(query) {
        if (busy) { print(`${A.YELLOW}  Agent is busy. Please wait.${A.RESET}`); return; }

        busy = true;
        abort = new AbortController();
        input.disabled = true;
        setStatus('thinking', 'agent • thinking');

        // "hc_agent ... thinking" line, replaced by the answer when the first word arrives
        const thinking = document.createElement('span');
        thinking.className = 'line';
        thinking.innerHTML = `
            <span class="agent-label">◈ hc_agent
                <span class="model-tag">[llama-3.1-8b]</span>
            </span>
            <span class="thinking-dots"><span></span><span></span><span></span></span>
            <span class="model-tag"> Ctrl+C to stop</span>`;
        output.appendChild(thinking);
        scrollToEnd();

        const answerLine = document.createElement('span');
        answerLine.className = 'line';
        const block  = document.createElement('span');
        block.className = 'agent-block';
        const cursor = document.createElement('span');
        cursor.className = 'agent-cursor';
        block.appendChild(cursor);
        answerLine.appendChild(block);

        let text = '';
        let started = false;

        const removeTemporary = () => { thinking.remove(); answerLine.remove(); };

        streamAgent(query, {
            signal: abort.signal,

            onChunk(token) {
                if (!started) {
                    started = true;
                    thinking.remove();
                    output.appendChild(answerLine);
                    setStatus('streaming', 'agent • streaming');
                }
                text += token;
                block.textContent = text;
                block.appendChild(cursor);
                scrollToEnd();
            },

            onDone() {
                cursor.remove();
                block.textContent = text;
                print('');
                setStatus('', 'agent • standby');
                pulse();
                release();
            },

            onError(msg) {
                removeTemporary();
                print(`${A.RED}  ✗ ${msg}${A.RESET}`);
                print('');
                setStatus('error', 'agent • error');
                setTimeout(() => setStatus('', 'agent • standby'), 3000);
                release();
            },

            onAbort() {
                cursor.remove();
                thinking.remove();
                print(`${A.DIM}  ^C stopped${A.RESET}`);
                print('');
                setStatus('', 'agent • standby');
                release();
            },
        });
    }

    return {
        ask,
        isBusy: () => busy,
        /** Stops the answer that is currently streaming (Ctrl+C). */
        cancel: () => abort?.abort(),
    };
}
