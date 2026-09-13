/* =========================================================================
 *  config.js  —  ROCONN Asymmetric PSE Shift  (jsPsych implementation)
 *
 *  Cells, sequences, narrative, and runtime parameters per Protocol v5.
 *
 *  --- v6.0 (this revision) ---------------------------------------------
 *   A. Narrative replaced with the Vorland climate scenario (Judith Grace
 *      Lazarus, Sept 2026), expanded to ~1,200 words and rewritten so that
 *      every paragraph is position-neutral. E3 and E5 are matched for
 *      length, structure, register, and concreteness.
 *   B. Transposable pair renamed: "Emission penalty" (E3) and
 *      "Restoration levy" (E5). The draft labels ("eco tax" / "green tax")
 *      were too close to discriminate on a badge.
 *   C. Avatar rotation schedule replaced. The old schedule put avatar Fa in
 *      the alternative-endorsing set (positions 1-3) in ALL THREE blocks and
 *      left Fb at position 2 in two consecutive blocks -- exactly the
 *      profile-trust confound v5 5.3.2 was written to prevent. The new
 *      schedule is a cyclic shift of two positions per block.
 *   D. Pre-quiz replaced with climate items; two are reverse-keyed, so the
 *      score is the number of EXPOSED answers, not the number of "yes".
 *   E. Eligibility screen added (age, language, vision, diagnosis).
 *   F. Unused isiMs parameter removed. The probe appears at the 2,000 ms
 *      mark with the anchors still on screen.
 *   G. distractorTotalMs is now USED: the closing rest screen absorbs
 *      whatever time the puzzles did not, so the distractor window is a
 *      fixed 20 minutes for everyone.
 * ========================================================================= */

const ROCONN = {};   // global namespace

/* -------------------------------------------------------------------------
 *  1.  RUN-TIME PARAMETERS
 * ----------------------------------------------------------------------- */
ROCONN.params = {
    // Timing (ms)
    anchorPreviewMs:   2000,   // anchors visible before probe appears
    itiMinMs:           800,
    itiMaxMs:          1200,
    maxResponseMs:     4000,
    panelLoadPauseMs:  5000,
    interBlockRestMs: 180000,  // 3 min between blocks

    // Distractor window. distractorTotalMs is the FIXED total; the closing
    // rest screen is stretched or shrunk to hit it exactly.
    distractorTotalMs:1200000, // 20 min, identical for every participant
    wordsearchMs:    480000,   // 8 min
    restMinMs:       120000,   // rest never shorter than 2 min
    encodingFailFillerMs: 900000, // 15 min filler track

    // Trial structure
    trialsPerBlock:    65,     // 5 probe positions x 13 reps
    probePositions: [2, 3, 4, 5, 6],
    criticalProbes: [3, 5],    // the transposed pair -- primary DV
    controlProbes:  [2, 4, 6],
    pressureLevels:  [0, 50, 100],

    // Recall
    immediateRecallGate:      6,  // >=6/7 to proceed
    postDistractorRecallGate: 4,  // recorded as covariate; NOT a gate

    // Pre-quiz threshold
    prequizMaxScore: 3,        // exclude if >3/10 exposed answers

    // Eligibility
    ageMin: 18,
    ageMax: 45,

    // Response keys
    keyLeft:  'f',  // closer to Start
    keyRight: 'j',  // closer to End

    repsPerProbe: 13,          // 5 positions x 13 = 65 trials/block

    // In-browser distractor tasks (tasks.js)
    matrixItems:      10,
    matrixItemMaxMs:  45000,
    wordsearchGrid:   12,
    wordsearchCount:  8,
};

/* -------------------------------------------------------------------------
 *  1a. COVER STORY
 * ----------------------------------------------------------------------- */
ROCONN.studyName = 'Document Review Study';

/* -------------------------------------------------------------------------
 *  1b. DEMO MODE (?demo=1). NEVER for data collection. Demo sessions are
 *      identifiable by trial count (10 instead of 65 per block) and by the
 *      demo flag stamped on every row.
 * ----------------------------------------------------------------------- */
ROCONN.demo = (function () {
    const p = new URLSearchParams(window.location.search);
    if (p.get('demo') === '1') return true;
    if (p.get('demo') === '0') return false;
    return window.location.protocol === 'file:';
})();
if (ROCONN.demo) {
    Object.assign(ROCONN.params, {
        anchorPreviewMs:      800,
        panelLoadPauseMs:    1000,
        interBlockRestMs:    4000,
        distractorTotalMs:  25000,
        wordsearchMs:        8000,
        restMinMs:           3000,
        encodingFailFillerMs:8000,
        repsPerProbe:           2,
        matrixItems:            3,
        matrixItemMaxMs:     8000,
    });
    console.warn('ROCONN: DEMO MODE - gates bypassed, timing shortened. Not for data collection.');
}

