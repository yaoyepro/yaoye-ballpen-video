// ============================================================================
// yaoye-ballpen-video · engine/auto.js  (FRAGMENT, after doodles.js)
// Script mode: build the whole film from work/plan.json (written by `bpmv.py script` from script.json).
//   scenes.js:  function build(){ autoBuild(); }                       // fully automatic
//               function build(){ autoBuild({after:{p3:(P,pg,ctx)=>{...}}, replace:{p5:(P,pg,ctx)=>{...}}}); }   // hand-tuning
// Film structure: title card -> sheets (text slots + one main drawing + small extras + optional background) -> transitions
//   (flip / page eraser / small eraser that rubs the text out and keeps the drawing) -> end card.
// Layout templates (1920x1080):  text-left | text-right | text-top | text-bottom | art-center | text-only   (see references/STRUCTURE.md)
// ============================================================================
// GROUND = the long pen line the scene stands on; text sits high on the ruled lines
const GROUND=1000;
const LAYOUTS={
  'text-left':  n=>({slots:sl(200,2,n,2,'left',860),art:[760,RULE(2+2*(n-1))+50,1820,GROUND],ground:true}),
  'text-right': n=>({slots:sl(1060,2,n,2,'left',760),art:[180,RULE(2+2*(n-1))+50,1120,GROUND],ground:true}),
  'text-top':   n=>({slots:sl(960,2,n,2,'center',1500),art:[420,RULE(2+2*(n-1))+80,1500,GROUND],ground:true}),
  'text-bottom':n=>({slots:sl(960,19-2*(n-1),n,2,'center',1500),art:[420,190,1500,RULE(19-2*(n-1))-95],ground:false}),
  'art-center': n=>({slots:sl(960,19-2*(n-1),n,2,'center',1400),art:[420,180,1500,RULE(19-2*(n-1))-95],ground:false}),
  'text-only':  n=>({slots:sl(960,Math.max(4,10-Math.round(1.5*(n-1))),n,3,'center',1500),art:null,size:84,ground:false}),
};
function sl(x,r0,n,step,align,width){return Array.from({length:n},(_,k)=>({x,y:RULE(r0+k*step),align,width}));}
function measure(str,size){const it=textItems(str,0,0,size,0,1,{seed:1});if(!it.length)return 0;const a=it[0],b=it[it.length-1];return b.x+b.G.adv*.95-a.x;}
function fitSize(lines,width,size,min=40){let s=size;while(s>min&&lines.some(l=>measure(l,s)>width))s-=2;return s;}
function slotBox(sl,size){const x0=sl.align==='center'?sl.x-sl.width/2:sl.align==='right'?sl.x-sl.width:sl.x;return [x0,sl.y-size*1.1,x0+sl.width,sl.y+size*.4];}
// strokeMask(items,pad): true near any stroke of these items (keeps background hatching off drawings, any shape)
function strokeMask(items,pad=14){const G=6,nx=Math.ceil(W/G),ny=Math.ceil(H/G),m=new Uint8Array(nx*ny),r=Math.ceil(pad/G);
  for(const it of items){const p=it.pts;for(let i=0;i<p.length;i++){const a=p[i],b=p[Math.min(p.length-1,i+1)];const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/G));
    for(let k=0;k<=n;k++){const cx=Math.round(lerp(a[0],b[0],k/n)/G),cy=Math.round(lerp(a[1],b[1],k/n)/G);for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const X=cx+dx,Y=cy+dy;if(X>=0&&Y>=0&&X<nx&&Y<ny)m[Y*nx+X]=1;}}}}
  return (x,y)=>{const X=Math.round(x/G),Y=Math.round(y/G);return X>=0&&Y>=0&&X<nx&&Y<ny&&m[Y*nx+X]===1;};}
