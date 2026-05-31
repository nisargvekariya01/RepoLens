/**
 * themePdfExport.js
 *
 * Client-side, dark-theme PDF export that visually matches the dashboard UI.
 * Uses an off-screen rendered HTML template captured by html2canvas → jsPDF.
 *
 * No backend involvement for PDF — JSON/CSV stay on the backend,
 * PDF is generated entirely in the browser so colors, fonts and
 * chart data are rendered exactly as designed.
 *
 * Public API:
 *   generateSectionPdf(sectionType, shapedPayload, projectName?)
 *     → downloads <section>_export_<timestamp>.pdf
 */

// ─── Design tokens (mirror index.css @theme) ─────────────────────────────────

const T = {
  bg: '#0B0C10',
  surface: '#1C1E2A',
  surfaceHov: '#262938',
  card: '#13151A',
  purple: '#A855F7',
  blue: '#3B82F6',
  pink: '#EC4899',
  green: '#10B981',
  cyan: '#06B6D4',
  yellow: '#EAB308',
  text: '#F8FAFC',
  muted: '#94A3B8',
  border: 'rgba(255,255,255,0.08)',
  borderCard: 'rgba(255,255,255,0.05)',
};

// ─── Inline-style helpers ────────────────────────────────────────────────────

const style = (obj) => Object.entries(obj).map(([k, v]) => {
  const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
  return `${prop}:${v}`;
}).join(';');

const PAGE_W = 900;   // px — wide enough for good fidelity
const PAGE_PAD = 40;

// ─── Section-specific HTML renderers ─────────────────────────────────────────

function badge(label, color = T.purple) {
  const textStr = (label || '').toString().toUpperCase();
  // Estimate width based on character count: ~6.5px per char + 24px padding
  const w = Math.round(textStr.length * 6.5 + 24);
  const h = 20;

  // Render as SVG because html2canvas has known bugs calculating text baselines inside pill shapes
  return `
    <div style="display: inline-block; vertical-align: middle;">
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display: block;">
        <rect x="0.5" y="0.5" width="${w-1}" height="${h-1}" rx="${(h-1)/2}" fill="${color}22" stroke="${color}55" stroke-width="1"/>
        <text x="${w/2}" y="14" font-family="Outfit, Inter, sans-serif" font-weight="700" font-size="10" letter-spacing="0.05em" text-anchor="middle" fill="${color}">
          ${textStr}
        </text>
      </svg>
    </div>
  `;
}

function stat(label, value, color = T.text) {
  return `
    <div class="avoid-break" style="${style({
    padding: '24px', background: `${T.surface}99`, borderRadius: '16px',
    border: `1px solid ${T.borderCard}`, display: 'flex', height: '100%', boxSizing: 'border-box',
    flexDirection: 'column', gap: '12px', minWidth: '140px',
    alignItems: 'center', justifyContent: 'center', textAlign: 'center'
  })}">
      <div style="${style({ fontSize: '11px', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' })}">${label}</div>
      <div style="${style({ fontSize: '32px', fontWeight: '800', color, lineHeight: '1' })}">${value ?? '—'}</div>
    </div>`;
}

function sectionTitle(title, icon = '◆') {
  return `
    <div class="pdf-section-title avoid-break" style="${style({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 0 12px 0', borderBottom: `1px solid ${T.border}`,
    marginBottom: '20px',
  })}">
      <span style="${style({ color: T.purple, fontSize: '16px' })}">${icon}</span>
      <span style="${style({
    color: T.text, fontSize: '15px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    textShadow: '0 0 10px rgba(255,255,255,0.3)'
  })}">${title}</span>
    </div>`;
}

function card(children, extraStyle = {}) {
  return `
    <div class="pdf-card" style="${style({
    background: `${T.surface}99`,
    border: `1px solid ${T.borderCard}`,
    borderRadius: '16px', padding: '24px',
    marginBottom: '20px', ...extraStyle,
  })}">${children}</div>`;
}

function row(label, value, valueColor = T.text) {
  return `
    <div style="${style({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: `1px solid ${T.borderCard}`,
  })}">
      <span style="${style({ color: T.muted, fontSize: '12px', fontWeight: '500' })}">${label}</span>
      <span style="${style({ color: valueColor, fontSize: '13px', fontWeight: '700' })}">${value ?? '—'}</span>
    </div>`;
}

/** Horizontal bar chart rendered as HTML (captures cleanly in html2canvas) */
function barChart(items, { label = 'label', value = 'value', color = T.purple, max } = {}) {
  if (!items || items.length === 0) return `<p style="color:${T.muted};font-size:12px">No data</p>`;
  const peak = max || Math.max(...items.map(d => d[value] || 0)) || 1;
  return items.map(d => {
    const pct = Math.max(((d[value] || 0) / peak) * 100, 2);
    return `
      <div style="${style({ marginBottom: '10px' })}">
        <div style="${style({ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: T.muted, marginBottom: '4px' })}">
          <span>${d[label]}</span><span style="color:${T.text};font-weight:700">${d[value] ?? 0}</span>
        </div>
        <div style="${style({ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '6px', overflow: 'hidden' })}">
          <div style="${style({
      width: `${pct}%`, height: '100%', borderRadius: '4px',
      background: `linear-gradient(90deg,${color},${color}99)`,
      boxShadow: `0 0 8px ${color}66`
    })}"></div>
        </div>
      </div>`;
  }).join('');
}

function areaChart(items, { label = 'label', value = 'value', color = T.purple, height = 150 } = {}) {
  if (!items || items.length === 0) return `<p style="color:${T.muted};font-size:12px">No data</p>`;
  
  const peak = Math.max(...items.map(d => d[value] || 0), 5); // Default Y-axis max 5 like UI
  const W = 1000;
  const H = height;
  const len = items.length;
  
  let pathD = '';
  let pointsHtml = '';
  
  items.forEach((d, i) => {
    const x = len > 1 ? (i / (len - 1)) * W : W / 2;
    const y = H - ((d[value] || 0) / peak) * (H - 20) - 10; // 10px padding top and bottom
    
    if (i === 0) {
      pathD += `M ${x},${y}`;
    } else {
      pathD += ` L ${x},${y}`;
    }
    
    // Add dots for each point
    pointsHtml += `<circle cx="${x}" cy="${y}" r="3" fill="${color}" stroke="${T.surface}" stroke-width="1.5" />`;
  });
  
  const areaD = `${pathD} L ${len > 1 ? W : W/2},${H} L ${len > 1 ? 0 : W/2},${H} Z`;
  
  // Y-axis grid lines
  const gridHtml = [0, 0.5, 1].map(pct => {
    const y = H - (pct * (H - 20)) - 10;
    const val = Math.round(pct * peak);
    return `
      <line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4 4" />
      <text x="0" y="${y - 4}" fill="${T.muted}" font-size="10" font-family="Outfit, Inter, sans-serif">${val}</text>
    `;
  }).join('');
  
  // X-axis labels (first, middle, last)
  let xAxisHtml = '';
  if (len === 1) {
    xAxisHtml += `<text x="${W/2}" y="${H + 15}" fill="${T.muted}" font-size="10" text-anchor="middle" font-family="Outfit, Inter, sans-serif">${items[0][label]}</text>`;
  } else {
    if (len > 0) {
      xAxisHtml += `<text x="0" y="${H + 15}" fill="${T.muted}" font-size="10" font-family="Outfit, Inter, sans-serif">${items[0][label]}</text>`;
    }
    if (len > 2) {
      const mid = Math.floor(len / 2);
      xAxisHtml += `<text x="${W/2}" y="${H + 15}" fill="${T.muted}" font-size="10" text-anchor="middle" font-family="Outfit, Inter, sans-serif">${items[mid][label]}</text>`;
    }
    if (len > 1) {
      xAxisHtml += `<text x="${W}" y="${H + 15}" fill="${T.muted}" font-size="10" text-anchor="end" font-family="Outfit, Inter, sans-serif">${items[len-1][label]}</text>`;
    }
  }
  
  // UUID for gradient to avoid clashes
  const gradId = 'grad-' + Math.random().toString(36).substr(2, 9);
  
  return `
    <div style="width: 100%; padding-bottom: 20px;">
      <svg viewBox="0 0 ${W} ${H + 20}" style="width: 100%; height: auto; display: block; overflow: visible;">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stop-color="${color}" stop-opacity="0.4" />
            <stop offset="95%" stop-color="${color}" stop-opacity="0" />
          </linearGradient>
        </defs>
        ${gridHtml}
        <path d="${areaD}" fill="url(#${gradId})" />
        <path d="${pathD}" fill="none" stroke="${color}" stroke-width="3" />
        ${pointsHtml}
        ${xAxisHtml}
      </svg>
    </div>
  `;
}

