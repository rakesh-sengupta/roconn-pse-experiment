/* =========================================================================
 *  panels.js  —  Confederate panel generation (High-C and Low-C)
 *
 *  v5.2: rebuilt as PURE HTML + a thin SVG overlay for the connecting lines.
 *  The previous SVG <foreignObject> approach (nested <svg> avatars and badge
 *  divs inside an outer <svg>) renders unreliably across browsers, which is
 *  why connections and rating badges could appear blank. Profile cards and
 *  badges are now ordinary HTML; only the network edges use SVG.
 *
 *  Public API (unchanged):
 *      ROCONN.buildPanel({ topology, pressure, encodedSeq, blockIndex })
 *      ROCONN.buildTrainingPanel({ connected })
 * ========================================================================= */

/* Six fixed network positions, as PERCENTAGES of the panel box (hexagon).
   Positions 1-3 form the endorsing set (triad in High-C); 4-6 confirm. */
const PANEL_POS = [
    { x: 50, y: 13 },   // 1 top
    { x: 19, y: 36 },   // 2 upper-left
    { x: 19, y: 68 },   // 3 lower-left
    { x: 50, y: 90 },   // 4 bottom
    { x: 81, y: 68 },   // 5 lower-right
    { x: 81, y: 36 },   // 6 upper-right
];

/* High-C edges: triad 1-2,1-3,2-3 (strong) + light bridges. Low-C: none. */
const HIGH_C_EDGES = [
    { a: 0, b: 1, w: 'strong' },
    { a: 0, b: 2, w: 'strong' },
    { a: 1, b: 2, w: 'strong' },
    { a: 0, b: 5, w: 'light'  },
    { a: 2, b: 3, w: 'light'  },
    { a: 3, b: 4, w: 'light'  },
    { a: 4, b: 5, w: 'light'  },
];

const AVATAR_PALETTE = {
    Fa: { skin: '#F3D6B5', hair: '#3A2A1A', accent: '#9B2C2C' },
    Fb: { skin: '#D6A77A', hair: '#1F1F1F', accent: '#2C5282' },
    Fc: { skin: '#A87752', hair: '#5A3A1A', accent: '#2F855A' },
    Ga: { skin: '#EFC9A1', hair: '#6B4423', accent: '#6B46C1' },
    Gb: { skin: '#C8956D', hair: '#2A2A2A', accent: '#B7791F' },
    Gc: { skin: '#9B6E47', hair: '#4A2C0A', accent: '#0987A0' },
};

/* Standalone SVG avatar (renders fine as plain inline SVG in HTML). */
function avatarSVG (avId, size = 38) {
    const p = AVATAR_PALETTE[avId] || AVATAR_PALETTE.Fa;
    const hairTop = avId.startsWith('G') ? 14 : 10;
    return `
    <svg viewBox="0 0 50 50" width="${size}" height="${size}" aria-hidden="true" style="display:block;margin:0 auto;">
        <circle cx="25" cy="20" r="11" fill="${p.skin}"/>
        <path d="M14,${hairTop} Q25,${hairTop - 6} 36,${hairTop} L36,18 Q25,12 14,18 Z" fill="${p.hair}"/>
        <circle cx="21" cy="20" r="1.2" fill="#222"/>
        <circle cx="29" cy="20" r="1.2" fill="#222"/>
        <path d="M22,25 Q25,27 28,25" stroke="#5A2A2A" stroke-width="1" fill="none" stroke-linecap="round"/>
        <path d="M10,46 Q25,32 40,46 Z" fill="${p.accent}"/>
    </svg>`;
}

/* -------------------------------------------------------------------------
 *  ROCONN.buildPanel — one confederate panel as pure HTML.
 * ----------------------------------------------------------------------- */
ROCONN.buildPanel = function ({ topology, pressure, encodedSeq, blockIndex }) {
    const badges    = ROCONN.getBadgeText({ encodedSeq });
    const avatarSet = ROCONN.avatarSchedule[BLOCK_AVATAR_ORDER[blockIndex]];
    const isHigh    = topology === 'high';

    // Positions endorsing the ALTERNATIVE: none / triad / all.
    const altSet = pressure === 0  ? []
                 : pressure === 50 ? [0, 1, 2]
                                   : [0, 1, 2, 3, 4, 5];

    // --- edges (SVG overlay, High-C only) --------------------------------
    const edges = isHigh ? HIGH_C_EDGES.map(e => {
        const A = PANEL_POS[e.a], B = PANEL_POS[e.b];
        const cls = e.w === 'strong' ? 'cpanel-edge-strong' : 'cpanel-edge-light';
        return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"
                      class="${cls}" vector-effect="non-scaling-stroke"/>`;
    }).join('') : '';

    const edgesSVG = `
        <svg class="cpanel-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${edges}
        </svg>`;

    // --- profile cards (HTML, absolutely positioned) ---------------------
    const cards = PANEL_POS.map((pos, i) => {
        const isAlt   = altSet.includes(i);
        const badge   = isAlt ? badges.alternative : badges.confirming;
        const badgeCl = isAlt ? 'b-alt' : 'b-confirm';
        const idLabel = `P${avatarSet[i].toUpperCase()}-${i + 1}`;
        const indep   = isHigh ? '' : '<div class="cpanel-indep">Independent reviewer</div>';
        return `
        <div class="cpanel-card" style="left:${pos.x}%;top:${pos.y}%;">
            <div class="cpanel-av">${avatarSVG(avatarSet[i], 36)}</div>
            <div class="cpanel-id">${idLabel}</div>
            ${indep}
            <div class="cpanel-badge ${badgeCl}">${badge}</div>
        </div>`;
    }).join('');

    const groupBadge = isHigh
        ? `<div class="cpanel-group">Group: Krea Seminar Cohort 2025</div>` : '';

    return `
    <div class="cpanel ${isHigh ? 'cpanel-hc' : 'cpanel-lc'}">
        <div class="cpanel-header">
            <div class="cpanel-title">Other Reviewers</div>
            <div class="cpanel-sub">${isHigh ? 'Connected group' : 'Independent reviewers'}</div>
        </div>
        <div class="cpanel-net">
            ${edgesSVG}
            ${cards}
        </div>
        ${groupBadge}
    </div>`;
};

/* -------------------------------------------------------------------------
 *  Training panel — three nodes in a row, optionally connected.   [v5 §5.6]
 * ----------------------------------------------------------------------- */
ROCONN.buildTrainingPanel = function ({ connected }) {
    const pos = [ { x: 22, y: 50 }, { x: 50, y: 50 }, { x: 78, y: 50 } ];
    const av  = ['Fa', 'Ga', 'Fc'];

    const edges = connected ? `
        <line x1="22" y1="50" x2="50" y2="50" class="cpanel-edge-strong" vector-effect="non-scaling-stroke"/>
        <line x1="50" y1="50" x2="78" y2="50" class="cpanel-edge-strong" vector-effect="non-scaling-stroke"/>
        <line x1="22" y1="50" x2="78" y2="42" class="cpanel-edge-strong" vector-effect="non-scaling-stroke"/>` : '';

    const cards = pos.map((p, i) => `
        <div class="cpanel-card cpanel-card-sm" style="left:${p.x}%;top:${p.y}%;">
            <div class="cpanel-av">${avatarSVG(av[i], 36)}</div>
        </div>`).join('');

    return `
    <div class="cpanel-train">
        <div class="cpanel-net cpanel-net-sm">
            <svg class="cpanel-edges" viewBox="0 0 100 100" preserveAspectRatio="none">${edges}</svg>
            ${cards}
        </div>
    </div>`;
};
