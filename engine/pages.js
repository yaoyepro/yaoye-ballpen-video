// ============================================================================
// yaoye-ballpen-video · engine/pages.js  (FRAGMENT, concatenated after core.js)
// Timeline, sprites, scene-element helpers, page system, lyric writing/erasing, post-draw animation.
// ALL TIMES ARE VIDEO TIME (seconds) = song time + CFG.lead_in.
// ============================================================================
const LEAD=CFG.lead_in||0;
const TL=JSON.parse(fs.readFileSync(CFG.timeline_file));
// LY[i-1] = timeline line i (1-based like the timeline "i" field). Lyric TEXT always comes verbatim from the timeline.
const LY=TL.lines.map(l=>({text:l.text,t:l.song_start+LEAD,e:l.song_end+LEAD,split:l.split_song!=null?l.split_song+LEAD:null,skip:!!l.skip,i:l.i}));
const MDUR=CFG.duration;
// ---------- sprites (character line-art data from scripts/prep.py, PNG masks for occlusion/knock-out) ----------
const SPM={};
async function loadSprites(){const D=CFG.data_dir;if(!fs.existsSync(D))return;for(const f of fs.readdirSync(D).filter(f=>f.endsWith('.json'))){const n=f.slice(0,-5);SP[n]=JSON.parse(fs.readFileSync(path.join(D,f)));}}
async function spriteMask(name){if(SPM[name])return SPM[name];const d=SP[name];const src=path.resolve(PROJECT_DIR,d.src);const im=await loadImage(src);
  const c=new Canvas(im.width,im.height),g=c.getContext('2d');g.drawImage(im,0,0);const a=g.getImageData(0,0,im.width,im.height).data;const m=new Uint8Array(im.width*im.height);for(let i=0;i<m.length;i++)m[i]=a[i*4+3]>100?1:0;
  SPM[name]={w:im.width,h:im.height,m,img:im};return SPM[name];}
function dilate(M,w,h,r){r=Math.max(1,Math.round(r));let a=M;for(const dir of [0,1]){const b=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let k=-r;k<=r&&!v;k++){const xx=dir?x:x+k,yy=dir?y+k:y;if(xx>=0&&yy>=0&&xx<w&&yy<h&&a[yy*w+xx])v=1;}b[y*w+x]=v;}a=b;}return a;}
// spr(name, centerX, bottomY, {scale, pad}) -> {lines, stars(red), leaves(green accents), hatch[layer][], inside(x,y), box, ...}
function spr(name,cx,by,o={}){const d=SP[name];if(!d)throw new Error('sprite data missing: '+name+' (run: python bpmv.py prep)');const s=d.sc*(o.scale||1);const x0=cx-d.w*s/2,y0=by-d.h*s;const it=spriteItems(name,x0,y0,o);const M=SPM[name];
  const pad=o.pad??16;const DM=dilate(M.m,M.w,M.h,pad/s);
  it.inside=(x,y)=>{const u=Math.round((x-x0)/s),v=Math.round((y-y0)/s);return u>=0&&v>=0&&u<M.w&&v<M.h&&DM[v*M.w+u]===1;};
  it.box=[x0,y0,x0+d.w*s,y0+d.h*s];(globalThis.SPRB=globalThis.SPRB||[]).push([name,...it.box.map(Math.round)]);it.x0=x0;it.y0=y0;it.s=s;it.name=name;return it;}
const HB=it=>it.hatch.filter((L,i)=>SP_LAYER_OK(i));const SP_LAYER_OK=i=>true;
// ---------- small hand-drawn scene elements (all return stroke items) ----------
function poly(pts,o={}){return mkItem(pts,{w:o.w??2.6,a:o.a??.9,seed:o.seed??Math.floor(hash(pts[0][0]*.13+pts[0][1]*.71)*1e5),amp:o.amp??1,c:o.c,gap:o.gap});}
function hills(y,x0,x1,seed,amp=26,o={}){const r=rnd(seed);const n=Math.round((x1-x0)/40);const ph=r()*6;return [poly(Array.from({length:n+1},(_,i)=>{const x=x0+(x1-x0)*i/n;return [x,y-amp*Math.sin(i/n*Math.PI*1.6+ph)*(.6+.4*Math.sin(i*.7))];}),{w:o.w??2.4,seed,amp:1.2})];}
function windLine(x0,y0,len,seed,o={}){const r=rnd(seed);const pts=[];const n=26;for(let i=0;i<=n;i++){const u=i/n;pts.push([x0+len*u,y0+Math.sin(u*Math.PI*1.3+r()*.2)*18*(o.k??1)]);}
  const ex=pts[n][0],ey=pts[n][1];for(let i=1;i<=14;i++){const a=-Math.PI/2+i/14*Math.PI*1.6;pts.push([ex+Math.cos(a)*22-0,ey+22+Math.sin(a)*22]);}return mkItem(pts,{w:2.2,a:.85,seed,amp:.6,c:o.c});}
function leafShape(cx,cy,h,rot=0,seed=1,c='g'){const pts=[];for(let i=0;i<=36;i++){const u=i/36*Math.PI*2;const X=Math.sin(u)*h*.32*(1-.25*Math.cos(u)),Y=-Math.cos(u)*h*.5;pts.push([X,Y]);}pts.push([0,-h*.5],[0,h*.62]);const cs=Math.cos(rot),sn=Math.sin(rot);
  return mkItem(pts.map(([X,Y])=>[cx+X*cs-Y*sn,cy+X*sn+Y*cs]),{c,w:2.1,a:.9,seed,amp:.25,gap:.02,blob:false});}