/* -------------------------------------------------------------------------
 *  2.  BETWEEN-SUBJECTS CELLS
 * ----------------------------------------------------------------------- */
ROCONN.cells = {
    C1: { topology: 'high', encodes: 1, pushedTo: 2, direction: 'seq1to2' },
    C2: { topology: 'high', encodes: 2, pushedTo: 1, direction: 'seq2to1' },
    C3: { topology: 'low',  encodes: 1, pushedTo: 2, direction: 'seq1to2' },
    C4: { topology: 'low',  encodes: 2, pushedTo: 1, direction: 'seq2to1' },
};

/* -------------------------------------------------------------------------
 *  3.  SIX-SUBGROUP BALANCED LATIN SQUARE
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
 *  4.  AVATAR ROTATION SCHEDULE
 *      Cyclic shift of two positions per block over Fa Fb Fc Ga Gb Gc.
 *
 *          block  pos1 pos2 pos3 | pos4 pos5 pos6
 *          A      Fa   Fb   Fc   | Ga   Gb   Gc
 *          B      Fc   Ga   Gb   | Gc   Fa   Fb
 *          C      Gb   Gc   Fa   | Fb   Fc   Ga
 *
 *      Every avatar changes position in every block; each sits in the
 *      endorsing set (positions 1-3) once or twice, never all three times.
 * ----------------------------------------------------------------------- */
ROCONN.avatarSchedule = {
    blkA: ['Fa', 'Fb', 'Fc', 'Ga', 'Gb', 'Gc'],
    blkB: ['Fc', 'Ga', 'Gb', 'Gc', 'Fa', 'Fb'],
    blkC: ['Gb', 'Gc', 'Fa', 'Fb', 'Fc', 'Ga'],
};
const BLOCK_AVATAR_ORDER = ['blkA', 'blkB', 'blkC'];

/* -------------------------------------------------------------------------
 *  5.  RUNTIME CONDITION ASSIGNMENT
 *      Live sessions MUST pass ?cell=&sg=&pid= from randomisation_list.csv.
 *      Rows with assignment = 'random' are excluded as protocol violations.
 * ----------------------------------------------------------------------- */
ROCONN.makeParticipantId = function () {
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

    if (!ROCONN.cells[cell])   throw new Error('Bad cell ' + cell);
    if (!ROCONN.subgroups[sg]) throw new Error('Bad subgroup ' + sg);

    return {
        pid: pid,
        cell: cell,
        subgroup: sg,
        topology:  ROCONN.cells[cell].topology,
        direction: ROCONN.cells[cell].direction,
        encodedSeq: ROCONN.cells[cell].encodes,
        pushedSeq:  ROCONN.cells[cell].pushedTo,
        pressureOrder: ROCONN.subgroups[sg],
        assignment: (cellParam || sgParam || pidParam) ? 'url' : 'random',
        demo: ROCONN.demo ? 1 : 0,
        sessionStart: new Date().toISOString(),
    };
};

