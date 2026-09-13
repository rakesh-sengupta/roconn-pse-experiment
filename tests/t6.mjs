import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom';
const REPO='../roconn-pse-experiment-main';
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
  const grp=/cpanel-group/.test(html), indep=(html.match(/cpanel-indep/g)||[]).length;
  console.log(`${topo}-C p=${p}: cards=${cards} edges=${edges} alt=${alt} confirm=${conf} groupBadge=${grp} indepLabels=${indep}`);
}
// --- avatar schedule ---
const avs=['Fa','Fb','Fc','Ga','Gb','Gc'], blks=['blkA','blkB','blkC'];
let bad=[];
avs.forEach(a=>{ const pos=blks.map(b=>R.avatarSchedule[b].indexOf(a));
  const roles=pos.map(p=>p<3?'ALT':'con');
  if(roles.every(x=>x==='ALT')) bad.push(a+' always ALT');
  if(pos[0]===pos[1]||pos[1]===pos[2]) bad.push(a+' same pos consecutive');
});
console.log('avatar schedule problems:', bad.length?bad:'none');
// --- cells / badges / probes ---
for (const c of ['C1','C2','C3','C4']) {
  const cell=R.cells[c], cond={encodedSeq:cell.encodes};
  const ord=R.sequences[cell.encodes];
  const b=R.getBadgeText(cond);
  const pushed=R.sequences[cell.pushedTo];
  console.log(`${c} ${cell.topology}-C enc=Seq${cell.encodes} push=Seq${cell.pushedTo} | pos3=${R.events[ord[2]].short} pos5=${R.events[ord[4]].short} | alt badge="${b.alternative}"`);
  // badge must describe the PUSHED ordering
  const expect = `${R.events[pushed[2]].short} (3rd), ${R.events[pushed[4]].short} (5th)`;
  if (b.alternative !== expect) console.log('   !! ALT BADGE MISMATCH, expected', expect);
  if (b.confirming !== `${R.events[ord[2]].short} (3rd), ${R.events[ord[4]].short} (5th)`)
    console.log('   !! CONFIRM BADGE MISMATCH');
}
// --- demo detection ---
console.log('demo off on bare url:', load('').R.demo === false,
            '| demo on with ?demo=1:', load('?demo=1').R.demo === true);
// --- narrative integrity ---
const n=R.narrative; const wc=t=>t.split(/\s+/).filter(Boolean).length;
const ids=['E1','E2','E3','E4','E5','E6','E7'];
console.log('seq1 vs seq2 text identical:', ids.every(e=>n.seq1[e]===n.seq2[e]));
console.log('word counts:', ids.map(e=>e+':'+wc(n.seq1[e])).join(' '), '| intro:'+wc(n.intro),
            '| TOTAL', wc(n.intro)+ids.reduce((s,e)=>s+wc(n.seq1[e]),0));
