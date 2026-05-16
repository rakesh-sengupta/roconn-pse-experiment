/* =========================================================================
 *  panels.js  —  Confederate panel generation (High-C and Low-C)
 *
 *  Replaces the 12 pre-rendered PNGs of Protocol v5 §5.2 with dynamically
 *  generated HTML/SVG. Network structure (positions 1–6) is fixed per
 *  Fig. 1 of the protocol; avatars rotate across blocks per §5.3.2.
 *
 *  Public API:
 *      ROCONN.buildPanel({ topology, pressure, encodedSeq, blockIndex })
 *          -> HTML string suitable for insertion as innerHTML.
 *      ROCONN.buildTrainingPanel({ connected })
 *          -> HTML for the comprehension-training slides.
 * ========================================================================= */

/* Position layout (in panel-local SVG coordinates).
   Same six positions used for High-C and Low-C; topology only changes edges. */
const PANEL_POSITIONS = [
    { x: 175, y:  60 },   // 1 (top)
    { x:  60, y: 165 },   // 2 (upper-left)
    { x:  60, y: 290 },   // 3 (lower-left)
    { x: 175, y: 395 },   // 4 (bottom)
    { x: 290, y: 290 },   // 5 (lower-right)
    { x: 290, y: 165 },   // 6 (upper-right)
];

/* High-C edges: 1-2, 1-3, 2-3 (triad) plus light bridging edges.
   Low-C: no edges. */
const HIGH_C_EDGES = [
    { a: 0, b: 1, weight: 'strong' },   // 1-2
    { a: 0, b: 2, weight: 'strong' },   // 1-3
    { a: 1, b: 2, weight: 'strong' },   // 2-3 (triad closes)
    { a: 0, b: 5, weight: 'light'  },
    { a: 2, b: 3, weight: 'light'  },
    { a: 3, b: 4, weight: 'light'  },
    { a: 4, b: 5, weight: 'light'  },
];

/* -------------------------------------------------------------------------
 *  SVG avatar generation — six distinguishable cartoon faces (Fa-Fc, Ga-Gc)
 *  using simple geometric primitives. Each is deterministic given its id.
 * ----------------------------------------------------------------------- */
const AVATAR_PALETTE = {
    Fa: { skin: '#F3D6B5', hair: '#3A2A1A', accent: '#9B2C2C' },
    Fb: { skin: '#D6A77A', hair: '#1F1F1F', accent: '#2C5282' },
    Fc: { skin: '#A87752', hair: '#5A3A1A', accent: '#2F855A' },
    Ga: { skin: '#EFC9A1', hair: '#6B4423', accent: '#6B46C1' },
    Gb: { skin: '#C8956D', hair: '#2A2A2A', accent: '#B7791F' },
    Gc: { skin: '#9B6E47', hair: '#4A2C0A', accent: '#0987A0' },
};

function avatarSVG (avId, size = 40) {
    const p = AVATAR_PALETTE[avId] || AVATAR_PALETTE.Fa;
    const hairTop  = avId.startsWith('G') ? 14 : 10;   // G-set has higher hair line
    const hairCurl = avId.startsWith('G') ? 'M10,20 Q25,8 40,20' : 'M12,18 Q25,12 38,18';
    return `
    <svg viewBox="0 0 50 50" width="${size}" height="${size}" aria-hidden="true">
        <circle cx="25" cy="20" r="11" fill="${p.skin}"/>
        <path d="M14,${hairTop} Q25,${hairTop-6} 36,${hairTop} L36,18 Q25,12 14,18 Z" fill="${p.hair}"/>
        <circle cx="21" cy="20" r="1.2" fill="#222"/>
        <circle cx="29" cy="20" r="1.2" fill="#222"/>
        <path d="M22,25 Q25,27 28,25" stroke="#5A2A2A" stroke-width="1" fill="none" stroke-linecap="round"/>
        <path d="M10,46 Q25,32 40,46 Z" fill="${p.accent}"/>
    </svg>`;
}

/* -------------------------------------------------------------------------
 *  ROCONN.buildPanel  —  generate one confederate panel
 *
 *  @param {string} topology    'high' | 'low'
 *  @param {number} pressure    0 | 50 | 100   (% endorsing alternative)
 *  @param {number} encodedSeq  1 | 2          (drives badge text direction)
 *  @param {number} blockIndex  0 | 1 | 2      (drives avatar rotation)
 *  @returns {string} HTML
 * ----------------------------------------------------------------------- */
