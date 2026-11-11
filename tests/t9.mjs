// Full-session structure: phase order, trial counts, written tests and manifest.
import { simulate, SANE, DISCLOSE } from './sim.mjs';
let fails = 0; const chk = (n, ok, extra='') => { if (!ok) fails++; console.log((ok?'  PASS ':'  FAIL ')+n+(extra?' — '+extra:'')); };

const r = await simulate('?cell=C3&sg=SG4&pid=PS01', {midPatch: SANE + DISCLOSE(0), maxMs: 150000});
chk('session completes without errors', r.finished && !r.fatal && r.errors.length === 0,
    r.fatal ? r.fatal.message : r.errors.join(' | '));
const D = r.data, ph = D.map(d => d.phase);
const first = p => ph.indexOf(p);
const order = ['immediate_recall', 'post_distractor_recall', 'training_check', 'bisection',
               'free_judgement', 'order_test3', 'order_test3_confidence', 'mc_connectedness',
               'mc_endorsement', 'fd_q1', 'fd_q3', 'full_disclosure', 'order_test4',
               'order_test4_confidence', 'climate_importance', 'data_decision'];
const idx = order.map(first);
chk('every stage present', idx.every(i => i >= 0), order.filter((p, k) => idx[k] < 0).join(', '));
chk('stages in the registered order', idx.every((v, k) => k === 0 || v > idx[k - 1]));
const bis = D.filter(d => d.phase === 'bisection'), fr = D.filter(d => d.phase === 'free_judgement');
chk('195 panel judgements', bis.length === 195, 'got ' + bis.length);
chk('40 panel-free judgements', fr.length === 40, 'got ' + fr.length);
chk('panel blocks follow SG4 (50, 100, 0)',
    JSON.stringify([1, 2, 3].map(b => bis.find(d => d.block_order === b).pressure)) === '[50,100,0]');
chk('panel-free rows carry last_pressure = 0', fr.every(d => d.last_pressure === 0));
chk('critical positions 3 and 5 present in both blocks',
    [3, 5].every(p => bis.some(d => d.probe_pos === p) && fr.some(d => d.probe_pos === p)));
const last = D[D.length - 1];
chk('order tests 3 and 4 scored (SANE answers = order read)',
    last.order_test3_correct === 7 && last.order_test3_pushed === 0 &&
    last.order_test4_correct === 7 && last.order_test4_pushed === 0);
chk('confidence on 1-7', [last.order_test3_confidence, last.order_test4_confidence].every(v => v >= 1 && v <= 7));
chk('every row stamped with protocol version', D.every(d => d.protocol_version === 'v7.0-RR-stage1'));
chk('two files downloaded', r.downloads.length === 2, JSON.stringify(r.downloads));
const man = (await import('vm')).default.runInContext(
  `roconnBuildConditionCSV(ROCONN.assignCondition(), window.__jsPsych)`, r.ctx).split('\n');
const H = man[0].split(','), V = man[1].split(',');
const M = Object.fromEntries(H.map((h, i) => [h, V[i]]));
chk('manifest has the new columns', ['order_test3_correct','order_test3_pushed','order_test3_confidence',
    'order_test4_correct','order_test4_pushed','order_test4_confidence','protocol_version'].every(c => c in M));
chk('manifest values filled', M.order_test4_correct === '7' && M.withdrew === '0' && M.protocol_version === 'v7.0-RR-stage1',
    `${M.order_test4_correct} ${M.withdrew} ${M.protocol_version}`);
console.log(fails === 0 ? '\nFULL-SESSION CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
process.exit(fails ? 1 : 0);
