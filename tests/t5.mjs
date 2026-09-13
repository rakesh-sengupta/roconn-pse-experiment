import { simulate, SANE, DISCLOSE } from './sim.mjs';

// force every bisection probe to time out
const timeouts = `(function(){ const o = ROCONN.phases.buildBisectionBlock;
  ROCONN.phases.buildBisectionBlock = function(){ const a=o.apply(this,arguments);
    a.forEach(x=>{ if(x.timeline) x.timeline.forEach(t=>{
      if(t.data&&t.data.phase==='bisection') t.simulation_options={data:{response:null,rt:null}}; });});
    return a; }; })();`;
const r = await simulate('?cell=C1&sg=SG1&pid=PT01&demo=1',
  {midPatch: SANE + DISCLOSE(0) + timeouts, maxMs:90000});
const bis = r.data.filter(d=>d.phase==='bisection');
const nulls = bis.filter(d=>d.response_num===null).length;
const zeros = bis.filter(d=>d.response_num===0).length;
console.log('TIMEOUT TEST: bisection rows', bis.length, '| response_num null:', nulls,
            '| coded 0:', zeros, '| response_side:', [...new Set(bis.map(d=>d.response_side))]);
console.log(nulls===bis.length && zeros===0 ? '  PASS' : '  FAIL');

// condition manifest content
const csv = r.ctx.roconnBuildConditionCSV
  ? 'n/a' : null;