function heart(cx,cy,s,seed=1){const pts=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;const x=16*Math.pow(Math.sin(a),3),y=-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a));pts.push([cx+x*s/16,cy+y*s/16]);}return mkItem(pts,{c:'r',w:2.6,seed,amp:.4});}
function starX(cx,cy,r,seed,c='b'){return [0,1,2].map(j=>{const a=j*Math.PI/3+seed;return mkItem([[cx-Math.cos(a)*r,cy-Math.sin(a)*r],[cx+Math.cos(a)*r,cy+Math.sin(a)*r]],{c,w:2,seed:seed*7+j,amp:.2,gap:.015});});}
function crescent(MX,MY,MR,seed){return [mkItem(circ(MX,MY,MR,-1.9,2.6),{w:2.6,seed,amp:.6}),mkItem(circ(MX-MR*.45,MY-MR*.24,MR*.82,-1.25,1.95,40),{w:2.3,seed:seed+1,amp:.6})];}
const inCres=(MX,MY,MR)=>(x,y)=>Math.hypot(x-MX,y-MY)<MR&&Math.hypot(x-(MX-MR*.45),y-(MY-MR*.24))>MR*.82;
function sun(cx,cy,r,seed,half=false){const it=[mkItem(half?circ(cx,cy,r,Math.PI,2*Math.PI,40):circ(cx,cy,r,0,Math.PI*2.05,50),{c:'r',w:2.8,seed,amp:.5})];
  const n=half?7:10;for(let i=0;i<n;i++){const a=half?Math.PI+(i+.5)/n*Math.PI:i/n*Math.PI*2;it.push(mkItem([[cx+Math.cos(a)*(r+16),cy+Math.sin(a)*(r+16)],[cx+Math.cos(a)*(r+38),cy+Math.sin(a)*(r+38)]],{c:'r',w:2.4,seed:seed+10+i,amp:.3,gap:.012}));}return it;}
function lampPost(x,by,h,seed){return [poly([[x,by],[x+2,by-h]],{w:3,seed}),poly([[x-30,by],[x+30,by]],{w:2.6,seed:seed+1}),
  poly([[x-34,by-h-4],[x+34,by-h-4],[x+22,by-h-50],[x-22,by-h-50],[x-34,by-h-4]],{w:2.6,seed:seed+2}),poly([[x-8,by-h-50],[x,by-h-64],[x+8,by-h-50]],{w:2.2,seed:seed+3})];}
function house(x,y,w,h,seed){const it=[poly([[x,y+h],[x,y+h*.42],[x+w/2,y],[x+w,y+h*.42],[x+w,y+h]],{w:2.8,seed}),poly([[x-14,y+h*.48],[x+w/2,y-10],[x+w+14,y+h*.48]],{w:2.4,seed:seed+1}),
  poly([[x+w*.58,y+h],[x+w*.58,y+h*.66],[x+w*.82,y+h*.66],[x+w*.82,y+h]],{w:2.4,seed:seed+2}),poly([[x+w*.14,y+h*.56],[x+w*.42,y+h*.56],[x+w*.42,y+h*.8],[x+w*.14,y+h*.8],[x+w*.14,y+h*.56]],{c:'r',w:2.4,seed:seed+3})];
  it.win=[x+w*.14,y+h*.56,x+w*.42,y+h*.8];it.inside=(px,py)=>px>x-20&&px<x+w+20&&py>y-20&&py<y+h+10&&(py>y+h*.42-((px<x+w/2)?(px-x):(x+w-px))*(h*.42/(w/2))-24);return it;}
function rectItems(x0,y0,x1,y1,seed,o={}){return [poly([[x0,y0],[x1,y0]],{seed,...o}),poly([[x1,y0],[x1,y1]],{seed:seed+1,...o}),poly([[x1,y1],[x0,y1]],{seed:seed+2,...o}),poly([[x0,y1],[x0,y0]],{seed:seed+3,...o})];}
// night(ex,bbox,seed,{sp,a,layers}): dense cross-hatching over a big area (paper stays); ex(x,y,row)=true -> leave white
function night(ex,bb,seed,o={}){const sp=o.sp??6.6;const a=o.a??.62;const L=[[50,sp],[-40,sp*1.08],[8,sp*1.2]].slice(0,o.layers??3);
  return L.flatMap(([ang,s],k)=>hatchArea((x,y,row)=>!ex(x,y,row),bb,ang,s,{seed:seed+k,a:a-k*.04,w:1.5,maxlen:o.maxlen??130}));}
const glowEx=(gx,gy,r)=>(x,y)=>{const d=Math.hypot(x-gx,y-gy);return d<r+(vn(Math.atan2(y-gy,x-gx)*3+9,5)-.5)*r*.35;};
const boxEx=(b,p=0)=>(x,y)=>x>b[0]-p&&x<b[2]+p&&y>b[1]-p&&y<b[3]+p;
// keep-out zone around the corner logo (+ where the pen would have to stand too steep to avoid it)
const LOGOEX=(x,y)=>LOGOBOX&&((x>LOGOBOX[0]-40&&x<LOGOBOX[2]+40&&y<LOGOBOX[3]+40)||PENM.capAt(x,y)<-1.98+(vn(y*.05+x*.03,4)-.5)*.08);
// softLy([lyricTasks]): hatching thins out naturally around lyrics (noisy white core, then sparser rows) - no hard-edged boxes
function softLy(lines,o={}){const sd=o.seed??3;const C=[];for(const l of lines){const b=l.box;const sz=(b[3]-b[1])/1.4;const cy=b[3]-sz*.35-sz*.42;for(const cx of (l.cx||[]))C.push([cx,cy,sz*.62]);if(!l.cx)for(let x=b[0]+sz*.5;x<b[2]-sz*.3;x+=sz*.5)C.push([x,cy,sz*.5]);}
  const bb=[Math.min(...lines.map(l=>l.box[0]))-160,Math.min(...lines.map(l=>l.box[1]))-160,Math.max(...lines.map(l=>l.box[2]))+160,Math.max(...lines.map(l=>l.box[3]))+160];
  return (x,y,row)=>{if(x<bb[0]||x>bb[2]||y<bb[1]||y>bb[3])return false;let d=1e9;for(const [cx,cy,r] of C){const v=Math.hypot(x-cx,(y-cy)*1.05)-r;if(v<d)d=v;}
    const n=vn(x*.017+y*.009,sd)*.6+vn(y*.023-x*.011,sd+4)*.4;const core=4+14*n;if(d<core)return true;const D=70+80*n;if(d>core+D)return false;
    const f=Math.pow(1-(d-core)/D,1.3);return hash((row??0)*12.9898+sd*3.7)<f;};}
