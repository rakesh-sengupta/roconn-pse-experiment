// Writes one simulated session per cell x block-order subgroup (24 files) to
// tests/pipeline_test/templates/. synthetic_sessions.R then replaces the
// judgement responses with responses drawn from a known model, so the
// pipeline is tested on files with exactly the structure the experiment writes.
import { simulate, SANE, DISCLOSE, REPO } from './sim.mjs';
import fs from 'fs'; import vm from 'vm';
const out = `${REPO}/tests/pipeline_test/templates`;
fs.mkdirSync(out, { recursive: true });
let n = 0;
for (const cell of ['C1', 'C2', 'C3', 'C4']) for (const sg of ['SG1', 'SG2', 'SG3', 'SG4', 'SG5', 'SG6']) {
  const pid = `T${cell}${sg}`;
  const r = await simulate(`?cell=${cell}&sg=${sg}&pid=${pid}`, { midPatch: SANE + DISCLOSE(0), maxMs: 60000 });
  if (!r.finished || r.fatal) { console.log('FAILED', cell, sg); process.exit(1); }
  fs.writeFileSync(`${out}/roconn_${pid}_${cell}_${sg}.csv`, vm.runInContext('window.__jsPsych.data.get().csv()', r.ctx));
  n++;
}
console.log(n, 'template sessions written to', out);
