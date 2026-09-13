import { simulate, SANE, DISCLOSE } from './sim.mjs';

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
summarise('NORMAL (consents to data use)',
  await simulate('?cell=C1&sg=SG1&pid=PN01', {midPatch: SANE + DISCLOSE(0), maxMs:150000}));

// 2. withdrawal
summarise('WITHDRAWAL',
  await simulate('?cell=C2&sg=SG3&pid=PW01', {midPatch: SANE + DISCLOSE(1), maxMs:150000}));

// 3. consent declined
const declined = `(function(){ const o = ROCONN.phases.buildIntro;
  ROCONN.phases.buildIntro = function(){ const a=o.apply(this,arguments);
    a.forEach(t=>{ if(t.data&&t.data.phase==='consent') t.simulation_options={data:{response:1}}; });
    return a; }; })();`;
summarise('CONSENT DECLINED', await simulate('?cell=C1&sg=SG1&pid=PC01',
  {midPatch: SANE + declined, maxMs:60000}));

// 4. pre-quiz exclusion (answer "exposed" to everything)
const exposedAll = `(function(){ const o = ROCONN.phases.buildIntro;
  ROCONN.phases.buildIntro = function(){ const a=o.apply(this,arguments);
    a.forEach(t=>{ if(t.timeline) t.timeline.forEach(x=>{
      if(x.data&&x.data.phase==='prequiz') x.simulation_options={data:{response:x.data.exposed_answer}}; });});
    return a; }; })();`;
summarise('PRE-QUIZ EXCLUSION', await simulate('?cell=C1&sg=SG1&pid=PQ01',
  {midPatch: SANE + exposedAll, maxMs:60000}));

// 5. ineligible (age out of range)
const badAge = `(function(){ const o = ROCONN.phases.buildIntro;
  ROCONN.phases.buildIntro = function(){ const a=o.apply(this,arguments);
    a.forEach(t=>{ if(t.data&&t.data.phase==='eligibility_age')
      t.simulation_options={data:{response:{age:'62'}}}; });
    return a; }; })();`;
summarise('INELIGIBLE (age 62)', await simulate('?cell=C1&sg=SG1&pid=PE01',
  {midPatch: SANE + badAge, maxMs:60000}));

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
console.log(' filler trials run:', rf.data.filter(d=>d.phase==='filler_matrix').length,
            '| bisection rows:', rf.data.filter(d=>d.phase==='bisection').length,
            '| recall_correct:', rf.data.filter(d=>d.phase==='immediate_recall')[0]?.recall_correct);