function pickRandom (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/* -------------------------------------------------------------------------
 *  6.  THE TWO SEQUENCES. E3 and E5 are transposed between sequences.
 * ----------------------------------------------------------------------- */
ROCONN.events = {
    E1: { id: 'E1', label: 'Continental climate alert issued',
          short: 'Climate alert' },
    E2: { id: 'E2', label: 'Emergency environmental summit held',
          short: 'Emergency summit' },
    E3: { id: 'E3', label: 'Emission penalty proposed',
          short: 'Emission penalty' },
    E4: { id: 'E4', label: 'Oversight committee created',
          short: 'Oversight committee' },
    E5: { id: 'E5', label: 'Restoration levy proposed',
          short: 'Restoration levy' },
    E6: { id: 'E6', label: 'Policy compromise reached',
          short: 'Policy compromise' },
    E7: { id: 'E7', label: 'Climate target met',
          short: 'Target met' },
};

ROCONN.sequences = {
    1: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'],   // penalty 3rd, levy 5th
    2: ['E1', 'E2', 'E5', 'E4', 'E3', 'E6', 'E7'],   // levy 3rd, penalty 5th
};

/* -------------------------------------------------------------------------
 *  7.  NARRATIVE  -  "The Vorland Climate Dispute"  (~1,200 words)
 *
 *      Structural contract:
 *        - seven events, one paragraph each; E1 opens, E7 closes
 *        - E3 and E5 contain NO reference to each other, to E4, or to E6,
 *          and no temporal connectives, so either can appear third
 *        - E4 is compatible with either E3 or E5 preceding it
 *        - E6 and E7 refer to the two charges symmetrically
 *        - E3 and E5 are matched in length and structure
 *          (proposal -> mechanism -> evidence -> who pays -> objection -> minuted)
 * ----------------------------------------------------------------------- */
ROCONN.narrative = {
    title: 'The Vorland Climate Dispute',
    intro:
`Vorland is a continent of forty-three countries, running from temperate
farmland in the north to dense coastal forest along its southern rim. Its
economies grew quickly over three decades on heavy manufacturing, mining,
and timber. The forty-three governments are joined by the Climate
Protection Treaty, an agreement drawn up in the assembly city of Halvik
that sets shared limits on industrial emissions and is administered by a
body called the United Committee of Vorland. Environmental groups across
the continent argue that industrial practice has outrun those limits and
that firms exceeding them should pay for the damage. Industry associations
argue that new charges would raise costs, slow production, and put jobs at
risk in the countries that depend most on manufacturing. The dispute
between these two positions came to a head over the course of a single
year. What follows is a record of seven major events in that dispute, as
reported by independent international observers.`,

    seq1: {
        E1: `The United Committee of Vorland issued a continental climate alert.
The Committee's report on the state of the continent recorded the highest
greenhouse gas concentrations in the measurement record, and found that a
majority of Vorland's forty-three countries were operating above the
limits written into the Climate Protection Treaty. The report named
industrial practice as the main driver and set out three consequences in
detail: rising average temperatures across the northern farmland, a
measurable decline in air quality throughout the manufacturing belt, and
chemical residues in rivers and coastal water. The alert is the highest of
the three warning levels available to the Committee, and it obliges every
member government to respond in writing. Newspapers in most member
countries carried the finding on their front pages, and several printed
their own country's emission figures alongside the continental total.
The Committee gave member governments sixty days to reply.`,

        E2: `Environmental groups organised public demonstrations in the capitals
of more than twenty Vorland countries, calling for the Climate Protection
Treaty to be strengthened rather than restated. The United Committee
called an emergency environmental summit at Halvik. Environment ministers
from all forty-three countries attended, together with climate scientists
appointed as technical advisers, and the working sessions were held in
private across six days. The declared purpose of the summit was to draft
an amendment to the treaty that would attach enforceable consequences to
exceeding the emission limits. News crews filmed delegations arriving at
and leaving the assembly hall. Reporters pressed for details of what was
being discussed inside; the delegations gave no public statements, and the
Committee released only a daily notice confirming that sessions had taken
place. Industry associations requested observer status and were refused, and
issued a statement calling the process closed to the people it affects.`,

        E3: `A proposal for an emission penalty was placed before the Halvik
assembly. Under the proposal, manufacturers whose emissions exceed the
treaty limit pay a charge scaled to the size of the excess, on the
principle that the party causing the pollution carries its cost. Several
local governments in northern Vorland already run schemes of this kind for
water discharge, and the technical advisers reported that firms in those
districts had moved to cleaner processes rather than pay repeatedly. The
charge would fall on roughly four hundred of the continent's largest
industrial sites, identified from the emission registers that member
countries already maintain. Industry associations objected that the charge
would weigh most heavily on countries whose economies rest on a single
manufacturing sector, and that firms would relocate rather than reinvest.
The proposal was entered in the assembly minutes and circulated to every
delegation.`,

        E4: `The assembly created an independent oversight committee to monitor
how the amended treaty would be applied. A senior judge from Halvik, whose
earlier work was in environmental law, was appointed to lead it, with a
staff of auditors drawn in equal number from member countries. The
committee has the power to enter and audit any industrial site named in a
member country's emission register, and to publish what it finds. It does
not have the power to impose or collect a charge; that responsibility
stays with the government of the country in which the site operates.
Several delegations argued for giving the committee direct enforcement
powers and were outvoted. The appointment was announced publicly, and the
Committee stated that the oversight body would report to the assembly
twice a year and to the public once. Its findings carry no penalty on
their own, but member governments must act on them or explain why not.`,

        E5: `A proposal for a restoration levy was placed before the Halvik
assembly. Under the proposal, firms extracting timber, minerals, or peat
pay a charge on the volume they remove, and the money collected is held in
a continental fund that pays for repairing damaged land. The technical
advisers reported that roughly a fifth of Vorland's southern forest had
been cleared for resources over the past three decades, and that cleared
ground left untreated does not recover on its own within a human lifetime.
The fund would pay for replanting cleared forest, restoring drained
wetland, and returning exhausted farmland to productive use. Industry associations objected that the charge
would apply to volume removed rather than to any measured damage, and that
extraction firms would carry the cost of harm done decades earlier. The
proposal was entered in the assembly minutes and circulated to every
delegation.`,

        E6: `The industry associations and the environment ministers reached a
compromise across several rounds of negotiation. The amended
treaty tightens the emission allowance for private corporations on a fixed
schedule, and gives essential public utilities - power, water, and public
transport - a longer period to reach the same standard. Charges apply in
full to private industry from the first year and to public utilities from
the fourth. Both sides described the outcome as less than they had asked
for. Environmental groups said the delay for utilities weakens the
amendment where emissions are largest; industry associations said the
schedule for private firms is faster than any of their members can meet.
The Committee circulated the compromise text to all forty-three
governments for a final vote and released it to the press the same day.`,

        E7: `Forty-two of Vorland's forty-three countries signed the amendment to
the Climate Protection Treaty. The Republic of Elendia, whose economy
depends most heavily on heavy manufacturing, declined to sign and cited
the cost to its industry. Continental emissions fell below the treaty
limit within the period the amendment set, and the United Committee
formally closed the emergency. Money collected through the emission
penalty and the restoration levy paid for replanting in the southern
forest and for treating polluted river systems, and the first surveys of
the treated areas recorded returning plant and insect populations.
Observers outside Vorland described the amendment as the clearest example
so far of a continental agreement that produced a measurable environmental
result, and three other regional bodies asked the Committee for its
drafting documents. The Committee published a final account of the
emergency period, and noted that the measured fall in emissions came
faster than its own advisers had projected at the outset.`,
    },

    seq2: {},   // filled below
};

/* Sequence 2: identical paragraph text, positions 3 and 5 swapped. */
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
 *  8.  ELIGIBILITY SCREEN
 * ----------------------------------------------------------------------- */
ROCONN.eligibility = {
    ageQuestion: 'What is your age in years?',
    items: [
        { name: 'elig_english', q: 'Are you fluent in English?', eligible: 0 },
        { name: 'elig_vision',  q: 'Is your vision normal, or corrected to normal with glasses or lenses?', eligible: 0 },
        { name: 'elig_dx',      q: 'Do you have a diagnosed neurological or psychiatric condition?', eligible: 1 },
    ],
};

/* -------------------------------------------------------------------------
 *  9.  PRE-QUIZ (10 climate familiarity items)
 *      `exposed` gives the button index (0 = Yes, 1 = No) that counts
 *      toward the exposure score. Items 6 and 10 are reverse-keyed.
 *      Score >3 excludes.
 * ----------------------------------------------------------------------- */
ROCONN.prequiz = [
    { q: 'Have you taken a university course in environmental science, climate policy, or ecology?', exposed: 0 },
    { q: 'Have you worked or interned for an environmental organisation or a government environment department?', exposed: 0 },
    { q: 'Have you read research articles on emissions pricing or carbon taxation?', exposed: 0 },
    { q: 'Have you lived in a region called Vorland?', exposed: 0 },
    { q: 'Have you followed international climate negotiations closely over the past year?', exposed: 0 },
    { q: 'Would you say you have never read a government or agency report on climate policy?', exposed: 1 },
    { q: 'Have you written or spoken publicly about climate or environmental policy?', exposed: 0 },
    { q: 'Are you currently studying economics, law, or public policy?', exposed: 0 },
    { q: 'Have you worked in mining, forestry, or heavy manufacturing?', exposed: 0 },
    { q: 'Would you say you have never taken part in a climate-related campaign or petition?', exposed: 1 },
];

/* -------------------------------------------------------------------------
 * 10.  HELPERS
 * ----------------------------------------------------------------------- */
ROCONN.getEncodedOrdering = function (cond) {
    return ROCONN.sequences[cond.encodedSeq];
};

ROCONN.getNarrativeForSeq = function (seqNum) {
    return seqNum === 1 ? ROCONN.narrative.seq1 : ROCONN.narrative.seq2;
};

/* Badge text: only the position of the two transposed events, by short
   name. Derived from ROCONN.events so it cannot silently drift from the
   narrative the way the hard-coded trade-dispute strings did. */
ROCONN.getBadgeText = function (cond) {
    const a = ROCONN.events.E3.short;   // proposal at position 3 in Seq 1
    const b = ROCONN.events.E5.short;   // proposal at position 5 in Seq 1
    const seq1Text = a + ' (3rd), ' + b + ' (5th)';
    const seq2Text = b + ' (3rd), ' + a + ' (5th)';
    return (cond.encodedSeq === 1)
        ? { confirming: seq1Text, alternative: seq2Text }
        : { confirming: seq2Text, alternative: seq1Text };
};