/** Donut-style progress ring (pure CSS, captures well) */
function progressRing(value, max = 100, color = T.purple) {
  const pct = Math.min((value / max) * 100, 100);
  const r = 36, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return `
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
      <circle cx="45" cy="45" r="${r}" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
        stroke-linecap="round" transform="rotate(-90 45 45)"
        style="filter:drop-shadow(0 0 6px ${color})"/>
      <text x="45" y="50" text-anchor="middle"
        style="font-size:16px;font-weight:800;fill:${T.text};font-family:Outfit,Inter,sans-serif">
        ${Math.round(pct)}%
      </text>
    </svg>`;
}

// ─── Section HTML builders ────────────────────────────────────────────────────

function buildOverviewHtml(payload) {
  const { health = {}, snapshots = [], recommendations = [], alerts = [], jobs = [] } = payload;

  const recsHtml = (recommendations || []).slice(0, 3).map(r => `
    <div style="padding:12px 0; border-bottom:1px solid ${T.borderCard};">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:13px; color:${T.text}; font-weight:600; text-transform:capitalize;">${r.type || 'General'} Insight</span>
        ${badge(r.severity, r.severity === 'high' ? T.pink : r.severity === 'medium' ? T.yellow : T.blue)}
      </div>
      <div style="font-size:12px; color:${T.muted}; line-height:1.5;">${r.message}</div>
    </div>
  `).join('') || '<p style="color:#94A3B8;font-size:12px">No recommendations.</p>';

  const alertsHtml = (alerts || []).slice(0, 3).map(a => `
    <div style="padding:12px 0; border-bottom:1px solid ${T.borderCard};">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:13px; color:${T.text}; font-weight:600; text-transform:capitalize;">${a.type || 'System'} Alert</span>
        ${badge(a.severity, a.severity === 'high' ? T.pink : a.severity === 'medium' ? T.yellow : T.cyan)}
      </div>
      <div style="font-size:12px; color:${T.muted}; line-height:1.5;">${a.message}</div>
    </div>
  `).join('') || '<p style="color:#94A3B8;font-size:12px">No active alerts.</p>';

  return `
    <div style="display:flex;gap:24px;margin-bottom:24px;">
      <div style="flex:2;">
        ${sectionTitle('Project Intelligence', '⚡')}
        ${card(`
          <div style="font-size:12px;color:${T.muted};line-height:1.6;margin-bottom:16px;">
            The Overview section synthesizes AI analysis with real-time repository metrics to give you a complete picture of project health and velocity.
          </div>
          <div style="display:flex;gap:16px;">
            ${stat('Total Score', health.score || 0, T.green)}
            ${stat('Alerts', alerts?.length || 0, T.pink)}
            ${stat('Insights', recommendations?.length || 0, T.yellow)}
          </div>
        `)}
      </div>
      <div style="flex:1;">
        ${sectionTitle('Overall Health', '❤️')}
        ${card(`
        <div style="display:flex; align-items:center; gap:20px;">
        ${progressRing(health.score || 0, 100)}
        <div style="flex:1;">
          <div style="margin-bottom:16px; font-weight:600; color:${T.text};">Health Breakdown</div>
          ${row('Commit Activity', `${health.breakdown?.commitActivity || 0}/100`)}
          ${row('Issue Backlog', `${health.breakdown?.issueBacklog || 0}/100`)}
          ${row('PR Momentum', `${health.breakdown?.progressMomentum || 0}/100`)}
          ${row('Maintainability', `${health.breakdown?.maintainability || 0}/100`)}
        </div>
      </div>
    `)}
    </div>
  </div>

    <div style="display:flex;gap:24px;margin-top:24px;">
      <div style="flex:1;">
        ${sectionTitle('Recommendations', '💡')}
        ${card(recsHtml)}
      </div>
      <div style="flex:1;">
        ${sectionTitle('Active Alerts', '🔔')}
        ${card(alertsHtml)}
      </div>
    </div>
  `;
}