const softGlow=(gx,gy,r,sd=5)=>(x,y,row)=>{const d=Math.hypot(x-gx,y-gy);if(d>r*1.35)return false;const n=vn(Math.atan2(y-gy,x-gx)*3+sd,sd);const c=r*(.42+.2*n);if(d<c)return true;const f=Math.pow(1-(d-c)/(r*1.35-c),1.2);return hash((row??0)*7.77+sd*1.3)<f;};
// clipItems(pts,ex): polyline cut where ex(x,y) is true
function clipItems(pts,ex,o={}){const out=[];let run=[];const dense=[];for(let i=0;i<pts.length-1;i++){const [a,b]=[pts[i],pts[i+1]];const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/6));for(let k=0;k<n;k++)dense.push([lerp(a[0],b[0],k/n),lerp(a[1],b[1],k/n)]);}dense.push(pts[pts.length-1]);
  for(const p of dense){if(ex(p[0],p[1])){if(run.length>2)out.push(run);run=[];}else run.push(p);}if(run.length>2)out.push(run);return out.map((r,i)=>poly(r,{...o,seed:(o.seed??1)+i}));}
const xf=(rx,ry,a)=>p=>[rx+p[0]*Math.cos(a)-p[1]*Math.sin(a),ry+p[0]*Math.sin(a)+p[1]*Math.cos(a)];
function tree(x,by,h,seed){const r=h*.32;return [poly([[x-4,by],[x-3,by-h*.55]],{w:2.6,seed}),poly([[x+5,by],[x+4,by-h*.55]],{w:2.4,seed:seed+1}),mkItem(Array.from({length:46},(_,i)=>{const a=i/45*Math.PI*2.05;const rr=r*(1+.13*Math.sin(a*5+seed));return [x+Math.cos(a)*rr*1.1,by-h*.62-r*.6+Math.sin(a)*rr];}),{c:'g',w:2.4,seed:seed+2,amp:.5})];}
function lanternS(x,y,r,seed){return [mkItem(circ(x,y,r,0,7,26),{c:'r',w:2.4,seed,amp:.3}),poly([[x,y-r],[x,y-r-10]],{w:1.8,seed:seed+1}),poly([[x,y+r],[x+1,y+r+14]],{c:'r',w:1.8,seed:seed+2})];}
function butterfly(x,y,s,seed){const L=k=>mkItem(Array.from({length:30},(_,i)=>{const a=i/29*Math.PI*2;return [x+k*(Math.sin(a)*s*(1+.4*Math.cos(a))),y-Math.sin(2*a)*s*.55];}),{c:'r',w:2.2,seed:seed+k,amp:.3});return [L(1),L(-1),poly([[x,y-s*.4],[x,y+s*.4]],{w:2,seed:seed+5})];}
function note(x,y,s,seed){return [mkItem(circ(x,y,s*.32,0,7,20),{w:2.4,seed,amp:.2}),poly([[x+s*.3,y],[x+s*.32,y-s*1.3]],{w:2.4,seed:seed+1}),poly([[x+s*.32,y-s*1.3],[x+s*.8,y-s*1.05],[x+s*.7,y-s*.8]],{w:2.2,seed:seed+2})];}
function petal(x,y,s,a,seed){return mkItem(Array.from({length:18},(_,i)=>{const t=i/17*Math.PI*2;const u=Math.cos(t)*s,v=Math.sin(t)*s*.45;return [x+u*Math.cos(a)-v*Math.sin(a),y+u*Math.sin(a)+v*Math.cos(a)];}),{c:'r',w:2,seed,amp:.2});}
function birds(x,y,s,seed){return [poly([[x-s,y-s*.4],[x-s*.45,y-s*.55],[x,y]],{w:2.2,seed,amp:.3}),poly([[x,y],[x+s*.45,y-s*.55],[x+s,y-s*.4]],{w:2.2,seed:seed+1,amp:.3})];}
function fence(x0,x1,by,h,seed){const it=[];for(let x=x0;x<=x1;x+=62)it.push(poly([[x,by],[x+1,by-h],[x+6,by-h-10],[x+11,by-h],[x+12,by]],{w:2.2,seed:seed+x}));it.push(poly([[x0-8,by-h*.35],[x1+20,by-h*.35]],{w:2.2,seed:seed+1}),poly([[x0-8,by-h*.75],[x1+20,by-h*.75]],{w:2.2,seed:seed+2}));return it;}
function pagoda(x,by,s,seed){const it=[];let y=by;for(let k=0;k<3;k++){const w=s*(1-k*.22),h=s*.38;it.push(poly([[x-w*.38,y],[x-w*.38,y-h*.6],[x+w*.38,y-h*.6],[x+w*.38,y]],{w:2.2,seed:seed+k*3}));it.push(poly([[x-w*.62,y-h*.6],[x,y-h*1.05],[x+w*.62,y-h*.6]],{w:2.4,seed:seed+k*3+1}));y-=h*.95;}it.push(poly([[x,y],[x,y-s*.25]],{w:2,seed:seed+20}));return it;}
// ---------- ANIM: continuous motion AFTER a group has been drawn ----------
// ANIM(P, items, f(tSinceDone, k, tAbs) -> {dx,dy,r,sx,sy,a,px,py}, {pivot|base|top, parts, knock, knockFrom, ease})
// A drawn group keeps moving after it is finished (t0 = last item end): translate/rotate/squash/alpha. k eases 0->1 over `ease` s.
// parts: local regions (arm, lantern...) rotating around their own pivot. knock: paint paper under the moving sprite silhouette
// so lines underneath don't show through (use when the character MOVES).
const TAU=Math.PI*2,DEG=Math.PI/180,osc=(t,per,ph=0)=>Math.sin(TAU*t/per+ph),bump=(t,per,ph=0)=>.5-.5*Math.cos(TAU*t/per+ph);
function ANIM(P,items,f,o={}){items=items.filter(it=>it&&it.ts!==undefined);if(!items.length)return null;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const it of items)for(const p of it.pts){if(p[0]<x0)x0=p[0];if(p[1]<y0)y0=p[1];if(p[0]>x1)x1=p[0];if(p[1]>y1)y1=p[1];}
  const m=10;const G={P,items,f,t0:o.t0??Math.max(...items.map(it=>it.te)),ease:o.ease??.9,bb:[Math.floor(x0-m),Math.floor(y0-m),Math.ceil(x1+m),Math.ceil(y1+m)],
    pivot:o.pivot||(o.base?[(x0+x1)/2,y1]:o.top?[(x0+x1)/2,y0]:[(x0+x1)/2,(y0+y1)/2]),parts:o.parts||null,knock:o.knock||null,knockFrom:o.knockFrom??null,cam:o.cam??!!P.cam,kind:o.kind||'el',name:o.name||''};
  for(const it of items)it.ag=G;for(const T of P.tasks)if(T.type==='plan'&&T.items.some(it=>it.ag===G)){T.hasAg=true;T.cache=false;}
  if(G.knock&&G.knockFrom!=null){const T=P.tasks.filter(T=>T.type==='plan'&&T.items.some(it=>it.ag===G)).sort((a,b)=>a.ts-b.ts)[0];(T.knockG=T.knockG||[]).push(G);}
  (P.anims=P.anims||[]).push(G);P.anims.sort((a,b)=>a.t0-b.t0);return G;}
