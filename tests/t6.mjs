import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom';
import { REPO } from './sim.mjs';
let fails = 0; const chk = (n, ok, extra='') => { if (!ok) fails++; console.log((ok?'  PASS ':'  FAIL ')+n+(extra?' — '+extra:'')); };
function load(query){
  const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'http://x/'+query});
  const w=dom.window; const ctx=vm.createContext(w);
  vm.runInContext(fs.readFileSync(`${REPO}/js/config.js`,'utf8'),ctx);
  vm.runInContext(fs.readFileSync(`${REPO}/js/panels.js`,'utf8'),ctx);
  vm.runInContext('window.__R=ROCONN;',ctx);
  return {w, R:w.__R};
}
const {R}=load('');
// --- panels ---
for (const topo of ['high','low']) for (const p of [0,50,100]) {
  const html=R.buildPanel({topology:topo,pressure:p,encodedSeq:1,blockIndex:0});
  const edges=(html.match(/<line /g)||[]).length;
  const alt=(html.match(/b-alt/g)||[]).length, conf=(html.match(/b-confirm/g)||[]).length;
  const cards=(html.match(/cpanel-card/g)||[]).length;
  const text=html.replace(/<[^>]*>/g,' ');
  const verbal=/independent|connected|group|cohort|seminar/i.test(text);
  console.log(`${topo}-C p=${p}: cards=${cards} edges=${edges} alt=${alt} confirm=${conf}`);
  chk(`${topo}-C p=${p}: 6 cards`, cards===6);
  chk(`${topo}-C p=${p}: ${topo==='high'?7:0} lines`, edges===(topo==='high'?7:0), 'got '+edges);
  chk(`${topo}-C p=${p}: dissenting badges = ${p/100*6}`, alt===p/100*6 && conf===6-p/100*6);
  chk(`${topo}-C p=${p}: no verbal label on the panel`, !verbal);
  chk(`${topo}-C p=${p}: reviewers numbered 1-6`, [1,2,3,4,5,6].every(i=>text.includes('Reviewer '+i)));
}
// apart from the lines, the two panel types are identical
for (const p of [0,50,100]) {
  const strip=h=>h.replace(/<line[^>]*\/>/g,'').replace(/cpanel-(hc|lc)/g,'').replace(/\s+/g,' ');
  const hi=R.buildPanel({topology:'high',pressure:p,encodedSeq:1,blockIndex:1});
  const lo=R.buildPanel({topology:'low', pressure:p,encodedSeq:1,blockIndex:1});
  chk(`p=${p}: panels identical except for the lines`, strip(hi)===strip(lo));
}
chk('blank panel has no cards', !/cpanel-card/.test(R.buildBlankPanel()));
// --- avatar schedule ---
const avs=['Fa','Fb','Fc','Ga','Gb','Gc'], blks=['blkA','blkB','blkC'];
let bad=[];
avs.forEach(a=>{ const pos=blks.map(b=>R.avatarSchedule[b].indexOf(a));
  const nAlt=pos.filter(p=>p<3).length;
  if(nAlt===3) bad.push(a+' always dissenting');
  if(nAlt===0) bad.push(a+' never dissenting');
  if(pos[0]===pos[1]||pos[1]===pos[2]) bad.push(a+' same position in consecutive blocks');
});
blks.forEach(b=>{ const alt=R.avatarSchedule[b].slice(0,3);
  if(!(alt.some(x=>x[0]==='F') && alt.some(x=>x[0]==='G'))) bad.push(b+' dissenting set not mixed');
  if(new Set(R.avatarSchedule[b]).size!==6) bad.push(b+' repeats a face'); });
chk('face rotation: mixed sets, 1-2 dissenting blocks per face, moves every block', bad.length===0, bad.join('; '));
// --- cells / badges / probes ---
for (const c of ['C1','C2','C3','C4']) {
  const cell=R.cells[c], cond={encodedSeq:cell.encodes};
  const ord=R.sequences[cell.encodes];
  const b=R.getBadgeText(cond);
  const pushed=R.sequences[cell.pushedTo];
  console.log(`${c} ${cell.topology}-C enc=Seq${cell.encodes} push=Seq${cell.pushedTo} | pos3=${R.events[ord[2]].short} pos5=${R.events[ord[4]].short} | alt badge="${b.alternative}"`);
  // badge must describe the PUSHED ordering
  const expect = `${R.events[pushed[2]].short} 3rd, ${R.events[pushed[4]].short} 5th`;
  chk(`${c}: dissenting badge describes the pushed order`, b.alternative === expect, b.alternative);
  chk(`${c}: confirming badge describes the order read`,
      b.confirming === `${R.events[ord[2]].short} 3rd, ${R.events[ord[4]].short} 5th`, b.confirming);
}
// --- demo detection ---
chk('demo off on a bare URL', load('').R.demo === false);
chk('demo on with ?demo=1', load('?demo=1').R.demo === true);
// live mode refuses to start without the randomisation-list parameters
let threw=null; try { load('?cell=C1&sg=SG1').R.assignCondition(); } catch(e){ threw=e; }
chk('live mode without pid refuses to assign', threw && threw.message==='missing_assignment', threw?threw.missing.join(','):'no error');
chk('live mode with all three parameters assigns', load('?cell=C3&sg=SG4&pid=P0007').R.assignCondition().cell==='C3');
chk('demo mode without parameters assigns at random', !!load('?demo=1').R.assignCondition().cell);
// --- narrative integrity ---
const n=R.narrative; const wc=t=>t.split(/\s+/).filter(Boolean).length;
const ids=['E1','E2','E3','E4','E5','E6','E7'];
chk('seq1 vs seq2 paragraph text identical', ids.every(e=>n.seq1[e]===n.seq2[e]));
console.log('word counts:', ids.map(e=>e+':'+wc(n.seq1[e])).join(' '), '| intro:'+wc(n.intro),
            '| TOTAL', wc(n.intro)+ids.reduce((s,e)=>s+wc(n.seq1[e]),0));
chk('narrative total is 1,181 words',
    wc(n.intro)+ids.reduce((s,e)=>s+wc(n.seq1[e]),0)===1181);
chk('rests between panel blocks are 2 min', R.params.interBlockRestMs===120000);
console.log(fails===0 ? '\nALL PANEL/CONFIG CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
process.exit(fails ? 1 : 0);