function buildMetricsHtml(payload) {
  const { repository = {}, issues = {}, traffic_14d = {}, trends = {}, growth_analytics = {} } = payload;
  
  const totalIssues = (issues.open || 0) + (issues.closed || 0);
  const closeRate = totalIssues > 0 ? Math.round(((issues.closed || 0) / totalIssues) * 100) : 0;
  const score = trends.activity_score || 0;
  const scoreColor = score < 40 ? T.pink : score < 70 ? T.yellow : T.green;
  
  const commitTrendBadge = trends.commit_trend === 'up' ? badge('TRENDING UP', T.green) : trends.commit_trend === 'down' ? badge('TRENDING DOWN', T.pink) : badge('STABLE', T.muted);

  return `
    <!-- Row 1: Activity Score & Top Stats Grid -->
    <div style="display:flex; gap:24px; margin-bottom:24px; align-items:stretch;">
      <!-- Activity Score Card -->
      <div style="flex:1; display:flex; flex-direction:column;">
        ${card(`
          <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
            <div>
              <div style="font-size:10px; color:${T.muted}; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Activity Score</div>
              <div style="font-size:36px; font-weight:900; color:${T.text}; line-height:1;">
                ${score} <span style="font-size:14px; color:${T.muted}; font-weight:500;">/ 100</span>
              </div>
            </div>
            <div>${commitTrendBadge}</div>
          </div>
          <div style="width:100%; background:${T.surfaceHov}; border-radius:99px; height:8px; margin-bottom:16px; overflow:hidden;">
            <div style="height:100%; background:${scoreColor}; border-radius:99px; width:${score}%; box-shadow:0 0 8px ${scoreColor}99;"></div>
          </div>
          <div style="display:flex; gap:16px; padding-top:12px; border-top:1px solid ${T.border};">
            <div style="flex:1;">
              <div style="font-size:10px; color:${T.muted}; margin-bottom:6px;">Stars Growth</div>
              ${badge(`${trends.stars_growth_pct > 0 ? '+' : ''}${trends.stars_growth_pct}% this month`, trends.stars_growth_pct > 0 ? T.green : trends.stars_growth_pct < 0 ? T.pink : T.muted)}
            </div>
            <div style="flex:1;">
              <div style="font-size:10px; color:${T.muted}; margin-bottom:6px;">Forks Growth</div>
              ${badge(`${trends.forks_growth_pct > 0 ? '+' : ''}${trends.forks_growth_pct}% this month`, trends.forks_growth_pct > 0 ? T.green : trends.forks_growth_pct < 0 ? T.pink : T.muted)}
            </div>
          </div>
        `, { margin: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' })}
      </div>

      <!-- Top Stats Grid -->
      <div style="flex:1; display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        ${stat('Stars', repository.stars?.toLocaleString(), T.yellow)}
        ${stat('Forks', repository.forks?.toLocaleString(), T.purple)}
        ${stat('Watchers', repository.watchers?.toLocaleString(), T.cyan)}
        ${stat('Contributors', repository.contributors?.toLocaleString(), T.green)}
      </div>
    </div>

    <!-- Row 2: Commits & Issues -->
    <div style="display:flex; gap:24px; margin-bottom:24px; align-items:stretch;">
      <div style="flex:1; display:flex; flex-direction:column;">
        ${sectionTitle('Commit Activity', '⚡')}
        ${card(`
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
            <span style="font-size:12px; font-weight:500; color:${T.muted};">Total Commits</span>
            <span style="font-size:18px; font-weight:700; color:${T.text};">${repository.commits?.toLocaleString()}</span>
          </div>
          <div style="width:100%; background:${T.surfaceHov}; border-radius:99px; height:8px; margin-bottom:16px; overflow:hidden;">
            <div style="height:100%; background:${T.purple}; border-radius:99px; width:${Math.min(((repository.commits || 0) / Math.max(repository.commits || 0, 500)) * 100, 100)}%; box-shadow:0 0 8px ${T.purple}99;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; padding-top:12px; border-top:1px solid ${T.border};">
            <span style="font-size:12px; font-weight:500; color:${T.muted};">Trend (30 days)</span>
            ${commitTrendBadge}
          </div>
        `, { margin: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' })}
      </div>
      <div style="flex:1; display:flex; flex-direction:column;">
        ${sectionTitle('Issues', '🐛')}
        ${card(`
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
            <span style="font-size:12px; font-weight:500; color:${T.muted};">Open</span>
            <div style="display:flex; gap:6px; align-items:center;">
              <span style="font-size:10px; color:${T.muted};">${totalIssues > 0 ? Math.round(((issues.open||0)/totalIssues)*100) : 0}%</span>
              <span style="font-size:16px; font-weight:700; color:${T.text};">${issues.open?.toLocaleString() || 0}</span>
            </div>
          </div>
          <div style="width:100%; background:${T.surfaceHov}; border-radius:99px; height:8px; margin-bottom:16px; overflow:hidden;">
            <div style="height:100%; background:${T.pink}; border-radius:99px; width:${totalIssues > 0 ? ((issues.open||0) / totalIssues) * 100 : 0}%; box-shadow:0 0 8px ${T.pink}99;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
            <span style="font-size:12px; font-weight:500; color:${T.muted};">Closed</span>
            <div style="display:flex; gap:6px; align-items:center;">
              <span style="font-size:10px; color:${T.muted};">${closeRate}%</span>
              <span style="font-size:16px; font-weight:700; color:${T.text};">${issues.closed?.toLocaleString() || 0}</span>
            </div>
          </div>
          <div style="width:100%; background:${T.surfaceHov}; border-radius:99px; height:8px; margin-bottom:16px; overflow:hidden;">
            <div style="height:100%; background:${T.green}; border-radius:99px; width:${totalIssues > 0 ? ((issues.closed||0) / totalIssues) * 100 : 0}%; box-shadow:0 0 8px ${T.green}99;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; padding-top:12px; border-top:1px solid ${T.border};">
            <span style="font-size:12px; font-weight:500; color:${T.muted};">Close Rate</span>
            <span style="font-size:13px; font-weight:700; color:${closeRate >= 70 ? T.green : closeRate >= 40 ? T.yellow : T.pink};">${closeRate}%</span>
          </div>
        `, { margin: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' })}
      </div>
    </div>

    <!-- Row 3: Traffic -->
    <div class="avoid-break">
      ${sectionTitle('Traffic · Last 14 Days', '📈')}
      <div style="display:flex; gap:16px; flex-wrap:wrap; align-items: stretch; margin-bottom: 24px;">
        <div style="flex:1; display:flex; flex-direction:column;">${stat('Total Views', traffic_14d.views?.toLocaleString(), T.cyan)}</div>
        <div style="flex:1; display:flex; flex-direction:column;">${stat('Unique Visitors', traffic_14d.unique_visitors?.toLocaleString(), T.purple)}</div>
        <div style="flex:1; display:flex; flex-direction:column;">${stat('Clones', traffic_14d.clones?.toLocaleString(), T.green)}</div>
      </div>
    </div>

    <!-- Row 4: Growth Analytics -->
    <div class="avoid-break">
      ${sectionTitle('Growth Analytics · 30-Day Window', '🚀')}
      ${card(`
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:16px; align-items: stretch;">
          <div style="background:${T.surface}80; padding:16px; border-radius:12px; border:1px solid ${T.borderCard}; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; height:100%; box-sizing:border-box;">
            <div style="font-size:10px; color:${T.muted}; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">⭐ Star Growth Rate</div>
            <div style="font-size:24px; font-weight:700; color:${T.text}; margin-bottom:8px;">${growth_analytics.star_growth_rate_pct > 0 ? '+' : ''}${growth_analytics.star_growth_rate_pct}%</div>
            ${growth_analytics.star_trend_direction === 'up' ? `<div style="font-size:12px; color:${T.green};">↑ Trending Up</div>` : growth_analytics.star_trend_direction === 'down' ? `<div style="font-size:12px; color:${T.pink};">↓ Trending Down</div>` : `<div style="font-size:12px; color:${T.muted};">→ Stable</div>`}
          </div>
          <div style="background:${T.surface}80; padding:16px; border-radius:12px; border:1px solid ${T.borderCard}; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; height:100%; box-sizing:border-box;">
            <div style="font-size:10px; color:${T.muted}; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">⭐ Stars / Day (7d avg)</div>
            <div style="font-size:24px; font-weight:700; color:${T.text}; margin-bottom:8px;">${growth_analytics.stars_per_day_7d_avg}</div>
            <div style="font-size:10px; color:${T.muted};">${growth_analytics.new_stars_365d?.toLocaleString()} new stars this year</div>
          </div>
          <div style="background:${T.surface}80; padding:16px; border-radius:12px; border:1px solid ${T.borderCard}; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; height:100%; box-sizing:border-box;">
            <div style="font-size:10px; color:${T.muted}; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">⚡ Commit Velocity</div>
            <div style="font-size:24px; font-weight:700; color:${T.text}; margin-bottom:8px;">${growth_analytics.commit_growth_rate_pct > 0 ? '+' : ''}${growth_analytics.commit_growth_rate_pct}%</div>
            ${growth_analytics.commit_growth_rate_pct > 0 ? `<div style="font-size:12px; color:${T.green};">↑ Trending Up</div>` : growth_analytics.commit_growth_rate_pct < 0 ? `<div style="font-size:12px; color:${T.pink};">↓ Trending Down</div>` : `<div style="font-size:12px; color:${T.muted};">→ Stable</div>`}
          </div>
          <div style="background:${T.surface}80; padding:16px; border-radius:12px; border:1px solid ${T.borderCard}; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; height:100%; box-sizing:border-box;">
            <div style="font-size:10px; color:${T.muted}; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">📅 Avg Commits / Week</div>
            <div style="font-size:24px; font-weight:700; color:${T.text}; margin-bottom:8px;">${growth_analytics.avg_commits_per_week}</div>
            <div style="font-size:10px; color:${T.muted};">7d avg commit velocity</div>
          </div>
        </div>
      `)}
    </div>
  `;
}

function heatmapGrid(heatmapData) {
  if (!heatmapData || heatmapData.length === 0) return `<p style="color:${T.muted};font-size:12px">No heatmap data available.</p>`;
  
  const getColor = (count) => {
    if (count === 0) return "rgba(255,255,255,0.05)";
    if (count < 3) return "rgba(168,85,247,0.4)";
    if (count < 6) return "rgba(168,85,247,0.8)";
    return "rgba(168,85,247,1)";
  };

  const cells = heatmapData.map(day => {
    const bg = day.date ? getColor(day.count) : "transparent";
    return `<div style="background-color: ${bg}; aspect-ratio: 1/1; border-radius: 2px;"></div>`;
  }).join('');

  return `
    <div style="display: grid; grid-template-rows: repeat(7, 1fr); grid-auto-flow: column; gap: 2px; width: 100%;">
      ${cells}
    </div>
  `;
}