function agTr(G,t){const k=sine(pr(t,G.t0,G.t0+G.ease));const r=G.f(t-G.t0,k,t)||{};return {dx:r.dx||0,dy:r.dy||0,r:r.r||0,sx:r.sx??1,sy:r.sy??1,a:r.a??1,px:r.px??G.pivot[0],py:r.py??G.pivot[1]};}
function trApply(x,tr){x.translate(tr.px+tr.dx,tr.py+tr.dy);x.rotate(tr.r);x.scale(tr.sx,tr.sy);x.translate(-tr.px,-tr.py);}
function invPt(tr,X,Y){const c=Math.cos(-tr.r),s=Math.sin(-tr.r);const u=X-tr.px-tr.dx,v=Y-tr.py-tr.dy;return [tr.px+(u*c-v*s)/tr.sx,tr.py+(u*s+v*c)/tr.sy];}
function trPt(tr,X,Y){const u=(X-tr.px)*tr.sx,v=(Y-tr.py)*tr.sy,c=Math.cos(tr.r),s=Math.sin(tr.r);return [tr.px+tr.dx+u*c-v*s,tr.py+tr.dy+u*s+v*c];}
function agPt(it,t,p){const G=it&&it.ag;if(!G||t<G.t0||!p)return p;const q=trPt(agTr(G,t),p.x,p.y);return {...p,x:q[0],y:q[1]};}
let KNC=null;
function knockMask(G){if(G.km)return G.km;const sp=G.knock;const M=SPM[sp.name];const bb=G.bb;const c=new Canvas(bb[2]-bb[0],bb[3]-bb[1]),g=c.getContext('2d');const w=M.w*sp.s,h=M.h*sp.s;
  for(let i=0;i<16;i++){const a=i/16*TAU;g.drawImage(M.img,sp.x0-bb[0]+Math.cos(a)*7,sp.y0-bb[1]+Math.sin(a)*7,w,h);}g.drawImage(M.img,sp.x0-bb[0],sp.y0-bb[1],w,h);G.km=c;return c;}
function drawKnock(x,G,t,cam,tr,alpha){if(!G.knock)return;if(!tr){if(G.knockFrom==null||t<G.knockFrom||t>=G.t0)return;alpha=pr(t,G.knockFrom,G.knockFrom+1.2);tr=null;}if(alpha<=0)return;
  if(!KNC)KNC=new Canvas(W,H);const k=KNC.getContext('2d');k.setTransform(1,0,0,1,0,0);k.globalCompositeOperation='source-over';k.globalAlpha=1;k.clearRect(0,0,W,H);
  if(G.cam&&cam){k.translate(cam.ax,cam.ay);k.scale(cam.s,cam.s);k.translate(-cam.ax,-cam.ay);}if(tr)trApply(k,tr);k.drawImage(knockMask(G),G.bb[0],G.bb[1]);
  k.setTransform(1,0,0,1,0,0);k.globalCompositeOperation='source-in';k.drawImage(PAPER,0,0);k.globalCompositeOperation='source-over';x.save();x.setTransform(1,0,0,1,0,0);x.globalAlpha=alpha;x.drawImage(KNC,0,0);x.restore();}
