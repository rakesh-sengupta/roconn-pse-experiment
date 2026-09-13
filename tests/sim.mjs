import { JSDOM } from 'jsdom';
import fs from 'fs'; import vm from 'vm';
const REPO = '../roconn-pse-experiment-main';
const PLUGINS = ['node_modules/jspsych/dist/index.browser.js',
 'node_modules/@jspsych/plugin-html-keyboard-response/dist/index.browser.js',
 'node_modules/@jspsych/plugin-html-button-response/dist/index.browser.js',
 'node_modules/@jspsych/plugin-survey-text/dist/index.browser.js',
 'node_modules/@jspsych/plugin-survey-likert/dist/index.browser.js',
 'node_modules/@jspsych/plugin-survey-multi-choice/dist/index.browser.js',
 'node_modules/@jspsych/plugin-preload/dist/index.browser.js',
 'node_modules/@jspsych/plugin-call-function/dist/index.browser.js',
 'node_modules/@jspsych/plugin-fullscreen/dist/index.browser.js'];

export async function simulate(query, {mode='data-only', midPatch=null, maxMs=90000} = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><head><title>t</title></head><body></body></html>',
    { url:'http://localhost:8000/'+query, pretendToBeVisual:true, runScripts:'outside-only' });
  const w = dom.window;
  w.HTMLElement.prototype.requestFullscreen = () => Promise.resolve();
  w.Document.prototype.exitFullscreen = () => Promise.resolve();
  Object.defineProperty(w.document,'fullscreenElement',{get:()=>null,configurable:true});
  w.URL.createObjectURL = () => 'blob:stub'; w.URL.revokeObjectURL = () => {};
  const downloads = [];
  const oc = w.document.createElement.bind(w.document);
  w.document.createElement = t => { const el=oc(t);
    if(String(t).toLowerCase()==='a') el.click=()=>downloads.push(el.download);
    return el; };

  const ctx = vm.createContext(w);
  for (const f of PLUGINS) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
  vm.runInContext('window.initJsPsych = jsPsychModule.initJsPsych;', ctx);

  const warnings=[], errors=[];
  w.console.warn=(...a)=>warnings.push(a.join(' '));
  w.console.error=(...a)=>errors.push(a.join(' '));
  w.console.log=()=>{};

  vm.runInContext(`(function(){const o=window.initJsPsych;
    window.initJsPsych=function(op){const jp=o(op);const rr=jp.run.bind(jp);
      jp.run=function(tl){window.__timeline=tl;jp.run=rr;};window.__jsPsych=jp;return jp;};})();`, ctx);

  let fatal=null;
  try {
    for (const f of ['js/config.js','js/panels.js','js/tasks.js','js/phases.js'])
      vm.runInContext(fs.readFileSync(`${REPO}/${f}`,'utf8'), ctx, {filename:f});
    if (midPatch) vm.runInContext(midPatch, ctx, {filename:'midPatch'});
    vm.runInContext(fs.readFileSync(`${REPO}/js/experiment.js`,'utf8'), ctx, {filename:'js/experiment.js'});
    vm.runInContext(`window.__jsPsych.simulate(window.__timeline, ${JSON.stringify(mode)});`, ctx);
  } catch(e){ fatal=e; }

  const t0=Date.now(); let finished=false;
  while (Date.now()-t0 < maxMs) {
    await new Promise(r=>setTimeout(r,40));
    const b = w.document.body.innerHTML;
    if (b.includes('Session complete') || b.includes('Session record')) { finished=true; break; }
  }
  await new Promise(r=>setTimeout(r,1200));   // let the staggered manifest download fire
  let data=[];
  try { data = vm.runInContext('window.__jsPsych.data.get().values()', ctx); } catch(e){}
  const out = { w, ctx, data, downloads, warnings, errors, fatal, finished,
                body: w.document.body.innerHTML };
  dom.window.close();
  return out;
}

/* Force sensible simulated answers so gates behave deterministically. */
export const SANE = `
(function(){
  const wrap = (name, fn) => { const o = ROCONN.phases[name];
    ROCONN.phases[name] = function(){ return fn(o.apply(this, arguments), arguments); }; };
  const tag = (t, d) => { t.simulation_options = { data: d }; return t; };

  wrap('buildIntro', (arr) => {
    arr.forEach(t => {
      if (t.data && t.data.phase === 'consent')      tag(t, { response: 0 });
      if (t.data && t.data.phase === 'instructions') tag(t, { response: 0 });
      if (t.data && t.data.phase === 'eligibility_age') tag(t, { response: { age: '24' } });
      if (t.timeline) t.timeline.forEach(x => {
        if (x.data && x.data.phase === 'eligibility')
          tag(x, { response: x.data.eligible_answer });
        if (x.data && x.data.phase === 'prequiz')
          tag(x, { response: x.data.exposed_answer === 0 ? 1 : 0 });  // never "exposed"
      });
    });
    return arr;
  });

  wrap('buildTraining', (obj) => {
    obj.timeline.forEach(t => { if (t.data && t.data.phase === 'training_check')
      tag(t, { response: 1 }); });
    return obj;
  });

  const origRecall = ROCONN.phases.buildRecallTest;
  ROCONN.phases.buildRecallTest = function(cond, label) {
    const arr = origRecall.call(this, cond, label);
    const ordering = ROCONN.getEncodedOrdering(cond);
    const resp = {}; ordering.forEach((eid,i)=> resp['pos_'+eid] = String(i+1));
    arr.forEach(t => { if (t.data && t.data.phase === label) tag(t, { response: resp }); });
    return arr;
  };
})();`;

/* Force the final consent-to-use choice. 0 = allow, 1 = withdraw. */
export const DISCLOSE = (choice) => `
(function(){ const o = ROCONN.phases.buildDebrief;
  ROCONN.phases.buildDebrief = function(){ const a = o.apply(this, arguments);
    a.forEach(t => { if (t.data && t.data.phase === 'full_disclosure')
      t.simulation_options = { data: { response: ${choice} } };
      if (t.data && t.data.phase === 'fd_q3')
      t.simulation_options = { data: { response: { fd_q3: 'Yes' } } }; });
    return a; }; })();`;