function contributorListHtml(contributors) {
  if (!contributors || contributors.length === 0) {
    return `<p style="color:${T.muted};font-size:12px">No contributors</p>`;
  }

  return `
    <div style="margin-top: 16px;">
      ${contributors.map(c => {
        const initial = (c.login || "?").charAt(0).toUpperCase();
        // Since html2canvas can be finicky with remote images without explicit CORS,
        // we'll try to load the image. If it fails, fallback to initial.
        const avatarHtml = c.avatar
          ? `<img src="${c.avatar}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
             <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);"><span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.5)">${initial}</span></div>`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);"><span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.5)">${initial}</span></div>`;

        return `
          <div class="avoid-break" style="display:table;width:100%;padding:12px 0;border-bottom:1px solid ${T.borderCard};">
            <div style="display:table-cell;vertical-align:middle;width:44px;">
              <div style="width:32px;height:32px;border-radius:50%;overflow:hidden;border:1px solid rgba(255,255,255,0.1);background:${T.surface};">
                ${avatarHtml}
              </div>
            </div>
            <div style="display:table-cell;vertical-align:middle;">
                <div style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.9);line-height:1;margin-bottom:${(c.additions > 0 || c.deletions > 0) ? '6px' : '0'};">${c.login}</div>
                ${(c.additions > 0 || c.deletions > 0) ? `
                <div style="font-size:10px;display:flex;gap:8px;line-height:1;">
                  <span style="color:#4ade80;">+${c.additions || 0}</span>
                  <span style="color:#f472b6;">-${c.deletions || 0}</span>
                </div>
                ` : ''}
            </div>
            <div style="display:table-cell;vertical-align:middle;text-align:right;">
              <div style="font-size:14px;font-weight:700;color:#ffffff;line-height:1;margin-bottom:4px;">${c.commits}</div>
              <div style="font-size:10px;color:${T.muted};text-transform:uppercase;line-height:1;">Commits</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function buildActivityHtml(payload) {
  const { commits = {}, contributors = {}, pull_requests = {}, issues = {}, dora_metrics = {}, star_history = [] } = payload;
  const topContribs = contributors.top_10 || [];

  const padTimeline = (arr, days) => {
    const map = {};
    (arr || []).forEach(d => {
      map[d.date] = d.count;
    });

    const padded = [];
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      padded.push({
        label: dateStr.slice(5),
        value: map[dateStr] || 0
      });
    }
    return padded;
  };

  const renderTrendSection = (days) => {
    const commitsArr = commits.commitsOverTime || commits.timeline || [];
    return `
      <div class="avoid-break">
        ${sectionTitle(`Activity Trends (Last ${days} Days)`, '📅')}
        ${card(`
          <div style="margin-bottom:24px;">
            <div style="${style({ fontSize: '14px', color: T.text, fontWeight: '600', marginBottom: '12px' })}">Commit Trend Matrix</div>
            ${areaChart(padTimeline(commitsArr, days), { color: T.purple, height: 120 })}
          </div>
          <div>
            <div style="${style({ fontSize: '14px', color: T.text, fontWeight: '600', marginBottom: '12px' })}">Star Growth</div>
            ${areaChart(padTimeline(star_history, days), { color: T.yellow, height: 120 })}
          </div>
        `)}
      </div>
    `;
  };

  const heatmapHtml = commits.heatmap && commits.heatmap.length > 0 ? `
    ${sectionTitle('Daily Contribution Heatmap (365d)', '🗓️')}
    ${card(`
      ${heatmapGrid(commits.heatmap)}
    `)}
    <div style="margin-bottom:24px;"></div>
  ` : '';

  return `
    ${sectionTitle('DORA Performance Metrics', '📊')}
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:16px; margin-bottom:24px; align-items: stretch;">
      ${stat('Deploy Freq', dora_metrics.deployment_frequency ?? '—', T.purple)}
      ${stat('Lead Time', dora_metrics.lead_time_hours != null ? `${dora_metrics.lead_time_hours}h` : '—', T.blue)}
      ${stat('Failure Rate', dora_metrics.change_failure_rate_pct != null ? `${dora_metrics.change_failure_rate_pct}%` : '—', T.pink)}
      ${stat('Restore Time', dora_metrics.time_to_restore_hours != null ? `${dora_metrics.time_to_restore_hours}h` : '—', T.cyan)}
    </div>

    ${sectionTitle('Top Contributors', '👥')}
    ${card(`
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:24px; align-items: stretch;">
        ${stat('Total Contributors', contributors.total, T.blue)}
        ${stat('Bus Factor', contributors.bus_factor, T.yellow)}
        <div class="avoid-break" style="${style({
          padding: '24px', background: `${T.surface}99`, borderRadius: '16px',
          border: `1px solid ${T.borderCard}`, display: 'flex', height: '100%', boxSizing: 'border-box',
          flexDirection: 'column', gap: '12px', minWidth: '140px',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center'
        })}">
            <div style="${style({ fontSize: '11px', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' })}">Risk Level</div>
            <div>${badge(contributors.risk_level?.toUpperCase(), contributors.risk_level === 'high' ? T.pink : T.green)}</div>
        </div>
      </div>
      <div>
        ${contributorListHtml(topContribs)}
      </div>
    `)}

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; align-items: stretch;">
        <div>
            ${sectionTitle('Pull Requests', '🔀')}
            ${card(`
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; align-items: stretch;">
                ${stat('Merged', pull_requests.merged, T.green)}
                ${stat('Open', pull_requests.open, T.blue)}
                ${stat('Merge Rate', `${pull_requests.merge_rate_pct}%`, T.purple)}
                ${stat('Avg Cycle Time', `${pull_requests.avg_cycle_time_hours}h`, T.muted)}
              </div>
              <div style="margin-top:16px;">
                ${row('Avg Review Time', `${pull_requests.avg_review_time_hours ?? 0}h`)}
              </div>
            `)}
        </div>
        <div>
            ${sectionTitle('Issues Summary', '🐛')}
            ${card(`
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; align-items: stretch;">
                ${stat('Open', issues.open, T.pink)}
                ${stat('Closed', issues.closed, T.green)}
                ${stat('Stale', issues.stale, T.yellow)}
                ${stat('Avg Close Time', `${issues.avg_close_time_hours}h`, T.muted)}
              </div>
              <div style="margin-top:16px;">
                ${row('Bug/Feature Ratio', issues.bug_to_feature_ratio)}
              </div>
            `)}
        </div>
    </div>

    ${heatmapHtml}

    ${renderTrendSection(30)}
    ${renderTrendSection(90)}
    ${renderTrendSection(365)}
  `;
}

function buildAiAnalysisHtml(payload) {
  const {
    issues_data = {},
    suggestions_data = {},
    risk_data = {},
    tech_trend_data = {},
    future_score_data = {},
    code_quality_score = 0
  } = payload;

  const riskColor = risk_data.risk_level?.toLowerCase() === 'high' || risk_data.risk_level?.toLowerCase() === 'critical' ? T.pink : risk_data.risk_level?.toLowerCase() === 'medium' ? T.yellow : T.green;

  const risks = risk_data.risks || [];
  const issues = issues_data.issues_found || [];
  const suggestions = suggestions_data.suggestions || [];
  const techs = tech_trend_data.trending_technologies || [];
  const roadmap = future_score_data.improvement_roadmap || [];

  return `
    ${sectionTitle('Issues Detected', '🔍')}
    ${card(`
      ${issues.length === 0 ? `<p class="avoid-break" style="color:${T.muted};font-size:12px">No issues detected.</p>` :
      issues.slice(0, 15).map(i => `
          <div class="avoid-break" style="${style({ padding: '10px 0', borderBottom: `1px solid ${T.borderCard}` })}">
            <div style="${style({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' })}">
              <span style="${style({ color: T.text, fontSize: '13px', fontWeight: '600' })}">${i.title || '—'}</span>
              ${badge(i.severity?.toUpperCase() || 'INFO', i.severity?.toLowerCase() === 'high' ? T.pink : i.severity?.toLowerCase() === 'medium' ? T.yellow : T.muted)}
            </div>
            ${i.description ? `<div style="${style({ fontSize: '11px', color: T.muted, marginTop: '4px', lineClamp: '2' })}">${i.description}</div>` : ''}
          </div>`).join('')}
    `)}

    ${sectionTitle('AI Recommendations', '💡')}
    ${card(`
      ${suggestions_data.top_priority ? `
      <div class="avoid-break" style="margin-bottom:16px; padding:12px; border-left:3px solid ${T.blue}; background:rgba(255,255,255,0.02); border-radius:4px;">
        <div style="font-size:10px; font-weight:bold; color:${T.blue}; text-transform:uppercase; margin-bottom:4px;">Top Priority</div>
        <div style="font-size:13px; color:${T.text};">${suggestions_data.top_priority}</div>
      </div>` : ''}
      ${suggestions.length === 0 ? `<p class="avoid-break" style="color:${T.muted};font-size:12px">No suggestions.</p>` :
      suggestions.slice(0, 10).map((s, i) => `
          <div class="avoid-break" style="${style({ padding: '10px 0', borderBottom: `1px solid ${T.borderCard}` })}">
            <div style="${style({ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' })}">
              <span style="${style({ color: T.text, fontSize: '13px', fontWeight: '600' })}">${i + 1}. ${s.title || '—'}</span>
              ${badge(s.impact?.toUpperCase() || 'LOW', s.impact?.toLowerCase() === 'high' ? T.pink : T.yellow)}
            </div>
            ${s.action ? `<p style="${style({ fontSize: '11px', color: T.muted, margin: '0' })}">${s.action}</p>` : ''}
          </div>`).join('')}
    `)}

    ${sectionTitle('AI Risk Assessment', '⚠️')}
    ${card(`
      <div class="avoid-break" style="display:flex;align-items:flex-start;gap:20px;">
        <div style="flex:1">
          ${row('Risk Level', badge(risk_data.risk_level?.toUpperCase() || 'UNKNOWN', riskColor))}
          ${row('Bus Factor', risk_data.bus_factor_risk ? risk_data.bus_factor_risk.charAt(0).toUpperCase() + risk_data.bus_factor_risk.slice(1) : 'Unknown')}
          ${row('Abandonment Prob', risk_data.abandonment_probability ? risk_data.abandonment_probability.charAt(0).toUpperCase() + risk_data.abandonment_probability.slice(1) : 'Unknown')}
        </div>
      </div>
      ${risks.length > 0 ? `
      <div style="margin-top:16px;">
        <div class="avoid-break" style="font-size:12px; font-weight:bold; color:${T.muted}; margin-bottom:8px; text-transform:uppercase;">Detected Risks</div>
        ${risks.map(r => `
          <div class="avoid-break" style="${style({ padding: '6px 0', fontSize: '12px', color: T.muted, display: 'flex', gap: '8px' })}">
            <span style="color:${T.pink}">▸</span>
            <div>
              <div style="color:${T.text}; font-weight:600;">${r.name || '—'}</div>
              <div>${r.description || ''}</div>
            </div>
          </div>
        `).join('')}
      </div>` : `<p class="avoid-break" style="color:${T.muted};font-size:12px;margin-top:12px;">No specific risks detected.</p>`}
    `)}

    ${sectionTitle('Future Score Forecast', '🚀')}
    ${card(`
      <div class="avoid-break" style="display:flex;gap:20px;align-items:center;margin-bottom:16px;">
        <div style="flex:1;">
          ${row('Current Code Quality', badge(`${code_quality_score}/100`, T.blue))}
          ${row('6-Month Forecast', badge(`${future_score_data.predicted_score_6_months || 0}/100`, T.green))}
        </div>
      </div>
      ${roadmap.length > 0 ? `
      <div style="margin-top:12px;">
        <div class="avoid-break" style="font-size:12px; font-weight:bold; color:${T.muted}; margin-bottom:8px; text-transform:uppercase;">Improvement Roadmap</div>
        ${roadmap.map(m => `
          <div class="avoid-break" style="${style({ padding: '6px 0', fontSize: '12px', color: T.muted, display: 'flex', gap: '8px' })}">
            <span style="color:${T.green}">◆</span>
            <div>
              <div style="color:${T.text};">${m.milestone || '—'} <span style="font-size:10px;color:${T.muted};margin-left:4px;">(${m.timeframe})</span></div>
            </div>
          </div>
        `).join('')}
      </div>` : ''}
    `)}

    ${sectionTitle('Tech Trend Intelligence', '📈')}
    ${card(`
      <div class="avoid-break" style="margin-bottom:12px">
        ${row('Project Domain', tech_trend_data.project_domain || '—')}
      </div>
      ${techs.length === 0 ? `<p class="avoid-break" style="color:${T.muted};font-size:12px">No specific trends identified.</p>` :
      techs.slice(0, 5).map(t => `
        <div class="avoid-break" style="${style({ padding: '10px 0', borderBottom: `1px solid ${T.borderCard}` })}">
          <div style="${style({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' })}">
            <span style="${style({ color: T.text, fontSize: '13px', fontWeight: '600' })}">${t.name || '—'}</span>
            ${badge(t.trend_status?.toUpperCase() || '—', T.purple)}
          </div>
          <div style="font-size: 10px; color:${T.purple}; margin-bottom: 4px;">${t.category}</div>
          ${t.relevance_to_project ? `<div style="${style({ fontSize: '11px', color: T.muted })}">${t.relevance_to_project}</div>` : ''}
        </div>`).join('')}
    `)}`;
}

function buildRepoTreeHtml(payload) {
  const rawTree = (payload.tree || '').slice(0, 12000);
  
  // Must escape HTML so folder names like <components> don't break the DOM
  const escapeHtml = (unsafe) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;");
  };

  // Wrap every single line in an avoid-break block so the paginator never slices a line in half
  const lines = rawTree.split('\n');
  const treeHtml = lines.map(line => 
    `<div class="avoid-break" style="min-height: 1.7em;">${escapeHtml(line)}</div>`
  ).join('');

  return `
    ${sectionTitle('Repository Structure', '🌳')}
    ${card(`
      <pre style="${style({
    color: T.muted, fontSize: '11px', fontFamily: 'monospace',
    lineHeight: '1.7', margin: '0', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
  })}">${treeHtml}</pre>
    `, { background: T.card })}`;
}

function buildDonutChartSvg(langs) {
  if (!langs || langs.length === 0) return '';
  const colors = [T.blue, T.purple, T.pink, T.green, T.yellow, T.cyan];
  
  let svg = `<svg viewBox="0 0 100 100" style="width:140px;height:140px;display:block;">`;
  let currentAngle = -Math.PI / 2;
  let total = langs.reduce((sum, l) => sum + (l.percentage || 0), 0) || 100;

  if (langs.length === 1) {
     svg += `<circle cx="50" cy="50" r="32" fill="none" stroke="${colors[0]}" stroke-width="25" />`;
  } else {
    langs.forEach((l, i) => {
      let pct = (l.percentage || 0);
      if (pct <= 0) return;
      let sliceAngle = (pct / total) * 2 * Math.PI;
      
      // Create a gap between slices
      let gap = 0.08; // ~4.5 degrees
      let sweepAngle = sliceAngle > gap ? sliceAngle - gap : sliceAngle * 0.5;
      let drawEndAngle = currentAngle + sweepAngle;
      
      let x1 = 50 + 32 * Math.cos(currentAngle);
      let y1 = 50 + 32 * Math.sin(currentAngle);
      let x2 = 50 + 32 * Math.cos(drawEndAngle);
      let y2 = 50 + 32 * Math.sin(drawEndAngle);
      
      let largeArcFlag = sweepAngle > Math.PI ? 1 : 0;
      
      if (sweepAngle > 1.99 * Math.PI) {
         svg += `<circle cx="50" cy="50" r="32" fill="none" stroke="${colors[i % colors.length]}" stroke-width="25" />`;
      } else {
        let pathData = [
          `M ${x1} ${y1}`,
          `A 32 32 0 ${largeArcFlag} 1 ${x2} ${y2}`
        ].join(' ');
        svg += `<path d="${pathData}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="25" />`;
      }
      
      // Advance by the full sliceAngle to leave the gap empty
      currentAngle += sliceAngle;
    });
  }
  svg += `</svg>`;
  return svg;
}