function agBmp(G){if(G.bmp)return G.bmp;const bb=G.bb;const c=new Canvas(bb[2]-bb[0],bb[3]-bb[1]),g=c.getContext('2d');g.translate(-bb[0],-bb[1]);drawPlan(g,G.items,1e9);G.bmp=c;return c;}
function drawAnim(x,G,t,cam){const tr=agTr(G,t);if(G.knock)drawKnock(x,G,t,cam,tr,1);x.save();if(G.cam&&cam){x.translate(cam.ax,cam.ay);x.scale(cam.s,cam.s);x.translate(-cam.ax,-cam.ay);}
  trApply(x,tr);x.globalAlpha*=tr.a;const B=agBmp(G),bb=G.bb;
  if(!G.parts)x.drawImage(B,bb[0],bb[1]);
  else{x.save();x.beginPath();x.rect(bb[0]-50,bb[1]-50,bb[2]-bb[0]+100,bb[3]-bb[1]+100);for(const p of G.parts){x.moveTo(...p.poly[0]);for(const q of p.poly.slice(1))x.lineTo(...q);x.closePath();}x.clip('evenodd');x.drawImage(B,bb[0],bb[1]);x.restore();
    const k=sine(pr(t,G.t0,G.t0+G.ease));for(const p of G.parts){const r=p.f(t-G.t0,k)||0;x.save();x.translate(p.pivot[0],p.pivot[1]);x.rotate(r);x.translate(-p.pivot[0],-p.pivot[1]);x.beginPath();x.moveTo(...p.poly[0]);for(const q of p.poly.slice(1))x.lineTo(...q);x.closePath();x.clip();x.drawImage(B,bb[0],bb[1]);x.restore();}}
  x.restore();if(globalThis.ANIMLOG)globalThis.ANIMLOG(G,tr,t);}
// sprite helpers: all strokes; local regions in normalized sprite coords (u,v)
const sprAll=sp=>[...sp.lines,...sp.stars,...sp.leaves,...sp.hatch.flat()];
const UV=(sp,u,v)=>[sp.box[0]+u*(sp.box[2]-sp.box[0]),sp.box[1]+v*(sp.box[3]-sp.box[1])];
const feet=sp=>[(sp.box[0]+sp.box[2])/2,sp.box[3]];
const breathe=(k,t,amp=.011,per=3.2)=>({sy:1+amp*k*osc(t,per),sx:1-amp*.35*k*osc(t,per)});
function animSpr(P,sp,f,o={}){const fs=Math.min(...sprAll(sp).filter(it=>it.ts!==undefined).map(it=>it.ts));return ANIM(P,sprAll(sp),f,{pivot:feet(sp),kind:'sprite',name:sp.name,knock:sp,knockFrom:fs,...o,parts:o.parts?o.parts.map(p=>({poly:p.poly.map(([u,v])=>UV(sp,u,v)),pivot:UV(sp,...p.pivot),f:p.f})):null});}
// ready-made element motions
const aTwinkle=(P,items,ph=0)=>ANIM(P,items,(t,k)=>({r:k*.25*osc(t,3.1,ph),sx:1+k*.16*osc(t,1.9,ph*1.7),sy:1+k*.16*osc(t,1.9,ph*1.7)}));
const aSway=(P,items,pivot,deg=4,per=2.6,ph=0)=>ANIM(P,items,(t,k)=>({r:k*deg*DEG*osc(t,per,ph)}),pivot==='base'?{base:true}:pivot==='top'?{top:true}:{pivot});
const aBob=(P,items,amp=6,per=2.4,ph=0,deg=0)=>ANIM(P,items,(t,k)=>({dy:k*amp*osc(t,per,ph),r:k*deg*DEG*osc(t,per*1.3,ph)}));
const aFlow=(P,items,amp=12,per=3,ph=0)=>ANIM(P,items,(t,k)=>({dx:k*amp*osc(t,per,ph),sx:1+k*.035*osc(t,per*.7,ph)}));
const aPulse=(P,items,amp=.05,per=2.2,ph=0)=>ANIM(P,items,(t,k)=>({sx:1+k*amp*osc(t,per,ph),sy:1+k*amp*osc(t,per,ph)}));
const aRise=(P,items,dist=60,per=4,ph=0)=>ANIM(P,items,(t,k)=>{const q=(t/per)%1;const a=(t<per?1:Math.min(1,q/.15))*(q<.7?1:Math.max(0,(1-q)/.3));return {dy:-dist*q,dx:6*k*osc(t,1.7,ph),a};});
const aFall=(P,items,dy=50,dur=6,ph=0)=>ANIM(P,items,(t,k)=>({dy:dy*sine(pr(t,0,dur)),dx:14*k*osc(t,2.3,ph),r:k*.35*osc(t,2.9,ph)}));
const aSpin=(P,items,pivot,w=.6)=>ANIM(P,items,(t,k)=>({r:w*(t-.9*k)}),{pivot});
const aFly=(P,items,vx=45,vy=-8,flap=.3,per=.7,ph=0)=>ANIM(P,items,(t,k)=>({dx:vx*t*k,dy:vy*t*k+5*osc(t,2.1,ph),sy:1-k*flap*bump(t,per,ph)}));
const aButterfly=(P,items,R=60,ph=0)=>ANIM(P,items,(t,k)=>({dx:k*R*osc(t,4.3,ph),dy:k*R*.45*osc(t,2.2,ph),sx:1-k*.45*bump(t,.55,ph)}));
// ---------- page system ----------
const PAGES=[],TRANS=[],HIDEW=[];
function newPage(id,t0,t1,o={}){const P={id,t0,t1,tasks:[],groups:[],slots:o.slots||[[190,RULE(3)],[190,RULE(5)]],size:o.size||60,cam:o.cam||null,under:null,underFrom:null,...o};PAGES.push(P);return P;}
function addPlan(P,items,ts,te,o={}){if(!items.length)return null;plan(items,ts,te);const T={type:'plan',items,ts,te,cam:o.cam??!!P.cam,cache:o.move?false:(o.cache??true),move:o.move||null};P.tasks.push(T);return T;}
function addFn(P,ts,te,draw,tip,o={}){const T={type:'fn',ts,te,draw,hasTip:!!tip,tip:tip||(()=>null),cam:o.cam??false,cache:o.cache??false};P.tasks.push(T);return T;}
function lyric(P,i,slot,ts,o={}){const L=LY[i-1];if(!L)throw new Error('lyric line '+i+' not in timeline');const n=[...L.text].length;ts=ts??(L.t+.05);const te=o.te??(ts+Math.min(1.35,Math.max(.62,n*.1)));const [sx,sy]=Array.isArray(slot)?slot:P.slots[slot];
  const items=textItems(L.text,sx,sy,o.size||P.size,ts,te,{seed:i*13+5,inkvar:1,align:o.align});const T={type:'text',items,ts,te,li:i,grp:null};P.tasks.push(T);
  const xs=items.map(c=>c.x),sz=o.size||P.size;T.cx=xs.map(v=>v+sz*.5);T.box=[Math.min(...xs)-6,sy-sz*1.05,Math.max(...xs)+sz*1.05,sy+sz*.35];return T;}