const boxHit=(a,b,p=0)=>a[0]<b[2]+p&&a[2]>b[0]-p&&a[1]<b[3]+p&&a[3]>b[1]-p;
const SAFE=[150,165,1890,1062];
function inSafe(b){return b[0]>=SAFE[0]&&b[1]>=SAFE[1]&&b[2]<=SAFE[2]&&b[3]<=SAFE[3]&&!(LOGOBOX&&boxHit(b,LOGOBOX,40));}
const EXTRA_SIZE={sky:110,ground:130,mark:120,object:100};
// place a small doodle in free space: sky things high, ground things on the bottom line, others near the main drawing
function placeExtra(name,occ,mainBox,seed,size){const D=DOODLES[name];if(!D)throw new Error('unknown doodle '+name);const s=size||EXTRA_SIZE[D.kind]||110;const mc=mainBox?[(mainBox[0]+mainBox[2])/2,(mainBox[1]+mainBox[3])/2]:[960,600];
  const mr=mainBox?Math.hypot(mainBox[2]-mainBox[0],mainBox[3]-mainBox[1])/2:0;const C=[];const gy=occ.ground??GROUND;
  for(let x=220;x<=1800;x+=40)for(let y=200;y<=1010;y+=40){let cy=y;if(D.kind==='ground')cy=gy-s*.5;let sc=0;
    if(D.kind==='sky')sc-=y*.6;else if(D.kind!=='ground')sc-=Math.abs(Math.hypot(x-mc[0],cy-mc[1])-(mr+s*.7))*.8;else sc-=Math.abs(x-mc[0])*.2;
    for(const b of occ.extras)sc-=4000/(Math.hypot(x-(b[0]+b[2])/2,cy-(b[1]+b[3])/2)+20);sc+=hash(x*.13+y*.7+seed)*12;C.push([sc,x,cy]);}
  C.sort((a,b)=>b[0]-a[0]);const seen=new Set();let tries=0;
  for(const [sc,x,cy] of C){const k=x+'_'+cy;if(seen.has(k))continue;seen.add(k);if(++tries>500)break;let d=doodle(name,x,cy,s,seed);if(D.kind==='ground'){const dy=gy+2-d.box[3];d=doodle(name,x,cy+dy,s,seed);}const b=d.box;if(!inSafe(b))continue;
    if(occ.boxes.some(o=>boxHit(b,o,26)))continue;if(occ.extras.some(o=>boxHit(b,o,30)))continue;return d;}
  return null;}
function mainDoodleSize(name,art){const aw=art[2]-art[0],ah=art[3]-art[1];const wide={horizon:.3,city:.36,road:.43,wave:.45,mountain:.55,footprints:.38,cloud:.55,wind:.6,speed:.62,sunrise:.62,book:.62,letter:.66,sneaker:.6,birds:.8,rain:.7}[name]||.95;
  return Math.min(ah*.82,aw*.86*wide,600);}
function hatchMain(d,o={}){if(!d.inside||!d.hatchC)return [];const b=d.box,cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;const L=(ST.hatch&&ST.hatch.layers)||[{ang:52,sp:7.5},{ang:-38,sp:6.5}];
  return [...hatchArea(d.inside,b,L[0].ang,L[0].sp,{c:d.hatchC,a:.6,w:1.6,seed:o.seed||41}),...hatchArea((x,y)=>d.inside(x,y)&&(x-cx)+(y-cy)>(b[3]-b[1])*.04,b,L[1].ang,L[1].sp,{c:d.hatchC,a:.66,w:1.55,seed:(o.seed||41)+1})];}
