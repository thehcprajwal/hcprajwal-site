/**
 * analytics.js — dashboard render + polling
 * Fetches GET /api/analytics and renders inline inside #analytics-block.
 */

let _pollTimer = null;
let _active    = false;
let _password  = '';
let _print     = null;
let _refs      = null;

const FLAG_MAP = {
    IN: '🇮🇳', US: '🇺🇸', DE: '🇩🇪', GB: '🇬🇧', SG: '🇸🇬',
    AU: '🇦🇺', CA: '🇨🇦', FR: '🇫🇷', NL: '🇳🇱', JP: '🇯🇵',
    BR: '🇧🇷', KR: '🇰🇷', PK: '🇵🇰', BD: '🇧🇩', AE: '🇦🇪'
};

const REASON_LABELS = {
    job:     'Job opportunity',
    project: 'Project discussion',
    collab:  'Collaboration',
    hi:      'Just saying hi'
};

export function initAnalytics({ refs, print }) {
    _refs  = refs;
    _print = print;
}

export function isAnalyticsActive() { return _active; }

// ── Open ──────────────────────────────────────────────────────────
export async function openAnalytics(password) {
    _password = password;
    _active   = true;
    _refs.analyticsBlock.classList.add('visible');

    renderLoading();
    await refresh();

    _pollTimer = setInterval(refresh, 30_000);
}

// ── Close ─────────────────────────────────────────────────────────
export function closeAnalytics() {
    _active = false;
    clearInterval(_pollTimer);
    _pollTimer = null;
    _refs.analyticsBlock.innerHTML = '';
    _refs.analyticsBlock.classList.remove('visible');
}

// ── Fetch + render ────────────────────────────────────────────────
async function refresh() {
    try {
        const res = await fetch('/api/analytics?days=30', {
            headers: { 'x-analytics-password': _password }
        });

        if (res.status === 401) {
            closeAnalytics();
            _print('\x1b[31m  ✗ Wrong password.\x1b[0m');
            _print('');
            return;
        }

        if (!res.ok) throw new Error(`Server error ${res.status}`);

        render(await res.json());

    } catch (err) {
        const errEl = _refs.analyticsBlock.querySelector('.analytics-error');
        if (errEl) errEl.textContent = `⚠  ${err.message}`;
    }
}

// ── Loading placeholder ───────────────────────────────────────────
function renderLoading() {
    _refs.analyticsBlock.innerHTML = `
        <div class="analytics-loading">
            Fetching analytics
            <span class="thinking-dots">
                <span></span><span></span><span></span>
            </span>
        </div>`;
}

// ── Main render ───────────────────────────────────────────────────
function render(d) {
    const el   = _refs.analyticsBlock;
    const time = new Date(d.generatedAt).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit'
    });

    el.innerHTML = `
        <div class="analytics-wrap">

            <div class="a-header">
                <span class="a-title">◈ hc_system analytics</span>
                <span class="a-meta">last ${d.days} days · auto-refresh 30s · ${time}</span>
                <span class="a-close" id="analytics-close">✕ close</span>
            </div>

            <div class="a-grid">

                <div class="a-card">
                    <div class="a-card-title">Visitors</div>
                    <div class="a-stat-row">
                        <span class="a-num">${d.visitors.total}</span>
                        <span class="a-label">total views</span>
                    </div>
                    <div class="a-stat-row">
                        <span class="a-num a-accent">${d.visitors.unique}</span>
                        <span class="a-label">unique</span>
                    </div>
                    <div class="a-stat-row">
                        <span class="a-num a-dim">${d.visitors.avgPerDay}</span>
                        <span class="a-label">avg / day</span>
                    </div>
                    <div class="a-stat-row">
                        <span class="a-num a-dim">${d.session.avgCommands}</span>
                        <span class="a-label">avg cmds / session</span>
                    </div>
                </div>

                <div class="a-card">
                    <div class="a-card-title">Commands
                        <span class="a-card-sub">${d.commands.total} total</span>
                    </div>
                    <div class="a-cmd-list">
                        ${renderCommands(d.commands.ranked, d.commands.total)}
                    </div>
                </div>

                <div class="a-card">
                    <div class="a-card-title">Top Locations</div>
                    <div class="a-country-list">
                        ${renderCountries(d.countries)}
                    </div>
                </div>

                <div class="a-card">
                    <div class="a-card-title">AI Agent
                        <span class="a-card-sub">${d.agent.totalQueries} queries</span>
                    </div>
                    <div class="a-label a-muted">top keywords</div>
                    <div class="a-tags">
                        ${(d.agent.topWords || []).map(w =>
                            `<span class="a-tag">${w}</span>`
                        ).join('')}
                    </div>
                </div>

                <div class="a-card">
                    <div class="a-card-title">Contact Form
                        <span class="a-card-sub">${d.contact.total} submitted</span>
                    </div>
                    <div class="a-reason-list">
                        ${renderReasons(d.contact.breakdown, d.contact.total)}
                    </div>
                </div>

            </div>

            <div class="a-chart-wrap">
                <div class="a-card-title">Daily Visitors — last 14 days</div>
                <div class="a-chart">
                    ${renderChart(d.chart)}
                </div>
            </div>

            <div class="analytics-error"></div>

        </div>`;

    document.getElementById('analytics-close')
        ?.addEventListener('click', () => {
            closeAnalytics();
            _print('\x1b[90m  analytics closed.\x1b[0m');
            _print('');
        });
}

