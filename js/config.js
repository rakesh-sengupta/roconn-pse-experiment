/* =========================================================================
 *  config.js  —  ROCONN Asymmetric PSE Shift  (jsPsych implementation)
 *
 *  Cells, sequences, narrative, and runtime parameters per Protocol v5.
 *  All values matching the protocol document are flagged with [v5 §...].
 *
 *  --- v5.1 change -------------------------------------------------------
 *   Condition assignment is now RANDOM on every run by default (no URL
 *   parameters required). A pre-generated balanced randomisation list can
 *   still be used by passing ?cell=&sg=&pid= in the URL (see assignCondition).
 * ========================================================================= */

const ROCONN = {};   // global namespace

/* -------------------------------------------------------------------------
 *  1.  RUN-TIME PARAMETERS
 * ----------------------------------------------------------------------- */
ROCONN.params = {
    // Timing (ms)
    anchorPreviewMs:   2000,   // anchors visible before probe appears  [v5 §7.2]
    isiMs:              500,
    itiMinMs:           800,
    itiMaxMs:          1200,
    maxResponseMs:     4000,
    panelLoadPauseMs:  5000,   // [v5 §5.7]
    interBlockRestMs: 180000,  // 3 min between blocks
    distractorTotalMs:1200000, // 20 min total distractor window [v5 §6]
    ravenSecsPerItem:    96,   // 8 min / 5 items
    wordsearchMs:    480000,   // 8 min
    restMs:          240000,   // 4 min final rest

    // Trial structure
    trialsPerBlock:    65,     // 5 probe positions × 13 reps  [v5 §7]
    probePositions: [2, 3, 4, 5, 6],
    pressureLevels:  [0, 50, 100],

    // Recall gates
    immediateRecallGate:    6,   // ≥6/7 to proceed  [v5 §3.4]
    postDistractorRecallGate: 4, // <4/7 → covariate but proceed  [v5 §3.4]

    // Pre-quiz threshold
    prequizMaxScore: 3,          // exclude if >3/10 [v5 §2.3]

    // Response keys
    keyLeft:  'f',  // closer to Start
    keyRight: 'j',  // closer to End

    // Bisection repetitions per probe position (5 positions × 13 = 65/block)
    repsPerProbe: 13,

    // In-browser distractor tasks (tasks.js)
    matrixItems:      10,      // pattern-completion puzzles
    matrixItemMaxMs:  45000,   // per-puzzle cap
    wordsearchGrid:   12,      // N×N letter grid
    wordsearchCount:  8,       // words to hide
};

/* -------------------------------------------------------------------------
 *  1a. COVER STORY  (neutral — must NOT reveal the memory/conformity aim)
 *      Centralised so it can be changed in one place. Shown on the welcome,
 *      consent, and instruction screens and used as the browser tab title.
 * ----------------------------------------------------------------------- */
ROCONN.studyName = 'Document Review Study';

/* -------------------------------------------------------------------------
 *  1b. DEMO / PILOT MODE  (append ?demo=1 to the URL)
 *      Lets you click through the ENTIRE experiment end-to-end in ~2-3 min
 *      to verify every phase renders — including all three confederate
 *      pressure blocks. It BYPASSES the pre-quiz and immediate-recall gates
 *      and shortens the long timers and the per-block trial count.
 *      NEVER use ?demo=1 for real data collection.
 * ----------------------------------------------------------------------- */
ROCONN.demo = (function () {
    const p = new URLSearchParams(window.location.search);
    if (p.get('demo') === '1') return true;            // explicit on (over HTTP)
    if (p.get('demo') === '0') return false;           // explicit off
    // Opened directly as a local file? You cannot serve/collect data that way,
    // so default to the full walkthrough demo for convenience.
    return window.location.protocol === 'file:';
})();
if (ROCONN.demo) {
    Object.assign(ROCONN.params, {
        anchorPreviewMs:   800,
        panelLoadPauseMs: 1000,
        interBlockRestMs: 4000,
        ravenSecsPerItem:    1,   // → ~5 s "Raven" screen
        wordsearchMs:     8000,   // short interactive word search
        restMs:           5000,
        repsPerProbe:        2,   // 5 positions × 2 = 10 trials/block
        matrixItems:         3,   // fewer pattern puzzles
        matrixItemMaxMs:  8000,
    });
    console.warn('ROCONN: DEMO MODE — gates bypassed, timing shortened. Not for data collection.');
}

