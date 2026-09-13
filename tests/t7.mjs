import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom';
const REPO='../roconn-pse-experiment-main';
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'http://x/',pretendToBeVisual:true});
const w=dom.window; const ctx=vm.createContext(w);
// minimal jsPsych stand-in for the pieces phases.js touches at build time
vm.runInContext(`
  window.jsPsych = { timelineVariable: k => ({__tv:k}), randomization: { shuffle: a => a.slice() },
                     data: { addProperties(){}, get(){ return {last(){return{values(){return[{}];}}}}; } } };
  window.jsPsychHtmlButtonResponse='hbr'; window.jsPsychHtmlKeyboardResponse='hkr';
  window.jsPsychSurveyText='st'; window.jsPsychSurveyLikert='sl';
  window.jsPsychSurveyMultiChoice='smc'; window.jsPsychCallFunction='cf';
  window.jsPsychFullscreen='fs'; window.jsPsychPreload='pl';
`,ctx);
for (const f of ['js/config.js','js/panels.js','js/tasks.js','js/phases.js'])
  vm.runInContext(fs.readFileSync(`${REPO}/${f}`,'utf8'),ctx,{filename:f});
vm.runInContext('window.__R=ROCONN;',ctx);
const R=w.__R;
const cond={pid:'X',cell:'C1',subgroup:'SG1',topology:'high',direction:'seq1to2',
            encodedSeq:1,pushedSeq:2,pressureOrder:[0,50,100]};
let fails=0; const chk=(n,ok,extra='')=>{ if(!ok) fails++; console.log((ok?'  PASS ':'  FAIL ')+n+(extra?' — '+extra:'')); };

// ---------- 1. recall permutation validator ----------
const rec = R.phases.buildRecallTest(cond,'immediate_recall').find(t=>t.data&&t.data.phase==='immediate_recall');
w.document.body.innerHTML =
  `<form id="jspsych-survey-text-form">` +
  Array.from({length:7},(_,i)=>`<input type="text" name="q${i}">`).join('') +
  `<button id="jspsych-survey-text-next">Continue</button></form>`;
rec.on_load.call(null);
const inputs=[...w.document.querySelectorAll('input[type=text]')];
const btn=w.document.getElementById('jspsych-survey-text-next');
const fire=()=>inputs.forEach(i=>i.dispatchEvent(new w.Event('input')));
chk('validator starts disabled', btn.disabled===true);
inputs.forEach((el,i)=>el.value=String(i+1)); fire();
chk('valid 1-7 permutation enables', btn.disabled===false);
inputs[3].value='3'; fire();
chk('duplicate disables', btn.disabled===true);
inputs[3].value='8'; fire();
chk('out-of-range disables', btn.disabled===true);
inputs[3].value=''; fire();
chk('blank disables', btn.disabled===true);
inputs[3].value='4'; fire();
chk('recovers when fixed', btn.disabled===false);
chk('maxlength/inputmode set', inputs.every(i=>i.getAttribute('maxlength')==='1'&&i.getAttribute('inputmode')==='numeric'));
// scoring
const ord=R.getEncodedOrdering(cond); const resp={}; ord.forEach((e,i)=>resp['pos_'+e]=String(i+1));
const d={response:resp}; rec.on_finish.call(null,d);
chk('scoring: perfect = 7/7', d.recall_correct===7, 'got '+d.recall_correct);
const resp2={...resp}; resp2['pos_'+ord[0]]='2'; resp2['pos_'+ord[1]]='1';
const d2={response:resp2}; rec.on_finish.call(null,d2);
chk('scoring: one swap = 5/7', d2.recall_correct===5, 'got '+d2.recall_correct);
chk('true_/given_ columns written', d2.true_E1===1 && d2.given_E1===2);

