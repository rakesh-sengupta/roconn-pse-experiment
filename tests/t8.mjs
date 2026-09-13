import { simulate, SANE, DISCLOSE } from './sim.mjs';
import fs from 'fs'; import vm from 'vm';
const r = await simulate('?cell=C1&sg=SG1&pid=PH01', {midPatch: SANE+DISCLOSE(0), maxMs:150000});
const csv  = vm.runInContext('window.__jsPsych.data.get().csv()', r.ctx);
fs.mkdirSync('../pipeline_test/data',{recursive:true});
fs.writeFileSync('../pipeline_test/data/roconn_PH01_C1_SG1.csv', csv);
console.log('HEADER:'); console.log(csv.split('\n')[0]);
console.log('rows:', csv.split('\n').length-1);