/* -------------------------------------------------------------------------
 *  2.  BETWEEN-SUBJECTS CELLS                                       [v5 §2.1]
 *     C1: High-C, encodes Seq1, pushed toward Seq2
 *     C2: High-C, encodes Seq2, pushed toward Seq1
 *     C3: Low-C,  encodes Seq1, pushed toward Seq2
 *     C4: Low-C,  encodes Seq2, pushed toward Seq1
 * ----------------------------------------------------------------------- */
ROCONN.cells = {
    C1: { topology: 'high', encodes: 1, pushedTo: 2, direction: 'seq1to2' },
    C2: { topology: 'high', encodes: 2, pushedTo: 1, direction: 'seq2to1' },
    C3: { topology: 'low',  encodes: 1, pushedTo: 2, direction: 'seq1to2' },
    C4: { topology: 'low',  encodes: 2, pushedTo: 1, direction: 'seq2to1' },
};

/* -------------------------------------------------------------------------
 *  3.  SIX-SUBGROUP BALANCED LATIN SQUARE                       [v5 §7.3]
 * ----------------------------------------------------------------------- */
ROCONN.subgroups = {
    SG1: [0,  50,  100],
    SG2: [0,  100, 50 ],
    SG3: [50, 0,   100],
    SG4: [50, 100, 0  ],
    SG5: [100, 0,  50 ],
    SG6: [100, 50, 0  ],
};

/* -------------------------------------------------------------------------
 *  4.  AVATAR ROTATION SCHEDULE (positions 1-6, three block versions)
 *      [v5 §5.3.2 — fixed network positions, rotating avatars]
 *      Each entry maps panel position -> avatar id (Fa-Fc, Ga-Gc).
 * ----------------------------------------------------------------------- */
ROCONN.avatarSchedule = {
    blkA: ['Fa', 'Fb', 'Fc', 'Ga', 'Gb', 'Gc'],
    blkB: ['Ga', 'Fb', 'Fa', 'Fc', 'Gc', 'Gb'],
    blkC: ['Gc', 'Fa', 'Gb', 'Fb', 'Ga', 'Fc'],
};
const BLOCK_AVATAR_ORDER = ['blkA', 'blkB', 'blkC'];

/* -------------------------------------------------------------------------
 *  5.  RUNTIME CONDITION ASSIGNMENT
 *
 *  DEFAULT: every run draws a cell (C1–C4) and a block-order subgroup
 *  (SG1–SG6) UNIFORMLY AT RANDOM, and generates a random participant ID.
 *  Just open the page with no query string.
 *
 *  OPTIONAL OVERRIDE: for a pre-generated *balanced* randomisation list
 *  (recommended for live data collection — see README "Counterbalancing"),
 *  pass any of the parameters explicitly:
 *       ?cell=C1&sg=SG2&pid=P0123
 *  Any omitted parameter is filled in at random.
 * ----------------------------------------------------------------------- */
ROCONN.makeParticipantId = function () {
    // Filename-safe, low-collision random ID, e.g. "P3F9K2Q".
    return 'P' + Math.random().toString(36).slice(2, 9).toUpperCase();
};