ROCONN.buildPanel = function ({ topology, pressure, encodedSeq, blockIndex }) {
    const badges  = ROCONN.getBadgeText({ encodedSeq });
    const avatarSet = ROCONN.avatarSchedule[ BLOCK_AVATAR_ORDER[blockIndex] ];

    // Which positions endorse the alternative?
    //   0%   -> none
    //  50%   -> positions 1,2,3 (triad slot in High-C)
    // 100%   -> all six
    const altSet = pressure === 0   ? []
                 : pressure === 50  ? [0, 1, 2]
                                    : [0, 1, 2, 3, 4, 5];

    // --- profile cards ----------------------------------------------------
    const cards = PANEL_POSITIONS.map((pos, i) => {
        const isAlt = altSet.includes(i);
        const badge = isAlt ? badges.alternative : badges.confirming;
        const colour = isAlt ? 'badge-alt' : 'badge-confirm';
        const avSVG  = avatarSVG(avatarSet[i], 46);
        const idLabel = `P${avatarSet[i].toUpperCase()}-${i + 1}`;
        const indepLabel = topology === 'low'
            ? '<div class="indep-label">Independent reviewer</div>'
            : '';
        return `
        <g transform="translate(${pos.x - 60}, ${pos.y - 35})">
            <foreignObject x="0" y="0" width="120" height="120">
                <div xmlns="http://www.w3.org/1999/xhtml" class="profile-card">
                    <div class="profile-av">${avSVG}</div>
                    <div class="profile-id">${idLabel}</div>
                    ${indepLabel}
                    <div class="profile-badge ${colour}">${badge}</div>
                </div>
            </foreignObject>
        </g>`;
    }).join('');

    // --- network edges (High-C only) -------------------------------------
    let edgesSVG = '';
    if (topology === 'high') {
        edgesSVG = HIGH_C_EDGES.map(e => {
            const A = PANEL_POSITIONS[e.a];
            const B = PANEL_POSITIONS[e.b];
            const cls = e.weight === 'strong' ? 'edge-triad' : 'edge-bridge';
            return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="${cls}"/>`;
        }).join('');
    }

    // --- group badge (High-C only, at the foot of the panel) -------------
    const groupBadge = topology === 'high'
        ? `<div class="group-badge">Group: Krea Seminar Cohort 2025</div>`
        : '';

    // --- header text -----------------------------------------------------
    const subtitle = topology === 'high'
        ? 'Connected group'
        : 'Independent reviewers';

    // --- assembled markup -----------------------------------------------
    return `
    <div class="confed-panel ${topology === 'high' ? 'panel-hc' : 'panel-lc'}">
        <div class="panel-header">
            <div class="panel-title">Other Reviewers</div>
            <div class="panel-subtitle">${subtitle}</div>
        </div>
        <svg viewBox="0 0 350 470" class="panel-graph" preserveAspectRatio="xMidYMid meet">
            <g class="edges">${edgesSVG}</g>
            <g class="nodes">${cards}</g>
        </svg>
        ${groupBadge}
    </div>`;
};

/* -------------------------------------------------------------------------
 *  Training slides — small static panels with three icons,
 *  with or without connecting lines.                                [v5 §5.6]
 * ----------------------------------------------------------------------- */
ROCONN.buildTrainingPanel = function ({ connected }) {
    const positions = [
        { x:  60, y: 90  },
        { x: 175, y: 50  },
        { x: 290, y: 90  },
    ];
    const av = ['Fa', 'Ga', 'Fc'];
    const cards = positions.map((p, i) => `
        <g transform="translate(${p.x - 35}, ${p.y - 30})">
            <foreignObject x="0" y="0" width="70" height="100">
                <div xmlns="http://www.w3.org/1999/xhtml" class="training-card">
                    ${avatarSVG(av[i], 46)}
                </div>
            </foreignObject>
        </g>`).join('');

    let edges = '';
    if (connected) {
        edges = `
        <line x1="${positions[0].x}" y1="${positions[0].y}"
              x2="${positions[1].x}" y2="${positions[1].y}" class="edge-triad"/>
        <line x1="${positions[1].x}" y1="${positions[1].y}"
              x2="${positions[2].x}" y2="${positions[2].y}" class="edge-triad"/>
        <line x1="${positions[0].x}" y1="${positions[0].y}"
              x2="${positions[2].x}" y2="${positions[2].y}" class="edge-triad"/>`;
    }
    return `
    <div class="training-panel-wrap">
        <svg viewBox="0 0 350 160" class="training-graph">
            ${edges}
            ${cards}
        </svg>
    </div>`;
};
