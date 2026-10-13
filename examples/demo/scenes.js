// EXAMPLE scenes for the 18 s demo (lead_in 1.0 s + 17 s demo song). All times are VIDEO seconds.
// No character images: this demo uses doodles only, so it runs right after setup. For a real lyric MV, bring your own
// character PNGs (sprites/) and use spr()/drawSprite() - see references/SCENE_API.md "Characters".
// Timeline (video time, from timeline.locked.json): L1 1.5s  L2 5.5s  L3 9.5s  L4 13.5s -> check with `python bpmv.py build`.
// Pattern per page: lyric first (on time) -> setting -> main doodle -> hatching -> small extras -> ANIM.
// One pen: pen tasks must not overlap in time (build prints warnings if they do).

function build(){
  // ===== P1 title card: title + underline, first lyric, a lamp doodle, credits =====
  const P1=newPage('title',0,4.4,{slots:[[175,RULE(14)],[175,RULE(16)]]});
  const tt=writeText(P1,CFG.title||'Title',960,RULE(4),170,0.05,0.85,{align:'center'});
  const [ux0,,ux1]=tt.box;const ul=[mkItem(Array.from({length:30},(_,i)=>[ux0+(ux1-ux0)*i/29,RULE(4)+34+Math.sin(i*.55)*5]),{c:'r',w:2.8,seed:11})];
  addPlan(P1,ul,0.9,1.05);
  lyric(P1,1,0,Math.max(1.1,LY[0].t+.05));                   // slot 0 = left, ruled line 14
  const lamp=doodle('lamp',1380,760,560,41);
  addPlan(P1,lamp.items,2.4,3.3);addPlan(P1,hatchMain(lamp),3.32,3.9);
  credits(P1,3.95,4.3);
  aFlow(P1,ul,4,2.6);animDoodle(P1,lamp,0);

  // ===== P2 night window: window + moon + stars, a little house, lyrics 2-4, lyric eraser, camera push =====
  const P2=newPage('night',4.9,14.6,{slots:[[1080,RULE(3)],[1080,RULE(5)]],cam:t=>({s:1+.06*sine(pr(t,9.5,P2.t1-.2)),ax:1100,ay:760})});
  flipPage(P1,P2,4.4,4.9);
  const WX0=250,WY0=200,WX1=640,WY1=600,MX=405,MY=330,MR=58;
  const win=[...rectItems(WX0,WY0,WX1,WY1,200,{w:3.4}),poly([[(WX0+WX1)/2,WY0],[(WX0+WX1)/2,WY1]],{w:3,seed:205}),poly([[WX0,(WY0+WY1)/2],[WX1,(WY0+WY1)/2]],{w:3,seed:206}),poly([[WX0-26,WY1+14],[WX1+26,WY1+14]],{w:3,seed:207})];
  const moon=crescent(MX,MY,MR,240);const starsP=[[300,250],[560,260],[520,420],[300,520],[590,540],[470,230]];
  const stars=starsP.map(([x,y],k)=>starX(x,y,9+k%2*3,260+k*3));
  const ground=[poly([[700,1000],[1000,998],[1400,1001],[1800,999]],{w:2.4,seed:300})];
  // times are derived from the timeline so small timing changes (manual fixes) don't break the one-pen rule
  const l2=lyric(P2,2,0);
  const tA=l2.te+.05;addPlan(P2,[...win,...moon,...stars.flat(),...ground],tA,tA+.6);
  const hs=doodle('house',1250,800,400,77);
  addPlan(P2,hs.items,tA+.65,Math.min(tA+2.4,LY[2].t-.1));
  const l3=lyric(P2,3,1);
  const tB=l3.te+.05;addPlan(P2,hatchMain(hs),tB,tB+.6);
  const e0=Math.max(tB+1.45,LY[3].t-1.0);lyErase(P2,e0,e0+.5,[l2,l3]);   // small eraser rubs out lines 2+3, a faint ghost stays
  const l4=lyric(P2,4,0,Math.max(LY[3].t+.05,e0+.6));
  const sky=(x,y)=>x>WX0+5&&x<WX1-5&&y>WY0+5&&y<WY1-5&&Math.abs(x-(WX0+WX1)/2)>6&&Math.abs(y-(WY0+WY1)/2)>6&&Math.hypot(x-MX,y-MY)>MR+16&&!starsP.some(([a,b])=>Math.hypot(x-a,y-b)<18);
  addPlan(P2,[...hatchArea(sky,[WX0,WY0,WX1,WY1],50,6.5,{seed:31,a:.72}),...hatchArea(sky,[WX0,WY0,WX1,WY1],-40,7,{seed:32,a:.66})],l4.te+.05,l4.te+.4);
  animDoodle(P2,hs,1);
  stars.forEach((it,i)=>aTwinkle(P2,it,i*1.3));aSway(P2,moon,[MX,MY],5,4.2);

  // ===== P3 end card (after the page eraser): big pen-drawn logo, corner logo hidden =====
  // the page eraser waits until the pen is idle >= 0.35 s (one-pen rule), then the end card fills what is left of MDUR
  const tE=Math.min(MDUR-1.6,Math.max(14.6,l4.te+.75));P2.t1=tE;
  const P3=newPage('end',tE+.8,MDUR);erasePage(P2,P3,tE,tE+.8);P3.noLogo=true;
  const c0=tE+.9,c1=Math.min(c0+1.1,MDUR-.45);
  if(LOGOIMG)logoCard(P3,960,500,220,c0,c1);else writeText(P3,CFG.title||'',960,RULE(9),150,c0,c1,{align:'center'});
  const hh=[heart(1500,700,26,861),heart(1560,660,18,862)];addPlan(P3,hh,c1+.05,Math.min(c1+.35,MDUR-.05));
}