// ── Sub-renderers ─────────────────────────────────────────────────
function renderCommands(ranked, total) {
    if (!ranked.length) return '<div class="a-empty">no data yet</div>';
    const max = ranked[0]?.count || 1;
    return ranked.map(r => {
        const barW = Math.round((r.count / max) * 80);
        const pct  = total ? Math.round((r.count / total) * 100) : 0;
        return `
            <div class="a-cmd-row">
                <span class="a-cmd-name">${r.cmd}</span>
                <div class="a-bar-track">
                    <div class="a-bar" style="width:${barW}%"></div>
                </div>
                <span class="a-cmd-count">${r.count}</span>
                <span class="a-cmd-pct">${pct}%</span>
            </div>`;
    }).join('');
}

function renderCountries(countries) {
    if (!countries.length) return '<div class="a-empty">no data yet</div>';
    return countries.map(c => {
        const flag = FLAG_MAP[c.code.toUpperCase()] || '🌐';
        return `
            <div class="a-country-row">
                <span class="a-flag">${flag}</span>
                <span class="a-country-name">${c.country}</span>
                <div class="a-bar-track">
                    <div class="a-bar a-bar-cyan" style="width:${c.pct}%"></div>
                </div>
                <span class="a-country-pct">${c.pct}%</span>
            </div>`;
    }).join('');
}

function renderReasons(breakdown, total) {
    if (!breakdown.length) return '<div class="a-empty">no submissions yet</div>';
    return breakdown.map(r => {
        const label = REASON_LABELS[r.reason] || r.reason;
        const pct   = total ? Math.round((r.count / total) * 100) : 0;
        return `
            <div class="a-reason-row">
                <span class="a-reason-label">${label}</span>
                <span class="a-reason-count">${r.count}</span>
                <span class="a-reason-pct a-muted">${pct}%</span>
            </div>`;
    }).join('');
}

function renderChart(chart) {
    if (!chart.length) return '<div class="a-empty">no data yet</div>';
    const max   = Math.max(...chart.map(c => c.visitors), 1);
    const BAR_W = 22;
    return chart.map(c => {
        const filled = Math.round((c.visitors / max) * BAR_W);
        const empty  = BAR_W - filled;
        const label  = new Date(c.day).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short'
        });
        return `
            <div class="a-chart-row">
                <span class="a-chart-label">${label}</span>
                <div class="a-chart-bar">
                    <span class="a-bar-filled">${'▓'.repeat(filled)}</span><span class="a-bar-empty">${'░'.repeat(empty)}</span>
                </div>
                <span class="a-chart-val">${c.visitors}</span>
            </div>`;
    }).join('');
}