// ---------- 2. word search ----------
const ws=R.buildWordSearch();
w.document.body.innerHTML = ws.stimulus;
ws.on_load.call(null);
const cells=[...w.document.querySelectorAll('.ws-cell')];
const listed=[...w.document.querySelectorAll('#ws-list li')].map(li=>li.textContent);
chk('grid is 12x12 = 144 cells', cells.length===144, 'got '+cells.length);
chk('8 words placed', listed.length===8, 'got '+listed.length);
chk('all cells have a letter', cells.every(c=>/^[A-Z]$/.test(c.textContent)));
// find the first listed word in the grid and click it
const N=12, at=(r,c)=>cells[r*N+c];
const grid=Array.from({length:N},(_,r)=>Array.from({length:N},(_,c)=>at(r,c).textContent));
const dirs=[[0,1],[1,0],[1,1],[-1,1],[0,-1],[-1,0],[-1,-1],[1,-1]];
let found=null;
outer: for(const word of listed) for(let r=0;r<N;r++) for(let c=0;c<N;c++) for(const [dr,dc] of dirs){
  const re=r+dr*(word.length-1), ce=c+dc*(word.length-1);
  if(re<0||re>=N||ce<0||ce>=N) continue;
  let ok=true; for(let k=0;k<word.length;k++) if(grid[r+dr*k][c+dc*k]!==word[k]){ok=false;break;}
  if(ok){ found={word,r,c,re,ce}; break outer; }
}
chk('at least one listed word is actually in the grid', !!found, found?found.word:'none');
if(found){
  at(found.r,found.c).dispatchEvent(new w.Event('click',{bubbles:true}));
  at(found.re,found.ce).dispatchEvent(new w.Event('click',{bubbles:true}));
  chk('click-click selection marks the word found', R._wsFound===1, 'wsFound='+R._wsFound);
  const dd={}; ws.on_finish.call(null,dd);
  chk('found/total logged', dd.wordsearch_found===1 && dd.wordsearch_total===8);
}

// ---------- 3. matrix items ----------
const mt=R.buildMatrixTask(); const items=mt.filter(t=>t.data&&t.data.phase==='distractor_matrix');
chk('10 matrix items built', items.length===10, 'got '+items.length);
chk('each item has 6 options', items.every(t=>t.choices.length===6));
chk('correct_index in range', items.every(t=>t.data.correct_index>=0 && t.data.correct_index<6));
chk('options are unique per item', items.every(t=>new Set(t.choices).size===6));
chk('grid shows 8 glyphs + 1 missing',
     items.every(t=>(t.stimulus.match(/mtx-cell/g)||[]).length===9
                 && (t.stimulus.match(/mtx-missing/g)||[]).length===1));
const dm={response:items[0].data.correct_index, correct_index:items[0].data.correct_index};
items[0].on_finish.call(null,dm); chk('matrix scoring correct=1', dm.matrix_correct===1);
const dm2={response:null, correct_index:items[0].data.correct_index};
items[0].on_finish.call(null,dm2); chk('matrix timeout scored 0', dm2.matrix_correct===0);

// ---------- 4. filler track ----------
const fl=R.buildFillerTask();
chk('filler ~15 min of items', fl.length===20, 'got '+fl.length);
chk('filler tagged separately', fl.every(t=>t.data.phase==='filler_matrix'));

// ---------- 5. elastic rest window ----------
const dis=R.phases.buildDistractor();
const rest=dis[dis.length-1];
R._distractorStart = w.performance.now() - 300000;    // pretend 5 min already gone
const dur1=rest.trial_duration();
R._distractorStart = w.performance.now() - 1190000;   // pretend 19m50s gone
const dur2=rest.trial_duration();
chk('rest absorbs remaining time', Math.abs(dur1-900000)<2000, 'got '+Math.round(dur1/1000)+'s');
chk('rest respects the 2-min floor', Math.abs(dur2-120000)<2000, 'got '+Math.round(dur2/1000)+'s');

// ---------- 6. bisection block structure ----------
const blk=R.phases.buildBisectionBlock(cond,50,0,1);
const proc=blk.find(t=>t.timeline);
chk('65 trials per block', proc.timeline_variables.length===65, 'got '+proc.timeline_variables.length);
const counts={}; proc.timeline_variables.forEach(v=>counts[v.probe_pos]=(counts[v.probe_pos]||0)+1);
chk('13 reps of each probe position', [2,3,4,5,6].every(p=>counts[p]===13), JSON.stringify(counts));
chk('probe labels follow the encoded ordering',
    proc.timeline_variables.every(v=>v.probe_eid===R.getEncodedOrdering(cond)[v.probe_pos-1]));
chk('anchors are E1 and E7',
    proc.timeline_variables[0].stageA_html.includes(R.events.E1.label) &&
    proc.timeline_variables[0].stageA_html.includes(R.events.E7.label));
chk('panel persists in stage A, stage B and ITI',
    proc.timeline_variables[0].stageA_html.includes('cpanel') &&
    proc.timeline_variables[0].stageB_html.includes('cpanel') &&
    blk[0] && proc.timeline[2].stimulus.includes('cpanel'));
chk('probe hidden in stage A, shown in stage B',
    !proc.timeline_variables[0].stageA_html.includes(R.events[proc.timeline_variables[0].probe_eid].label) &&
     proc.timeline_variables[0].stageB_html.includes(R.events[proc.timeline_variables[0].probe_eid].label));

console.log(fails===0 ? '\nALL UNIT CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