function textTask(P,step,sl,size){const L=LY[step.i-1];return lyric(P,step.i,[sl.x,sl.y],step.ts,{te:step.te,size,align:sl.align});}
function buildSheet(P,pg,ctx){const n=Math.max(1,pg.nslots||1);const LYT=(LAYOUTS[pg.layout]||LAYOUTS['text-left'])(n);const allLines=pg.steps.filter(s=>s.op==='text').map(s=>LY[s.i-1].text);
  const size=fitSize(allLines,Math.min(...LYT.slots.map(s=>s.width)),pg.size||LYT.size||(STT.size??60));const occ={boxes:LYT.slots.map(s=>slotBox(s,size)),extras:[],ground:LYT.ground?GROUND:1035};
  const texts={};const drawn=[];let main=null,mainSp=null,mainBox=null;const seed0=pg.seed||(P.id.length*131+7);
  for(const st of pg.steps){
    if(st.op==='text'){texts[st.i]=textTask(P,st,LYT.slots[st.slot%LYT.slots.length],size);}
    else if(st.op==='small_erase'){const ls=st.lines.map(i=>texts[i]).filter(Boolean);if(ls.length)lyErase(P,st.ts,st.te,ls);}
    else if(st.op==='main'&&LYT.art){const A=LYT.art,acx=(A[0]+A[2])/2;
      if(st.type==='sprite'){const d=SP[st.name];if(!d)throw new Error('sprite '+st.name+' has no prep data (run: python bpmv.py prep)');const h=d.h*d.sc,w=d.w*d.sc;const sc=Math.min(1,(A[3]-A[1]-10)/h,(A[2]-A[0])/w);
        mainSp=spr(st.name,acx,A[3]+4,{scale:sc});drawSprite(P,mainSp,st.ts,st.te,{});mainBox=mainSp.box;occ.boxes.push(mainBox);}
      else{const D=DOODLES[st.name];const s=st.size||mainDoodleSize(st.name,A);const cy=D&&D.kind==='ground'?A[3]-s*.5:(A[1]+A[3])/2;main=doodle(st.name,acx,cy,s,seed0);if(D&&D.kind==='ground'){const dy=A[3]+2-main.box[3];main=doodle(st.name,acx,cy+dy,s,seed0);}
        const hl=st.hatch===false?[]:hatchMain(main,{seed:seed0});const tm=hl.length?st.ts+(st.te-st.ts)*.62:st.te;addPlan(P,main.items,st.ts,tm);if(hl.length)addPlan(P,hl,tm+.03,st.te);mainBox=main.box;occ.boxes.push(mainBox);}}
    else if(st.op==='extra'){const d=placeExtra(st.name,occ,mainBox,seed0+drawn.length*17+3,st.size);if(!d){AUTOWARN.push(`no free space for extra "${st.name}" on ${P.id}`);continue;}addPlan(P,d.items,st.ts,st.te);occ.extras.push(d.box);drawn.push(d);}
    else if(st.op==='bg'){const future=pg.steps.filter(s=>s.op==='text'&&!texts[s.i]).map(s=>{const sl=LYT.slots[s.slot%LYT.slots.length];const w=measure(LY[s.i-1].text,size);const x0=sl.align==='center'?sl.x-w/2:sl.align==='right'?sl.x-w:sl.x;return {box:[x0,sl.y-size*1.1,x0+w,sl.y+size*.4]};});
      bgOf(P,pg,st,{LYT,texts,future,main,mainSp,mainBox,occ,size,seed:seed0,extraItems:drawn.map(d=>d.items)});}}
  // calm idle motion after drawing
  if(mainSp)animSpr(P,mainSp,(t,k)=>({...breathe(k,t,ST.motion?.breathe_amp??.011,ST.motion?.breathe_period??3.2)}));
  if(main)animDoodle(P,main,0);drawn.forEach((d,k)=>animDoodle(P,d,k*1.3+.7));
  ctx.layout=LYT;ctx.texts=texts;ctx.main=main;ctx.sprite=mainSp;ctx.extras=drawn;ctx.size=size;}
