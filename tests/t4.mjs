import { simulate, SANE, DISCLOSE } from './sim.mjs';
let fails = 0;
const expect = (tag, r, { reason, files, withdraw }) => {
  const last = r.data[r.data.length - 1] || {};
  const ok = !r.fatal && r.errors.length === 0 && last.termination_reason === reason &&
             r.downloads.length === files && (withdraw === undefined || last.withdraw === withdraw);
  if (!ok) fails++;
  console.log(ok ? '  PASS' : `  FAIL (${tag}: reason ${last.termination_reason}, files ${r.downloads.length}, withdraw ${last.withdraw})`);
};

function summarise(tag, r) {
  const last = r.data[r.data.length-1] || {};
  console.log(`\n== ${tag} ==`);
  console.log(' fatal:', r.fatal ? r.fatal.message : 'none', '| errors:', r.errors.length,
              '| rows:', r.data.length);
  console.log(' downloads:', JSON.stringify(r.downloads));
  console.log(' termination_reason:', last.termination_reason,
              '| withdraw:', last.withdraw, '| encoding_failure:', last.encoding_failure);
  const msg = r.body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  console.log(' screen:', msg.slice(0,170));
  return last;
}

// 1. normal completion, consent to use data
const rN = await simulate('?cell=C1&sg=SG1&pid=PN01', {midPatch: SANE + DISCLOSE(0), maxMs:150000});
summarise('NORMAL (consents to data use)', rN);
expect('normal', rN, { reason: undefined, files: 2, withdraw: false });

// 2. withdrawal
const rW = await simulate('?cell=C2&sg=SG3&pid=PW01', {midPatch: SANE + DISCLOSE(1), maxMs:150000});
summarise('WITHDRAWAL', rW);
expect('withdrawal', rW, { reason: undefined, files: 1, withdraw: true });

// 3. consent declined
const declined = `(function(){ const o = ROCONN.phases.buildIntro;
  ROCONN.phases.buildIntro = function(){ const a=o.apply(this,arguments);
    a.forEach(t=>{ if(t.data&&t.data.phase==='consent') t.simulation_options={data:{response:1}}; });
    return a; }; })();`;
const rC = await simulate('?cell=C1&sg=SG1&pid=PC01', {midPatch: SANE + declined, maxMs:60000});
summarise('CONSENT DECLINED', rC);
expect('declined', rC, { reason: 'no_consent', files: 0 });

// 4. pre-quiz exclusion (answer "exposed" to everything)
const exposedAll = `(function(){ const o = ROCONN.phases.buildIntro;
  ROCONN.phases.buildIntro = function(){ const a=o.apply(this,arguments);
    a.forEach(t=>{ if(t.timeline) t.timeline.forEach(x=>{
      if(x.data&&x.data.phase==='prequiz') x.simulation_options={data:{response:x.data.exposed_answer}}; });});
    return a; }; })();`;
const rQ = await simulate('?cell=C1&sg=SG1&pid=PQ01', {midPatch: SANE + exposedAll, maxMs:60000});
summarise('PRE-QUIZ EXCLUSION', rQ);
expect('prequiz', rQ, { reason: 'prequiz_exclusion', files: 1 });

// 5. ineligible (age out of range)
const badAge = `(function(){ const o = ROCONN.phases.buildIntro;
  ROCONN.phases.buildIntro = function(){ const a=o.apply(this,arguments);
    a.forEach(t=>{ if(t.data&&t.data.phase==='eligibility_age')
      t.simulation_options={data:{response:{age:'62'}}}; });
    return a; }; })();`;
const rE = await simulate('?cell=C1&sg=SG1&pid=PE01', {midPatch: SANE + badAge, maxMs:60000});
summarise('INELIGIBLE (age 62)', rE);
expect('ineligible', rE, { reason: 'not_eligible', files: 1 });

// 6. recall gate failure -> filler track
const badRecall = `(function(){ const o = ROCONN.phases.buildRecallTest;
  ROCONN.phases.buildRecallTest = function(cond,label){ const a=o.call(this,cond,label);
    if(label==='immediate_recall'){
      const ord=ROCONN.getEncodedOrdering(cond); const resp={};
      ord.forEach((e,i)=> resp['pos_'+e]=String(((i+3)%7)+1));   // scrambled
      a.forEach(t=>{ if(t.data&&t.data.phase===label) t.simulation_options={data:{response:resp}}; });
    }
    return a; }; })();`;
const rf = await simulate('?cell=C3&sg=SG5&pid=PF01', {midPatch: SANE + badRecall, maxMs:90000});
const lastf = summarise('RECALL GATE FAILURE', rf);
expect('gate', rf, { reason: 'encoding_failure', files: 2 });
console.log(' filler trials run:', rf.data.filter(d=>d.phase==='filler_matrix').length,
            '| bisection rows:', rf.data.filter(d=>d.phase==='bisection').length,
            '| recall_correct:', rf.data.filter(d=>d.phase==='immediate_recall')[0]?.recall_correct);

// 7. live station opened without the randomisation-list parameters
const rm = await simulate('?cell=C1&sg=SG1', {midPatch: SANE, maxMs:3000});
console.log('\n== MISSING URL PARAMETER (pid) ==');
console.log(' rows:', rm.data.length, '| downloads:', JSON.stringify(rm.downloads));
const mtxt = rm.body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
console.log(' screen:', mtxt.slice(0,120));
const okM = rm.data.length===0 && rm.downloads.length===0 && /not ready/.test(mtxt);
if (!okM) fails++;
console.log(okM ? '  PASS' : '  FAIL');
console.log(fails === 0 ? '\nALL SESSION-END PATHS PASSED' : `\n${fails} PATH(S) FAILED`);
process.exit(fails ? 1 : 0);