ROCONN.assignCondition = function () {
    const url = new URLSearchParams(window.location.search);

    const cellParam = url.get('cell');
    const sgParam   = url.get('sg');
    const pidParam  = url.get('pid');

    const cell = cellParam || pickRandom(Object.keys(ROCONN.cells));
    const sg   = sgParam   || pickRandom(Object.keys(ROCONN.subgroups));
    const pid  = pidParam  || ROCONN.makeParticipantId();

    if (!ROCONN.cells[cell])   throw new Error(`Bad cell ${cell}`);
    if (!ROCONN.subgroups[sg]) throw new Error(`Bad subgroup ${sg}`);

    return {
        pid,
        cell,
        subgroup: sg,
        topology:  ROCONN.cells[cell].topology,
        direction: ROCONN.cells[cell].direction,
        encodedSeq: ROCONN.cells[cell].encodes,
        pushedSeq:  ROCONN.cells[cell].pushedTo,
        pressureOrder: ROCONN.subgroups[sg],     // e.g. [50, 0, 100]
        // How was this session assigned? 'random' (default) or 'url' (override).
        assignment: (cellParam || sgParam || pidParam) ? 'url' : 'random',
        sessionStart: new Date().toISOString(),
    };
};

function pickRandom (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/* -------------------------------------------------------------------------
 *  6.  THE TWO SEQUENCES                                            [v5 §3.2]
 *      Events E1–E7. E3 and E5 are transposed between sequences.
 * ----------------------------------------------------------------------- */
ROCONN.events = {
    E1: { id: 'E1', label: 'Trade dispute declared',
          short: 'Trade dispute' },
    E2: { id: 'E2', label: 'Emergency ministerial summit',
          short: 'Ministerial summit' },
    E3: { id: 'E3', label: 'Tariff package announced',
          short: 'Tariffs' },
    E4: { id: 'E4', label: 'International mediator appointed',
          short: 'Mediator appointed' },
    E5: { id: 'E5', label: 'Bilateral sanctions imposed',
          short: 'Sanctions' },
    E6: { id: 'E6', label: 'Partial agreement reached',
          short: 'Partial agreement' },
    E7: { id: 'E7', label: 'Full diplomatic resolution',
          short: 'Resolution' },
};

ROCONN.sequences = {
    1: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'],   // tariffs (3rd), sanctions (5th)
    2: ['E1', 'E2', 'E5', 'E4', 'E3', 'E6', 'E7'],   // sanctions (3rd), tariffs (5th)
};

/* -------------------------------------------------------------------------
 *  7.  NARRATIVE TEXT  (placeholder — to be expanded to ~1,200 words)
 *      Two parallel versions matching Sequence 1 vs Sequence 2.
 *      One paragraph per event so each can be transposed cleanly.
 * ----------------------------------------------------------------------- */
ROCONN.narrative = {
    title: 'The Vorland–Selkavia Trade Dispute',
    intro:
`The Republic of Vorland and the Federation of Selkavia share a long border in
the temperate uplands of the continent. For four decades the two states have
been each other's largest trading partners, with most exchange flowing along
the rail corridor between Vorland's eastern industrial belt and Selkavia's
mineral-rich western provinces. In the spring of 2024, a long-simmering
dispute over the pricing of rare-earth exports came to a head. What follows
is a record of seven major events in the dispute as reported by independent
international observers.`,

    // Sequence 1 paragraphs — keyed by event id; participants in C1/C3 see this.
    seq1: {
        E1: `The dispute was formally declared on 4 March, when Vorland's Foreign
Ministry summoned the Selkavian ambassador and presented a written
complaint alleging breach of the 2017 Pricing Accord. State media in both
countries gave the announcement front-page treatment within hours.`,
        E2: `An emergency ministerial summit convened the following week at the
neutral border city of Halvik. Trade ministers, accompanied by central
bank governors, met for three days behind closed doors. Photographs
showed the delegations entering and leaving the same building without
exchanging public statements.`,
        E3: `A tariff package was then announced by Vorland's cabinet, imposing
duties of between 15 % and 45 % on a list of Selkavian goods that
included refined ores, processed timber, and certain machine parts. The
list was published in the official gazette and took effect at midnight.`,
        E4: `Two weeks later, after public exchanges of harsher rhetoric, an
international mediator was appointed under a regional framework agreement
of 2009. A former senior diplomat from a third state was named, with a
mandate to facilitate but not arbitrate. The appointment was welcomed in
neutral capitals.`,
        E5: `When the mediator's first round produced no movement, bilateral
sanctions were imposed by both governments in matched packages. The
measures included freezes on selected state-owned bank assets and the
suspension of cooperation in joint infrastructure projects in the rail
corridor.`,
        E6: `After two further rounds of mediated talks, a partial agreement was
reached. The agreement covered humanitarian exemptions to the sanctions
and re-opened the rail corridor for foodstuffs and medical supplies. It
was signed in Halvik and described publicly as an "interim
understanding."`,
        E7: `Full diplomatic resolution came three months after the original
declaration. A revised Pricing Accord was initialled by trade ministers
and ratified by both legislatures within a fortnight. The corridor
returned to normal traffic, and both governments described the outcome
as a model for handling future commercial disagreements.`,
    },

    // Sequence 2: E3 and E5 paragraphs swap their narrative position.
    // (We just re-order them; paragraph text is identical to seq1.)
    seq2: {
        E1: null, E2: null, E3: null, E4: null, E5: null, E6: null, E7: null,
        // Filled by clone-and-reorder logic below.
    },
};

// Fill seq2 by reordering: position 3 gets E5's paragraph, position 5 gets E3's.
(function buildSeq2 () {
    const s1 = ROCONN.narrative.seq1;
    ROCONN.narrative.seq2 = {
        E1: s1.E1,
        E2: s1.E2,
        E5: s1.E5,   // displayed in position 3
        E4: s1.E4,
        E3: s1.E3,   // displayed in position 5
        E6: s1.E6,
        E7: s1.E7,
    };
})();

/* -------------------------------------------------------------------------
 *  8.  PRE-QUIZ  (10 items, light geopolitical / general knowledge)
 *      Used as familiarity screen — score >3 excludes (too well-informed).
 * ----------------------------------------------------------------------- */
ROCONN.prequiz = [
    { q: 'Have you previously studied international trade law?',           a: 'no' },
    { q: 'Have you worked in journalism covering geopolitical disputes?',  a: 'no' },
    { q: 'Have you lived in a country called Vorland or Selkavia?',        a: 'no' },
    { q: 'Have you read academic papers on bilateral sanctions in 2024?',  a: 'no' },
    { q: 'Are you currently studying for a degree in economics or political science?', a: 'no' },
    { q: 'Have you served in a diplomatic role for any government?',       a: 'no' },
    { q: 'Have you written for a publication on rare-earth markets?',      a: 'no' },
    { q: 'Are you employed by a foreign ministry or trade ministry?',      a: 'no' },
    { q: 'Have you completed coursework on the 2017 Pricing Accord?',      a: 'no' },
    { q: 'Have you advised a corporation on trade with the Vorland region?', a: 'no' },
];

/* -------------------------------------------------------------------------
 *  9.  HELPERS — sequence retrieval for a participant
 * ----------------------------------------------------------------------- */
ROCONN.getEncodedOrdering = function (cond) {
    return ROCONN.sequences[cond.encodedSeq];
};

ROCONN.getNarrativeForSeq = function (seqNum) {
    return seqNum === 1 ? ROCONN.narrative.seq1 : ROCONN.narrative.seq2;
};

/* Returns the badge text strings (confirming / alternative) for a participant
   whose encoded sequence and pushed sequence are known. See protocol §5.4.1. */
ROCONN.getBadgeText = function (cond) {
    // The "key difference" is the position of Tariffs (E3) and Sanctions (E5).
    if (cond.encodedSeq === 1) {
        return {
            confirming:  'Tariffs (3rd), Sanctions (5th)',
            alternative: 'Sanctions (3rd), Tariffs (5th)',
        };
    } else {
        return {
            confirming:  'Sanctions (3rd), Tariffs (5th)',
            alternative: 'Tariffs (3rd), Sanctions (5th)',
        };
    }
};