function bgOf(P,pg,st,c){const texts=[...Object.values(c.texts),...(c.future||[])];const lyEx=texts.length?softLy(texts):()=>false;const sd=c.seed+500;
  const mm=c.main?strokeMask(c.main.items,16):null;const inM=c.main&&c.main.inside;
  const mainEx=c.mainSp?((x,y)=>c.mainSp.inside(x,y)):c.main?((x,y)=>mm(x,y)||(inM&&inM(x,y))):()=>false;
  const em=strokeMask((c.extraItems||[]).flat(),14);const exBox=(x,y)=>em(x,y);const base=(x,y,row)=>x<150||lyEx(x,y,row)||mainEx(x,y)||exBox(x,y)||(LOGOBOX&&LOGOEX(x,y));
  const types=Array.isArray(st.type)?st.type:[st.type];let items=[];
  for(const ty of types){
    if(ty==='night'){const glow=c.main&&['moon','sun','star','bulb','lamp','lantern','planet'].includes(c.main.name)?softGlow((c.main.box[0]+c.main.box[2])/2,(c.main.box[1]+c.main.box[3])/2,Math.max(c.main.box[2]-c.main.box[0],c.main.box[3]-c.main.box[1])*.75):()=>false;
      items.push(...night((x,y,row)=>base(x,y,row)||glow(x,y,row),[150,60,1905,1075],sd,{sp:6.8}));}
    else if(ty==='wash'){// light 2-layer full-page hatching (rich day page): clean paper patch around the main drawing, text and extras
      const B=c.mainBox;const glow=B?softGlow((B[0]+B[2])/2,(B[1]+B[3])/2,Math.max(B[2]-B[0],B[3]-B[1])*.62+30):()=>false;
      items.push(...night((x,y,row)=>base(x,y,row)||glow(x,y,row),[150,60,1905,c.LYT.ground?GROUND-5:1075],sd+7,{sp:8,layers:2,a:.46}));}
    else if(ty==='sky'){// soft halo of hatching around the main drawing, noisy edge (no hard boxes)
      const B=c.mainBox||[760,300,1160,700];const gx=(B[0]+B[2])/2,gy=(B[1]+B[3])/2,R=Math.max(B[2]-B[0],B[3]-B[1])*.6+50;
      const halo=(x,y,row)=>{const d=Math.hypot(x-gx,(y-gy)*1.15);const n=vn(Math.atan2(y-gy,x-gx)*2.2+sd,sd);const r1=R*(.8+.35*n);if(d>r1)return false;const f=Math.pow(1-Math.max(0,d-R*.35)/(r1-R*.35),1.6);return vn(x*.035+(row??0)*2.73,sd+3)*.85+.15*hash((row??0)*7.31)<f;};
      items.push(...hatchArea((x,y,row)=>halo(x,y,row)&&!base(x,y,row)&&y<(c.LYT.ground?GROUND-6:1070),[gx-R*1.4,gy-R*1.4,gx+R*1.4,gy+R*1.4],52,8.5,{seed:sd+1,a:.5,w:1.5,maxlen:120}));}
    else if(ty==='ground'){const y=c.LYT.ground?GROUND:(c.mainBox?Math.min(1040,c.mainBox[3]+4):1000);const pts=Array.from({length:60},(_,i)=>[150+1740*i/59,y+Math.sin(i*.37+sd)*2.5]);
      items.push(...clipItems(pts,(x,yy)=>(c.mainSp&&c.mainSp.inside(x,yy-10))||(c.main&&c.main.kind!=='ground'&&mainEx(x,yy))||exBox(x,yy-8),{w:2.4,seed:sd+2}));}}
  if(items.length)addPlan(P,items,st.ts,st.te);}
