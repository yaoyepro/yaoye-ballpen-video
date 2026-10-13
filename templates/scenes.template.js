// scenes.js — written PER SONG by the agent. Must define function build(). Optional: async function prepare() (runs before build).
// All times are VIDEO seconds (= song time + lead_in). LY[i-1].t = when timeline line i starts being sung (video time).
// Run `python bpmv.py build` after every edit: it prints where each lyric landed and all timing warnings.
// API reference: references/SCENE_API.md

function build(){
  // ---- page 1: title card ----
  const P1=newPage('title',0,4.6,{slots:[[175,RULE(14)],[175,RULE(16)]]});
  writeText(P1,CFG.title,960,RULE(4),170,0.05,0.9,{align:'center'});
  lyric(P1,1,0);                                   // line 1, slot 0, starts LY[0].t+0.05
  const a=spr('hero_laugh',1300,1060);            // name from project.json "sprites", center-x, bottom-y
  drawSprite(P1,a,LY[0].t+1.1,4.4);               // line art -> accents -> hatching
  credits(P1,3.2,3.8);

  // ---- page 2 ----
  const P2=newPage('scene2',5.1,14.0,{slots:[[1080,RULE(3)],[1080,RULE(5)]]});
  flipPage(P1,P2,4.6,5.1);
  const l2=lyric(P2,2,0);
  const b=spr('hero_sleep',1100,1000);
  addPlan(P2,[...b.lines,...b.stars],LY[1].t+1.0,LY[1].t+2.6);
  const l3=lyric(P2,3,1);
  addPlan(P2,hatchOf(b,[0,1,2,3,4,5,6]),LY[2].t+1.0,LY[2].t+2.0);
  animSpr(P2,b,(t,k)=>({...breathe(k,t,.02,3.4)}));
  // lyErase(P2,e0,e1,[l2,l3]); lyric(P2,4,0);   // reuse the slots after rubbing lines out

  // ---- next page via eraser ----
  // const P3=newPage('scene3',14.8,22.0);erasePage(P2,P3,14.0,14.8);
  // ... continue until the last page ends at MDUR (total duration)
}