function LYGHOST(P,i,slot){const L=LY[i-1];if(!L)throw new Error('lyric line '+i+' not in timeline');const [sx,sy]=Array.isArray(slot)?slot:P.slots[slot];const sz=P.size;const items=textItems(L.text,sx,sy,sz,0,1,{seed:i*13+5,inkvar:1});const xs=items.map(c=>c.x);return {cx:xs.map(v=>v+sz*.5),box:[Math.min(...xs)-6,sy-sz*1.05,Math.max(...xs)+sz*1.05,sy+sz*.35]};}
function lyErase(P,e0,e1,lines){const b=[Math.min(...lines.map(l=>l.box[0])),Math.min(...lines.map(l=>l.box[1])),Math.max(...lines.map(l=>l.box[2])),Math.max(...lines.map(l=>l.box[3]))];
  const r=rnd(Math.round(e0*100));const p=[];const nrow=Math.max(2,Math.round((b[3]-b[1])/42));let d=1;for(let k=0;k<nrow+1;k++){const y=b[1]+20+(b[3]-b[1]-30)*k/nrow+(r()-.5)*8;p.push([d>0?b[0]+r()*20:b[2]-r()*20,y]);p.push([d>0?b[2]-r()*20:b[0]+r()*20,y+(r()-.5)*10]);d=-d;}
  const L=[0];for(let i=1;i<p.length;i++)L.push(L[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));const dabs=[];for(let s=0;s<L[L.length-1];s+=7){let k=1;while(k<L.length-1&&L[k]<s)k++;const v=(s-L[k-1])/(L[k]-L[k-1]||1);
    dabs.push({s,x:lerp(p[k-1][0],p[k][0],v)+(r()-.5)*8,y:lerp(p[k-1][1],p[k][1],v)+(r()-.5)*8,rx:44+r()*14,ry:30+r()*8,ang:(r()-.5)*.4,a:.22+.4*vn(s*.012,9)});}
  const G={e0,e1,lines,p,L,len:L[L.length-1],dabs,box:b};for(const l of lines)l.grp=G;P.groups.push(G);HIDEW.push([e0,e1]);return G;}
let LYC=null,LYM=null;
function drawGroup(x,G,t){if(!LYC){LYC=new Canvas(W,H);LYM=new Canvas(W,H);}const g=LYC.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);for(const L of G.lines)drawText(g,L.items,99);
  const u=pr(t,G.e0,G.e1),end=G.len*io(u);const m=LYM.getContext('2d');m.setTransform(1,0,0,1,0,0);m.clearRect(0,0,W,H);
  for(const d of G.dabs){if(d.s>end)break;m.save();m.translate(d.x,d.y);m.rotate(d.ang);m.globalAlpha=d.a;m.fillStyle='#000';m.beginPath();m.ellipse(0,0,d.rx,d.ry,0,0,7);m.fill();m.restore();}
  g.globalCompositeOperation='destination-out';g.drawImage(LYM,0,0);g.globalCompositeOperation='source-over';
  const ghost=1-.86*pr(t,G.e1-.1,G.e1+.5);if(ghost>.01){x.save();x.globalAlpha=ghost;x.drawImage(LYC,0,0);x.restore();}
  const cr=1-pr(t,G.e1,G.e1+1.0);if(cr>0){const r=rnd(78);for(let i=0;i<40;i++){const s=r()*end;let k=1;while(k<G.L.length-1&&G.L[k]<s)k++;const v=(s-G.L[k-1])/(G.L[k]-G.L[k-1]||1);const px=lerp(G.p[k-1][0],G.p[k][0],v)+(r()-.5)*110,py=lerp(G.p[k-1][1],G.p[k][1],v)+(r()-.5)*60;
    x.fillStyle=`rgba(${r()<.3?'90,100,160':'160,140,150'},${(.3*cr).toFixed(2)})`;x.beginPath();x.ellipse(px,py,1.2+r()*3.5,.8+r()*1.6,r()*3,0,7);x.fill();}}
  if(u>0&&u<1){let k=1;while(k<G.L.length-1&&G.L[k]<end)k++;const v=(end-G.L[k-1])/(G.L[k]-G.L[k-1]||1);eraserObj(x,lerp(G.p[k-1][0],G.p[k][0],v),lerp(G.p[k-1][1],G.p[k][1],v),0,t,.72);}}
// pen-tip position without drawing (fast)
function ptAt(it,s){const p=it.pts,L=it.L;if(s<=0)return p[0];if(s>=it.len)return p[p.length-1];let lo=0,hi=L.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(L[m]<s)lo=m;else hi=m;}const u=(s-L[lo])/(L[hi]-L[lo]||1);return [lerp(p[lo][0],p[hi][0],u),lerp(p[lo][1],p[hi][1],u)];}
function planTip(items,t){let lo=0,hi=items.length-1;if(!items.length||t<items[0].ts)return null;while(lo<hi){const m=(lo+hi+1)>>1;if(items[m].ts<=t)lo=m;else hi=m-1;}const it=items[lo];
  if(t<it.te){let pg=pr(t,it.ts,it.te);if(PEN2&&pg>0&&pg<1){const k=Math.max(1,Math.round(it.len/90));pg=pg-Math.sin(2*Math.PI*k*pg)/(2*Math.PI*k)*.55;}const q=ptAt(it,it.len*pg);return agPt(it,t,{x:q[0],y:q[1],lift:0});}
  const nx=items[lo+1];if(!nx)return null;const u=sine(pr(t,it.te,nx.ts));const a=agPt(it,t,{x:it.pts[it.pts.length-1][0],y:it.pts[it.pts.length-1][1]}),b=agPt(nx,t,{x:nx.pts[0][0],y:nx.pts[0][1]});return {x:lerp(a.x,b.x,u),y:lerp(a.y,b.y,u),lift:Math.sin(u*Math.PI)};}