function buildTitle(P,pg,ctx){const t=pg.title;let size=150,T=null;
  if(t){size=fitSize([t.text],1500,150,60);T=writeText(P,t.text,960,RULE(5),size,t.ts,t.te,{align:'center'});ctx.title=T;}
  if(pg.underline&&T){const [ux0,,ux1]=T.box;const ul=[mkItem(Array.from({length:30},(_,i)=>[ux0+(ux1-ux0)*i/29,RULE(5)+34+Math.sin(i*.55)*5]),{c:'r',w:2.8,seed:11})];addPlan(P,ul,pg.underline.ts,pg.underline.te);}
  if(pg.subtitle){const ss=fitSize([pg.subtitle.text],1400,66,40);writeText(P,pg.subtitle.text,960,RULE(8),ss,pg.subtitle.ts,pg.subtitle.te,{align:'center'});}
  const occ={boxes:[[200,RULE(5)-size*1.1,1720,RULE(pg.subtitle?8:5)+40]],extras:[],ground:GROUND};if(CFG.credits&&CFG.credits.length)occ.boxes.push([1250,880,1890,1062]);
  const ds=[];(pg.doodles||[]).forEach((d,k)=>{let dd=null;
    if(k===0){const D=DOODLES[d.name];const s=d.size||(D.kind==='ground'?300:240);const cy=D.kind==='ground'?GROUND-s*.5:(occ.boxes[0][3]+GROUND)/2;dd=doodle(d.name,960,cy,s,29);if(D.kind==='ground'){const dy=GROUND+2-dd.box[3];dd=doodle(d.name,960,cy+dy,s,29);}}
    else dd=placeExtra(d.name,occ,ds[0]?ds[0].box:null,(k+1)*29,d.size||130);
    if(!dd)return;const hl=k===0?hatchMain(dd,{seed:61}):[];const tm=hl.length?d.ts+(d.te-d.ts)*.6:d.te;addPlan(P,dd.items,d.ts,tm);if(hl.length)addPlan(P,hl,tm+.03,d.te);occ.extras.push(dd.box);ds.push(dd);});
  if(pg.ground){const pts=Array.from({length:60},(_,i)=>[150+1740*i/59,GROUND+Math.sin(i*.37+3)*2.5]);addPlan(P,clipItems(pts,(x,y)=>ds.some(b=>b.kind!=='ground'&&x>b.box[0]-10&&x<b.box[2]+10&&y>b.box[1]-10&&y<b.box[3]+10)),pg.ground.ts,pg.ground.te);}
  ds.forEach((d,k)=>animDoodle(P,d,k));if(pg.credits)credits(P,pg.credits.ts,pg.credits.te);}
function buildEnd(P,pg,ctx){P.noLogo=!!(pg.logo&&LOGOIMG);let top=RULE(8);
  if(pg.logo&&LOGOIMG){logoCard(P,960,440,200,pg.logo.ts,pg.logo.te);top=RULE(13);}
  if(pg.text){const size=fitSize([pg.text.text],1400,110,50);writeText(P,pg.text.text,960,top,size,pg.text.ts,pg.text.te,{align:'center'});}
  const occ={boxes:[[300,top-130,1620,top+40]],extras:[]};if(pg.logo&&LOGOIMG)occ.boxes.push([700,300,1220,580]);
  const ds=[];for(const d of (pg.doodles||[])){const dd=placeExtra(d.name,occ,[760,top-110,1160,top+20],(ds.length+3)*31,d.size||120);if(!dd)continue;addPlan(P,dd.items,d.ts,d.te);occ.extras.push(dd.box);ds.push(dd);}
  ds.forEach((d,k)=>animDoodle(P,d,k*.9));}
let PLAN=null;
function autoBuild(o={}){PLAN=JSON.parse(fs.readFileSync(CFG.plan_file,'utf8'));let prev=null;const ctxs={};
  for(const pg of PLAN.pages){const P=newPage(pg.id,pg.t0,pg.t1);const ctx={};ctxs[pg.id]=ctx;
    if(prev&&pg.enter){if(pg.enter.type==='flip')flipPage(prev,P,pg.enter.t0,pg.enter.t1);else erasePage(prev,P,pg.enter.t0,pg.enter.t1);}
    const rep=o.replace&&o.replace[pg.id];if(rep)rep(P,pg,ctx);else if(pg.kind==='title')buildTitle(P,pg,ctx);else if(pg.kind==='end')buildEnd(P,pg,ctx);else buildSheet(P,pg,ctx);
    const af=o.after&&o.after[pg.id];if(af)af(P,pg,ctx);prev=P;}
  return ctxs;}