function buildCodeQualityHtml(payload) {
  const { security = {}, tech_stack = {}, high_churn_files = [], complex_files = [], commit_hygiene = {} } = payload;
  const langs = tech_stack.languages || [];

  return `
    ${sectionTitle('Security & Best Practices', '🛡️')}
    ${card(`
      ${security.issues?.length > 0 || security.secrets_found ? `
        <div class="avoid-break" style="${style({ background: `${T.pink}11`, border: `1px solid ${T.pink}33`, borderRadius: '8px', padding: '16px', marginBottom: '16px' })}">
          <div style="${style({ color: T.pink, fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '12px' })}">⚠ Critical Risks Detected</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${(security.issues || []).map(iss => `<span style="${style({ background: `${T.pink}22`, border: `1px solid ${T.pink}55`, color: T.pink, padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' })}">${iss}</span>`).join('')}
            ${security.secrets_found && !(security.issues?.length > 0) ? `<span style="${style({ background: `${T.pink}22`, border: `1px solid ${T.pink}55`, color: T.pink, padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' })}">Hardcoded secrets detected</span>` : ''}
          </div>
        </div>` : `
        <div class="avoid-break" style="${style({ background: `${T.green}11`, border: `1px solid ${T.green}33`, borderRadius: '8px', padding: '16px', color: T.green, fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' })}">
          ✓ No Critical Security Issues
        </div>`}
      <div class="avoid-break" style="display:flex;gap:16px;">
        <div style="${style({ flex: 1, padding: '16px', background: `${T.surface}99`, borderRadius: '8px', border: `1px solid ${T.borderCard}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' })}">
           <div style="${style({ fontSize: '11px', color: T.muted, textTransform: 'uppercase', fontWeight: '700', marginBottom: '12px' })}">License</div>
           ${badge(security.has_license ? 'Present' : 'Missing', security.has_license ? T.green : T.yellow)}
        </div>
        <div style="${style({ flex: 1, padding: '16px', background: `${T.surface}99`, borderRadius: '8px', border: `1px solid ${T.borderCard}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' })}">
           <div style="${style({ fontSize: '11px', color: T.muted, textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' })}">Readme Score</div>
           <div style="${style({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' })}">
             <div style="${style({ fontSize: '14px', fontWeight: '800', color: T.text, lineHeight: '1' })}">${security.readme_quality_score || 0}/100</div>
           </div>
           <div style="${style({ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '6px', overflow: 'hidden' })}">
              <div style="${style({ width: `${security.readme_quality_score || 0}%`, height: '100%', background: ((security.readme_quality_score || 0) >= 80 ? T.green : (security.readme_quality_score || 0) >= 50 ? T.yellow : T.pink) })}"></div>
           </div>
        </div>
      </div>
    `)}

    ${sectionTitle('Technology Stack', '🔧')}
    ${card(`
      <div class="avoid-break" style="display:flex;flex-direction:column;align-items:center;margin-bottom:24px;">
        <div style="margin-bottom:20px;">
           ${buildDonutChartSvg(langs)}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">
          ${langs.length > 0 ? langs.map((l, i) => {
            const colors = [T.blue, T.purple, T.pink, T.green, T.yellow, T.cyan];
            const color = colors[i % colors.length];
            return `
              <div style="${style({ display: 'inline-block', padding: '6px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', whiteSpace: 'nowrap', lineHeight: '1' })}">
                <span style="display:inline-block; vertical-align:middle; width:8px; height:8px; border-radius:50%; background:${color}; margin-right:8px; box-shadow:0 0 6px ${color}88;"></span>
                <span style="display:inline-block; vertical-align:middle; font-size:11px; color:${T.text}; font-weight:700; text-transform:uppercase; margin-right:6px; line-height:1;">${l.name}</span>
                <span style="display:inline-block; vertical-align:middle; font-size:11px; color:${T.muted}; font-family:monospace; line-height:1;">${l.percentage}%</span>
              </div>
            `;
          }).join('') : `<div style="font-size:12px;color:${T.muted};font-style:italic;">Unrecognized stack constraints.</div>`}
        </div>
      </div>
      <div class="avoid-break" style="${style({ borderTop: `1px solid ${T.borderCard}`, paddingTop: '16px' })}">
        <div style="${style({ fontSize: '11px', color: T.muted, textTransform: 'uppercase', fontWeight: '700', marginBottom: '16px' })}">Dependency Health</div>
        <div style="display:flex;gap:16px;">
          <div style="${style({ flex: 1, padding: '12px', background: `${T.surface}99`, borderRadius: '8px', border: `1px solid ${T.borderCard}`, textAlign: 'center' })}">
            <div style="font-size:20px;font-weight:800;color:${T.text};margin-bottom:4px;">${tech_stack.dependencies?.total || 0}</div>
            <div style="font-size:10px;font-weight:700;color:${T.muted};text-transform:uppercase;">Total</div>
          </div>
          <div style="${style({ flex: 1, padding: '12px', background: `${T.surface}99`, borderRadius: '8px', border: `1px solid ${T.borderCard}`, textAlign: 'center' })}">
            <div style="font-size:20px;font-weight:800;color:${(tech_stack.dependencies?.outdated > 0) ? T.yellow : T.text};margin-bottom:4px;">${tech_stack.dependencies?.outdated || 0}</div>
            <div style="font-size:10px;font-weight:700;color:${T.muted};text-transform:uppercase;">Outdated</div>
          </div>
          <div style="${style({ flex: 1, padding: '12px', background: `${T.surface}99`, borderRadius: '8px', border: `1px solid ${T.borderCard}`, textAlign: 'center' })}">
            <div style="font-size:20px;font-weight:800;color:${(tech_stack.dependencies?.risky > 0) ? T.pink : T.text};margin-bottom:4px;">${tech_stack.dependencies?.risky || 0}</div>
            <div style="font-size:10px;font-weight:700;color:${T.muted};text-transform:uppercase;">Risky</div>
          </div>
        </div>
      </div>
    `)}

    ${sectionTitle('High Churn Files', '🔥')}
    ${card(`
      ${high_churn_files.length === 0 ? `<p class="avoid-break" style="color:${T.muted};font-size:12px">No high-churn files detected.</p>` :
      `<div class="avoid-break" style="${style({ border: `1px solid ${T.borderCard}`, borderRadius: '8px', overflow: 'hidden' })}">
        <table style="width:100%;border-collapse:collapse;">
          <thead style="background:${T.surface}99;">
            <tr>
              <th style="padding:12px 16px;text-align:left;font-size:10px;color:${T.muted};text-transform:uppercase;font-weight:700;">File</th>
              <th style="padding:12px 16px;text-align:right;font-size:10px;color:${T.muted};text-transform:uppercase;font-weight:700;">Instability</th>
            </tr>
          </thead>
          <tbody>
            ${high_churn_files.slice(0, 5).map((f, i) => {
              const isRisky = f.churn_score > 75;
              const color = isRisky ? T.pink : f.churn_score > 40 ? T.yellow : T.blue;
              const parts = (f.file || '').split('/');
              const name = parts.pop();
              const path = parts.join('/');
              return `
                <tr style="border-top:1px solid ${T.borderCard}; background: ${isRisky ? `${T.pink}0A` : 'transparent'};">
                  <td style="padding:12px 16px; border-left: 2px solid ${isRisky ? T.pink : 'transparent'};">
                     ${path ? `<div style="font-size:10px;color:${T.muted};margin-bottom:4px;">${path}</div>` : ''}
                     <div style="font-size:13px;color:${isRisky ? T.pink : T.text};font-weight:600;">${name}</div>
                  </td>
                  <td style="padding:12px 16px;text-align:right;">
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:12px;">
                      <div style="width:64px;height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
                        <div style="width:${f.churn_score || 0}%;height:100%;background:${color};"></div>
                      </div>
                      <span style="font-size:12px;font-weight:700;color:${isRisky ? T.pink : T.muted};">${f.churn_score || 0}</span>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>`
      }
    `)}

    ${sectionTitle('Highest Complexity', '🧮')}
    ${card(`
      ${complex_files.length === 0 ? `<p class="avoid-break" style="color:${T.muted};font-size:12px">No complex files detected.</p>` :
      (() => {
        const maxComplexity = Math.max(...complex_files.map(f => f.complexity_score), 1);
        const scaleFactor = 100 / maxComplexity;
        return `<div class="avoid-break" style="${style({ border: `1px solid ${T.borderCard}`, borderRadius: '8px', overflow: 'hidden' })}">
          <table style="width:100%;border-collapse:collapse;">
            <thead style="background:${T.surface}99;">
              <tr>
                <th style="padding:12px 16px;text-align:left;font-size:10px;color:${T.muted};text-transform:uppercase;font-weight:700;">File</th>
                <th style="padding:12px 16px;text-align:right;font-size:10px;color:${T.muted};text-transform:uppercase;font-weight:700;">Complexity</th>
              </tr>
            </thead>
            <tbody>
              ${complex_files.slice(0, 5).map((f, i) => {
                const normalizedScore = Math.round((f.complexity_score || 0) * scaleFactor);
                const isRisky = normalizedScore > 60;
                const color = isRisky ? T.pink : T.purple;
                const parts = (f.file || '').split('/');
                const name = parts.pop();
                const path = parts.join('/');
                return `
                  <tr style="border-top:1px solid ${T.borderCard}; background: ${isRisky ? `${T.pink}0A` : 'transparent'};">
                    <td style="padding:12px 16px; border-left: 2px solid ${isRisky ? T.pink : 'transparent'};">
                       ${path ? `<div style="font-size:10px;color:${T.muted};margin-bottom:4px;">${path}</div>` : ''}
                       <div style="font-size:13px;color:${isRisky ? T.pink : T.text};font-weight:600;">${name}</div>
                    </td>
                    <td style="padding:12px 16px;text-align:right;">
                      <div style="display:flex;align-items:center;justify-content:flex-end;gap:12px;">
                        <div style="width:64px;height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
                          <div style="width:${normalizedScore}%;height:100%;background:${color};"></div>
                        </div>
                        <span style="font-size:12px;font-weight:700;color:${isRisky ? T.pink : T.muted};">${normalizedScore}</span>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>`;
      })()
      }
    `)}

    ${sectionTitle('Commit Hygiene & Patterns', '📝')}
    ${card(`
      <div class="avoid-break" style="display:flex;gap:24px;align-items:stretch;">
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px;">
          <div>
             <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
               <span style="font-size:10px;font-weight:700;color:${T.muted};text-transform:uppercase;">Conventional Commits Usage</span>
               <span style="font-size:13px;font-weight:800;color:${T.text};">${commit_hygiene.conventional_commits_pct ?? 0}%</span>
             </div>
             <div style="width:100%;height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
               <div style="width:${commit_hygiene.conventional_commits_pct ?? 0}%;height:100%;background:${T.green};"></div>
             </div>
          </div>
          <div>
             <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
               <span style="font-size:10px;font-weight:700;color:${T.muted};text-transform:uppercase;">Message Quality Score</span>
               <span style="font-size:13px;font-weight:800;color:${T.text};">${commit_hygiene.message_quality_score ?? 0}/100</span>
             </div>
             <div style="width:100%;height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
               <div style="width:${commit_hygiene.message_quality_score ?? 0}%;height:100%;background:${(commit_hygiene.message_quality_score || 0) > 70 ? T.green : T.yellow};"></div>
             </div>
          </div>
        </div>
        
        <div style="flex:1;background:rgba(255,255,255,0.02);padding:20px;border-radius:12px;border:1px solid ${T.borderCard};">
          <div style="font-size:10px;font-weight:800;color:${T.muted};text-transform:uppercase;letter-spacing:0.2em;text-align:center;margin-bottom:16px;">Type Distribution</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center;">
             <div>
                <div style="font-size:24px;font-weight:800;color:${T.green};line-height:1;margin-bottom:4px;">${commit_hygiene.commit_types?.feat || 0}</div>
                <div style="font-size:9px;font-weight:700;color:${T.muted};text-transform:uppercase;">Feat</div>
             </div>
             <div>
                <div style="font-size:24px;font-weight:800;color:${T.blue};line-height:1;margin-bottom:4px;">${commit_hygiene.commit_types?.fix || 0}</div>
                <div style="font-size:9px;font-weight:700;color:${T.muted};text-transform:uppercase;">Fix</div>
             </div>
             <div>
                <div style="font-size:24px;font-weight:800;color:${T.purple};line-height:1;margin-bottom:4px;">${commit_hygiene.commit_types?.refactor || 0}</div>
                <div style="font-size:9px;font-weight:700;color:${T.muted};text-transform:uppercase;">Refac</div>
             </div>
             <div>
                <div style="font-size:24px;font-weight:800;color:${T.muted};line-height:1;margin-bottom:4px;">${commit_hygiene.commit_types?.chore || 0}</div>
                <div style="font-size:9px;font-weight:700;color:${T.muted};text-transform:uppercase;opacity:0.5;">Chore</div>
             </div>
          </div>
        </div>
      </div>
    `)}
  `;
}

// ─── Section dispatcher ───────────────────────────────────────────────────────

const SECTION_BUILDERS = {
  overview: buildOverviewHtml,
  metrics: buildMetricsHtml,
  activity: buildActivityHtml,
  ai_analysis: buildAiAnalysisHtml,
  repo_tree: buildRepoTreeHtml,
  code_quality: buildCodeQualityHtml,
};

// ─── Page header / footer ─────────────────────────────────────────────────────

function buildPageHeader(title, sectionType, exportedAt, project) {
  const projectInfo = project ? `
    <div style="${style({ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: `1px solid ${T.border}` })}">
      <div style="${style({ display: 'flex', gap: '32px' })}">
        <div>
          <div style="${style({ fontSize: '10px', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' })}">Project Name</div>
          <div style="${style({ fontSize: '15px', color: T.text, fontWeight: '600' })}">${project.name || 'N/A'}</div>
        </div>
        <div>
          <div style="${style({ fontSize: '10px', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' })}">Repository</div>
          ${project.github_url ? `
            <div id="pdf-github-url" data-url="${project.github_url}" style="${style({ fontSize: '15px', color: '#1E90FF', fontWeight: '600', textDecoration: 'underline' })}">${project.repo_owner ? `${project.repo_owner}/` : ''}${project.repo_name || 'N/A'}</div>
          ` : `
            <div style="${style({ fontSize: '15px', color: T.blue, fontWeight: '600' })}">${project.repo_owner ? `${project.repo_owner}/` : ''}${project.repo_name || 'N/A'}</div>
          `}
        </div>
      </div>
    </div>
  ` : '';

  return `
    <div style="${style({
    background: `linear-gradient(135deg,${T.surface},${T.card})`,
    border: `1px solid ${T.border}`,
    borderRadius: '16px', padding: '28px 32px', marginBottom: '28px',
  })}">
      <div style="${style({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' })}">
        <div style="${style({ display: 'flex', gap: '20px', alignItems: 'center' })}">
          <img src="/repolens-logo.webp" style="width: 56px; height: 56px; object-fit: contain; filter: drop-shadow(0 0 8px rgba(30,144,255,0.7)); image-rendering: crisp-edges;" />
          <div>
            <div style="${style({
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px'
  })}">
              <svg width="150" height="40" viewBox="0 0 150 40" style="display: block; margin-top: -2px;">
                <defs>
                  <linearGradient id="repolensGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#3DBBFF" />
                    <stop offset="40%" stop-color="#1E90FF" />
                    <stop offset="80%" stop-color="#8B5CF6" />
                    <stop offset="100%" stop-color="#FF2D55" />
                  </linearGradient>
                </defs>
                <text x="0" y="32" font-family="Outfit, Inter, sans-serif" font-weight="800" font-size="25" letter-spacing="-0.02em" fill="url(#repolensGrad)">
                  RepoLens
                </text>
              </svg>
              <svg width="160" height="26" viewBox="0 0 160 26" style="display: block; margin-left: 2px;">
                <rect x="5" y="3" width="130" height="20" rx="10" fill="rgba(30,144,255,0.1)" stroke="rgba(30,144,255,0.3)" stroke-width="1.5" />
                <text x="70" y="17" font-family="Outfit, Inter, sans-serif" font-weight="700" font-size="10" letter-spacing="0.05em" text-anchor="middle" fill="#3DBBFF">
                  PROJECT ANALYSIS
                </text>
              </svg>
            </div>
          <h1 style="${style({
    margin: '0 0 6px', fontSize: '22px', fontWeight: '700',
    color: T.text, textShadow: '0 0 20px rgba(168,85,247,0.4)'
  })}">${title}</h1>
          <p style="${style({ margin: '0', fontSize: '12px', color: T.muted })}">
            Section: <strong style="color:${T.purple}">${sectionType.replace('_', ' ').toUpperCase()}</strong>
          </p>
          </div>
        </div>
        <div style="${style({ textAlign: 'right' })}">
          <p style="${style({ margin: '0', fontSize: '11px', color: T.muted })}">Exported</p>
          <p style="${style({ margin: '4px 0 0', fontSize: '12px', color: T.text, fontWeight: '600' })}">
            ${new Date(exportedAt).toLocaleString()}
          </p>
        </div>
      </div>
      ${projectInfo}
      <div style="${style({
    marginTop: '20px', height: '2px',
    background: `linear-gradient(90deg,${T.purple},${T.blue},transparent)`,
    borderRadius: '2px',
  })}"></div>
    </div>`;
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * generateSectionPdf(shapedPayload)
 *
 * @param {{ section, title, exportedAt, payload }} shapedPayload
 *   — output of sectionExport.js exportSection()
 * @param {string} [projectId]  — used in the filename
 */
export async function generateSectionPdf(shapedPayload, projectNameForFile = 'project', project = null) {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  const { section, title, exportedAt, payload } = shapedPayload;

  const builder = SECTION_BUILDERS[section] || (() => `<p style="color:${T.muted}">No renderer for section: ${section}</p>`);

  // 0. Preload logo image
  await new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve; // proceed anyway
    img.src = '/repolens-logo.webp';
  });

  // ── Build off-screen element ──────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position:fixed; left:-9999px; top:0;
    width:${PAGE_W}px; z-index:-1;
    background:${T.bg};
    padding:${PAGE_PAD}px;
    font-family:Outfit,Inter,system-ui,sans-serif;
    color:${T.text};
    box-sizing:border-box;
  `;

  wrapper.innerHTML = `
    ${buildPageHeader(title, section, exportedAt, project)}
    ${builder(payload)}
  `;

  document.body.appendChild(wrapper);

  // ── Manual page-break calculation for html2canvas slicing ───────────────
  const A4_W_mm = 210;
  const A4_H_mm = 297;
  const MARGIN_mm = 10;
  const imgW_mm = A4_W_mm - MARGIN_mm * 2; // 190
  const pageH_mm = A4_H_mm - MARGIN_mm * 2; // 277

  const domPxPerMm = wrapper.offsetWidth / imgW_mm;
  const domPageH = pageH_mm * domPxPerMm;

  // Find all elements marked to avoid breaking
  const breakBlocks = Array.from(wrapper.querySelectorAll('.avoid-break'));
  
  for (const el of breakBlocks) {
    const wrapperRect = wrapper.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const top = elRect.top - wrapperRect.top;
    const h = elRect.height;
    
    // Add a 25px safe zone to absorb floating-point scaling drift between DOM and canvas
    const safeZone = 25;
    const pageStart = Math.floor(top / domPageH);
    const pageEnd = Math.floor((top + h + safeZone) / domPageH);
    
    // If the element crosses a page boundary and fits entirely on one page
    if (pageStart !== pageEnd && h < domPageH) {
      let targetEl = el;
      
      // If this element is the FIRST item inside a card, we must also push the section title down
      // to avoid orphaning the title on the previous page!
      if (el.parentElement && el.parentElement.classList.contains('pdf-card')) {
        if (el === el.parentElement.firstElementChild) {
          const titleEl = el.parentElement.previousElementSibling;
          if (titleEl && titleEl.classList.contains('pdf-section-title')) {
            targetEl = titleEl;
          }
        }
      }
      
      const targetTop = targetEl.getBoundingClientRect().top - wrapperRect.top;
      const remainder = domPageH - (targetTop % domPageH);
      
      const spacer = document.createElement('div');
      // Add a tiny buffer (1px) to prevent floating point rounding issues
      spacer.style.height = `${remainder + 1}px`; 
      targetEl.parentNode.insertBefore(spacer, targetEl);
    }
  }

  // Measure URL link before rendering to apply clickable area in jsPDF later
  let linkRect = null;
  let linkUrl = null;
  const linkEl = document.getElementById('pdf-github-url');
  if (linkEl) {
    const wrapperRect = wrapper.getBoundingClientRect();
    const elRect = linkEl.getBoundingClientRect();
    linkRect = {
      x: elRect.left - wrapperRect.left,
      y: elRect.top - wrapperRect.top,
      w: elRect.width,
      h: elRect.height
    };
    linkUrl = linkEl.getAttribute('data-url');
  }

  try {
    const canvas = await html2canvas(wrapper, {
      backgroundColor: T.bg,
      scale: 3,                // 3× for extremely sharp text quality
      useCORS: true,
      allowTaint: true,
      logging: false,
      foreignObjectRendering: false, // more compatible
      windowWidth: PAGE_W + PAGE_PAD * 2,
    });

    // ── Build PDF ─────────────────────────────────────────────────────────
    const A4_W = 210;   // mm
    const A4_H = 297;   // mm
    const MARGIN = 10;  // mm

    const imgW = A4_W - MARGIN * 2;
    
    // Calculate the exact pixel height on the canvas that corresponds to a full PDF page (277mm)
    const pxPerMm = canvas.width / imgW;
    const pageH_px = (A4_H - MARGIN * 2) * pxPerMm;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const totalPages = Math.ceil(canvas.height / pageH_px);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      // Dark page background
      pdf.setFillColor(11, 12, 16);  // #0B0C10
      pdf.rect(0, 0, A4_W, A4_H, 'F');

      // Slice the canvas for this page precisely at pageH_px boundaries
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      const h = Math.min(pageH_px, canvas.height - page * pageH_px);
      sliceCanvas.height = h;

      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, -page * pageH_px);

      // Use JPEG with 95% quality for dramatic file size reduction and speed, while maintaining crispness via scale 3x
      const sliceDataUrl = sliceCanvas.toDataURL('image/jpeg', 0.95);
      const sliceImgH = h / pxPerMm;

      pdf.addImage(sliceDataUrl, 'JPEG', MARGIN, MARGIN, imgW, sliceImgH, '', 'FAST');

      // Add clickable link area on the first page
      if (page === 0 && linkRect && linkUrl) {
        const scaleRatio = imgW / wrapper.offsetWidth;
        pdf.link(
          MARGIN + (linkRect.x * scaleRatio),
          MARGIN + (linkRect.y * scaleRatio),
          linkRect.w * scaleRatio,
          linkRect.h * scaleRatio,
          { url: linkUrl }
        );
      }

      // Page number
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184); // T.muted
      pdf.text(`${title} · Page ${page + 1} of ${totalPages}`, A4_W / 2, A4_H - 5, { align: 'center' });
    }

    const sectionName = section.charAt(0).toUpperCase() + section.slice(1);
    const safeProjectName = projectNameForFile.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeProjectName}-${sectionName}.pdf`;
    pdf.save(filename);
  } finally {
    document.body.removeChild(wrapper);
  }
}