function camAt(P,t){return P.cam?P.cam(t):null;}
const camPt=(c,p)=>c&&p?{...p,x:(p.x-c.ax)*c.s+c.ax,y:(p.y-c.ay)*c.s+c.ay}:p;
const mvPt=(T,t,p)=>{if(!p||!T.move)return p;const m=T.move(t);return {...p,x:p.x+m[0],y:p.y+m[1]};};
function taskTip(P,T,t){if(T.type==='plan'){const p=mvPt(T,t,planTip(T.items,t));return T.cam?camPt(camAt(P,t),p):p;}if(T.type==='text')return drawText(NULLX,T.items,t);return T.tip(t);}
function taskStart(P,T){if(T.type==='plan'){const p=T.items[0].pts[0];return camPt(T.cam?camAt(P,T.ts):null,mvPt(T,T.ts,agPt(T.items[0],T.ts,{x:p[0],y:p[1]})));}if(T.type==='text'){const it=T.items[0];return gpt(it,it.parts[0]?.path[0]||[it.G.pad,it.G.base]);}return T.tip(T.ts+1e-3);}
function taskEnd(P,T){if(T.type==='plan'){const it=T.items[T.items.length-1];const p=it.pts[it.pts.length-1];return camPt(T.cam?camAt(P,T.te):null,mvPt(T,T.te,agPt(it,T.te,{x:p[0],y:p[1]})));}if(T.type==='text'){drawText(NULLX,T.items,99);const it=T.items[T.items.length-1];return it.endTip;}return T.tip(T.te-1e-3);}
function pageTip(P,t){const ts=P.pen;for(let i=0;i<ts.length;i++){const T=ts[i];if(t<T.ts){if(i>0){const A=ts[i-1];const g=T.ts-A.te;if(g<2.2&&t>A.te){const a=taskEnd(P,A),b=taskStart(P,T);if(a&&b){const m=Math.min(g,.6),tm=T.ts-m;if(t<tm){return {x:a.x,y:a.y,lift:.6*sine(pr(t,A.te,A.te+.25))};}const u=sine(pr(t,tm,T.ts));const l0=g>m?.6:0;return {x:lerp(a.x,b.x,u),y:lerp(a.y,b.y,u),lift:Math.max(l0*(1-u),Math.min(1,m*2.2)*Math.sin(u*Math.PI))};}}}return null;}
    if(t<=T.te){const p=taskTip(P,T,t);if(p)return p;}}return null;}
// draw one page onto a transparent layer
function drawTaskFull(x,P,T){if(T.type==='plan')drawPlan(x,T.items,1e9);else if(T.type==='fn')T.draw(x,1e9);}
function drawPage(x,P,t,o={}){if(P.under){x.save();x.globalAlpha=P.underA??1;x.drawImage(P.under(),0,0);x.restore();}
  const c=camAt(P,t);const cacheOK=!c&&!o.noCache;const C=P.sorted.filter(T=>T.type!=='text'&&T.cache);let k=0;while(k<C.length&&C[k].te<=t)k++;
  if(cacheOK){if(!P.cv){P.cv=new Canvas(W,H);P.ck=0;}if(P.ck!==k){const g=P.cv.getContext('2d');if(k<P.ck){g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);P.ck=0;}for(let i=P.ck;i<k;i++)drawTaskFull(g,P,C[i]);P.ck=k;}x.drawImage(P.cv,0,0);}
  const camOn=()=>{if(c){x.save();x.translate(c.ax,c.ay);x.scale(c.s,c.s);x.translate(-c.ax,-c.ay);}},camOff=()=>{if(c)x.restore();};
  for(const T of P.sorted){if(T.type==='text')continue;if(cacheOK&&T.cache&&C.indexOf(T)<k)continue;if(t<T.ts&&T.type==='plan')continue;if(T.cam)camOn();if(T.knockG)for(const G of T.knockG)drawKnock(x,G,t,c);if(T.move){x.save();const m=T.move(t);x.translate(m[0],m[1]);}if(T.type==='plan')drawPlan(x,T.hasAg?T.items.filter(it=>!(it.ag&&t>=it.ag.t0)):T.items,t);else T.draw(x,t);if(T.move)x.restore();if(T.cam)camOff();}
  if(P.anims){for(const G of P.anims)if(G.kind!=='sprite'&&t>=G.t0)drawAnim(x,G,t,c);for(const G of P.anims)if(G.kind==='sprite'&&t>=G.t0)drawAnim(x,G,t,c);}// sprites last (knock-out paper hides lines below), wind lines/leaves stay behind
  if(o.noLyr)return;for(const T of P.sorted){if(T.type!=='text'||t<T.ts)continue;if(T.grp&&t>=T.grp.e0)continue;drawText(x,T.items,t);}
  for(const G of P.groups)if(t>=G.e0)drawGroup(x,G,t);}
const LAYC={};function layerAt(P,t,key){const k=P.id+'|'+key;if(LAYC[k])return LAYC[k];const c=new Canvas(W,H);drawPage(c.getContext('2d'),P,t,{noCache:true});LAYC[k]=c;return c;}
function residueOf(P){let c=null;return ()=>{if(c)return c;const L=layerAt(P,P.t1,'end');eraseState(L,1);c=new Canvas(W,H);c.getContext('2d').drawImage(ETMP,0,0);return c;};}
function erasePage(A,B,t0,t1){TRANS.push({type:'erase',A,B,t0,t1});B.under=residueOf(A);HIDEW.push([t0,t1]);}
function flipPage(A,B,t0,t1){TRANS.push({type:'flip',A,B,t0,t1});}

