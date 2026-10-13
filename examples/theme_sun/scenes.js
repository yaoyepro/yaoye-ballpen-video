// scenes.js for SCRIPT MODE - the film is generated from work/plan.json (python bpmv.py script).
// Hand-tuning: keep autoBuild() and add per-page hooks, e.g.
//   autoBuild({after:{p2:(P,pg,ctx)=>{ const h=heart(1500,300,30,7); addPlan(P,[h],pg.t1-1.6,pg.t1-1.3); }},
//              replace:{p4:(P,pg,ctx)=>{ /* draw this sheet yourself with the Scene API; pg.steps has the planned times */ }}});
// ctx after a page: {layout, texts:{i:task}, main (doodle), sprite, extras, size}. All times are video seconds.
function build(){
  autoBuild();
}