// ---------- convenience wrappers for scene authors ----------
function hatchOf(sp,layers){return layers.flatMap(i=>sp.hatch[i]||[]);}
// drawSprite(P, sp, t0, t1, {hatch:[layer idx], split:[.55,.12,.33]}): line art -> accent outlines -> hatching, one pen, in order
function drawSprite(P,sp,t0,t1,o={}){const f=o.split||[.5,.08,.42];const a=t0+(t1-t0)*f[0],b=a+(t1-t0)*f[1];
  const T1=addPlan(P,[...sp.lines,...sp.stars],t0,a);const T2=sp.leaves.length?addPlan(P,sp.leaves,a,b):null;const hl=hatchOf(sp,o.hatch||sp.hatch.map((_,i)=>i));const T3=hl.length?addPlan(P,hl,b+.03,t1):null;return [T1,T2,T3];}
// writeText(P, str, x, baselineY, size, ts, te, {align,c,seed}) - non-lyric handwriting (titles, captions). NEVER use it for lyrics.
function writeText(P,str,x,y,size,ts,te,o={}){const items=textItems(str,x,y,size,ts,te,{inkvar:1,...o});const T={type:'text',items,ts,te};P.tasks.push(T);const xs=items.map(c=>c.x);T.box=[Math.min(...xs)-6,y-size*1.05,Math.max(...xs)+size*1.05,y+size*.35];return T;}
// credits(P, ts, te, {x,y0,size,align}) - CFG.credits lines faded in (not pen-written), bottom-right by default
function credits(P,ts,te,o={}){const L=CFG.credits||[];if(!L.length)return null;const size=o.size||38,x=o.x??(W-90),y0=o.y0??(H-size*1.4*(L.length-1)-60);
  const items=L.flatMap((s,i)=>textItems(s,x,y0+i*size*1.4,size,0,0,{align:o.align||'right',seed:900+i}));return addFn(P,ts,te,(x,t)=>{const a=pr(t,ts,te);if(a>0){x.save();x.globalAlpha=a;drawText(x,items,99);x.restore();}},null,{cache:true});}
// logoCard(P, cx, cy, h, t0, t1): big logo drawn by the pen (two hatch layers inside its alpha mask), then the re-inked logo wipes in
function logoCard(P,cx,cy,h,t0,t1,o={}){if(!LOGOIMG)return null;const im=LOGOIMG,w=h*im.width/im.height,x0=cx-w/2,y0=cy-h/2;const mc=new Canvas(Math.ceil(w),Math.ceil(h)),mg=mc.getContext('2d');mg.drawImage(im,0,0,w,h);const md=mg.getImageData(0,0,mc.width,mc.height).data;
  const inside=(px,py)=>{px=Math.round(px-x0);py=Math.round(py-y0);return px>=0&&py>=0&&px<mc.width&&py<mc.height&&md[(py*mc.width+px)*4+3]>128;};
  const sp=Math.max(3,h/40);const hl=[...hatchArea(inside,[x0,y0,x0+w,y0+h],52,sp,{seed:71,a:.8,w:1.6,maxlen:200}),...hatchArea(inside,[x0,y0,x0+w,y0+h],-38,sp*1.15,{seed:72,a:.65,w:1.4,maxlen:200})];
  const m=t0+(t1-t0)*.6;addPlan(P,hl,t0,m);const tc=new Canvas(W,H),tg=tc.getContext('2d');tg.drawImage(im,x0,y0,w,h);tg.globalCompositeOperation='source-in';tg.fillStyle=INK.b;tg.fillRect(0,0,W,H);
  return addFn(P,m+.05,t1,(x,t)=>{const u=io(pr(t,m+.05,t1));if(u<=0)return;x.save();x.globalAlpha=.85;x.beginPath();x.rect(0,0,x0+w*u,H);x.clip();x.drawImage(tc,0,0);x.restore();},
    t=>{const u=io(pr(t,m+.05,t1));return {x:x0+w*u,y:y0+h*(.5+.35*Math.sin(t*40)),lift:0};},{cache:true});}
// finalize: sort tasks, build pen lists, collect timing warnings (one pen: no overlapping pen tasks; pen idle near erasers/transitions)
let BUILDWARN=[];
function finalizePages(){for(const P of PAGES){P.sorted=[...P.tasks].sort((a,b)=>a.ts-b.ts);P.pen=P.sorted.filter(T=>!(T.type==='fn'&&!T.hasTip));}
  const all=[];for(const P of PAGES)for(const T of P.pen){if(T.te<P.t0)continue;all.push([+T.ts.toFixed(2),+T.te.toFixed(2),P.id,T.type,T.li||'']);}all.sort((a,b)=>a[0]-b[0]);
  const warn=[];for(let i=1;i<all.length;i++)if(all[i][0]<all[i-1][1]-.01)warn.push(`overlap ${all[i-1]} | ${all[i]}`);
  for(const [e0,e1] of HIDEW){for(const a of all){if(a[1]>e0-.3&&a[0]<e1+.05)warn.push(`pen-near-eraser ${e0}-${e1}: ${a}`);}}
  for(const tr of TRANS)for(const a of all)if(a[1]>tr.t0&&a[0]<tr.t1)warn.push(`task-in-transition ${tr.type} ${tr.t0}: ${a}`);
  for(let i=1;i<PAGES.length;i++){const A=PAGES[i-1],B=PAGES[i];if(B.t0<A.t1-.01)warn.push(`pages-overlap ${A.id}(${A.t1}) ${B.id}(${B.t0})`);}
  if(PAGES.length&&PAGES[PAGES.length-1].t1<MDUR-.05)warn.push(`last page ends at ${PAGES[PAGES.length-1].t1} < duration ${MDUR}`);
  BUILDWARN=[...(typeof AUTOWARN!=='undefined'?AUTOWARN:[]),...warn];}
