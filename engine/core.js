// ============================================================================
// yaoye-ballpen-video · engine/core.js
// Paper, ballpoint strokes, hatching, handwritten text, eraser, page flip, corner logo.
// This file is a FRAGMENT: scripts/assemble.py concatenates
//   header(ENGINE_DIR, PROJECT_DIR, CFG) + core.js + pages.js + <project scenes.js> + main.js
// into <project>/build/mv.js. Do not require() it directly.
// Design canvas is fixed at 1920x1080 (all scene coordinates are in this space).
// ============================================================================
const {Canvas,FontLibrary,loadImage}=require(require.resolve('skia-canvas',{paths:[ENGINE_DIR,PROJECT_DIR,process.cwd()]}));
const path=require('path');const fs=require('fs');
for(const f of CFG.fonts)FontLibrary.use(f.family,[f.file]);
const W=1920,H=1080;
// ---------- small utils ----------
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),lerp=(a,b,u)=>a+(b-a)*u,pr=(t,a,b)=>clamp((t-a)/(b-a));
const io=u=>u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2,sine=u=>-(Math.cos(Math.PI*u)-1)/2,outc=u=>1-Math.pow(1-u,3);
function hash(n){n=Math.sin(n*127.1+311.7)*43758.5453;return n-Math.floor(n);}
function rnd(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
function vn(x,seed){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return lerp(hash(i+seed*57.3),hash(i+1+seed*57.3),u);}
const hex2rgb=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
const PEN2=true;
// ---------- style preset (presets/ballpoint.json -> CFG.style; documented in references/STYLE.md) ----------
const ST=CFG.style||{};const STS=ST.stroke||{},STP=ST.sprite||{},STH=ST.hatch||{},STT=ST.text||{};
// pen inks: b = main blue ballpoint, r = red pen (mouth/blush/accents), g = green pen (accent patterns, plants)
const INK={b:CFG.palette.b,r:CFG.palette.r,g:CFG.palette.g};
// ---------- lined paper ----------
const PC=CFG.paper;
let PAPER=null;function buildPaper(){const c=new Canvas(W,H),x=c.getContext('2d');x.fillStyle=CFG.palette.paper;x.fillRect(0,0,W,H);
  const GR=PC.grain??9,BL=PC.blotch??6;const r=rnd(7),img=x.getImageData(0,0,W,H),d=img.data;for(let i=0;i<d.length;i+=4){const n=(r()-.5)*GR+(vn(i/4%W/90,1)+vn(Math.floor(i/4/W)/70,2)-1)*BL;d[i]+=n;d[i+1]+=n;d[i+2]+=n*.9;}x.putImageData(img,0,0);
  if(PC.rule_gap>0)for(let y=PC.rule_top;y<H;y+=PC.rule_gap){x.strokeStyle=CFG.palette.rule;x.lineWidth=PC.rule_w??1.6;x.beginPath();x.moveTo(0,y+.5);x.lineTo(W,y+.5);x.stroke();}
  if(PC.margin_x>0){x.strokeStyle=CFG.palette.margin;x.lineWidth=PC.margin_w??2.2;x.beginPath();x.moveTo(PC.margin_x,0);x.lineTo(PC.margin_x,H);x.stroke();}PAPER=c;}
const RULE=n=>PC.rule_top+PC.rule_gap*n;// y of the n-th ruled line (baseline for handwriting)
// ---------- stroke items ----------
// item: {pts:[[x,y]...], L (cumulative length), len, col, w, a, seed, kind:'line'|'hatch', gap, ts, te}
function resample(pts,step=7){const out=[pts[0]];let acc=0;for(let i=1;i<pts.length;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i];const L=Math.hypot(x1-x0,y1-y0);let s=step-acc;while(s<=L){out.push([x0+(x1-x0)*s/L,y0+(y1-y0)*s/L]);s+=step;}acc=(acc+L)%step;}const l=pts[pts.length-1];out.push(l);return out;}
function handify(pts,seed,amp=1.1,freq=STS.wobble_freq??.03){const p=resample(pts,STS.resample_px??6);const L=[0];for(let i=1;i<p.length;i++)L.push(L[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));
  return p.map((q,i)=>{const a=p[Math.max(0,i-1)],b=p[Math.min(p.length-1,i+1)];let nx=-(b[1]-a[1]),ny=b[0]-a[0];const nl=Math.hypot(nx,ny)||1;const o=(vn(L[i]*freq,seed)-.5)*2*amp;return [q[0]+nx/nl*o,q[1]+ny/nl*o];});}
function mkItem(pts,o={}){const seed=o.seed??Math.floor(Math.random()*1e6);const p=o.raw?pts:handify(pts,seed,o.amp??(STS.wobble_amp??1.0));const L=[0];for(let i=1;i<p.length;i++)L.push(L[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));
  return {pts:p,L,len:L[L.length-1],col:INK[o.c||'b']||o.c,w:o.w??(STS.w??2.3),a:o.a??(STS.a??.9),seed,blob:o.blob??(hash(seed)<(STS.blob_p??.07)),kind:o.kind||'line',gap:o.gap??.035};}
// ballpoint line: width/ink vary slowly along the stroke, tapered start/end, occasional ink blob
function drawItem(x,it,prog=1){if(prog<=0||it.len<=0)return null;const end=it.len*prog;const p=it.pts,L=it.L;x.lineCap='round';x.lineJoin='round';x.strokeStyle=it.col;
  let tip=p[0];const seg=it.kind==='hatch'?1e9:(STS.segment_px??9);const TM=STS.taper_min??.45,TL=STS.taper_len??10,WV=STS.w_var||[.78,.44],AV=STS.a_var||[.68,.32];let i=0;
  while(i<p.length-1&&L[i]<end){let j=i+1;const s0=L[i];while(j<p.length-1&&L[j]-s0<seg&&L[j]<end)j++;
    const mid=(s0+Math.min(L[j],end))/2;const taper=Math.min(1,TM+mid/TL,TM+(it.len-mid)/TL);
    const w=it.w*taper*(WV[0]+WV[1]*vn(mid*(STS.w_noise_freq??.04),it.seed)),a=it.a*(AV[0]+AV[1]*vn(mid*(STS.a_noise_freq??.025),it.seed+9));
    x.globalAlpha=a;x.lineWidth=w;x.beginPath();x.moveTo(p[i][0],p[i][1]);for(let k=i+1;k<=j;k++){if(L[k]<=end){x.lineTo(p[k][0],p[k][1]);tip=p[k];}else{const u=(end-L[k-1])/(L[k]-L[k-1]);tip=[lerp(p[k-1][0],p[k][0],u),lerp(p[k-1][1],p[k][1],u)];x.lineTo(tip[0],tip[1]);break;}}x.stroke();i=j;}
  if(it.blob&&prog>0){x.globalAlpha=STS.blob_a??.85;x.fillStyle=it.col;x.beginPath();x.arc(p[0][0]+.6,p[0][1],it.w*(STS.blob_r??1.15),0,7);x.fill();}
  x.globalAlpha=1;return tip;}
// ---------- timing: ONE pen draws items in order between t0 and t1 ----------
function plan(items,t0,t1){let tot=0;for(const it of items)tot+=Math.pow(it.len,.8)+it.gap*120;let acc=0;const k=(t1-t0)/tot;
  for(const it of items){const g=it.gap*120*k;it.ts=t0+(acc+it.gap*120*.5)*k;acc+=Math.pow(it.len,.8)+it.gap*120;it.te=t0+acc*k-g*.5;}return items;}
function drawPlan(x,items,t,o={}){let tip=null,prev=null;for(let n=0;n<items.length;n++){const it=items[n];if(t<it.ts){if(prev&&!tip){const u=sine(pr(t,prev.te,it.ts));const a=prev.pts[prev.pts.length-1],b=it.pts[0];tip={x:lerp(a[0],b[0],u),y:lerp(a[1],b[1],u),lift:Math.sin(u*Math.PI)};}break;}
    let pg=pr(t,it.ts,it.te);if(PEN2&&pg>0&&pg<1){const k=Math.max(1,Math.round(it.len/90));pg=pg-Math.sin(2*Math.PI*k*pg)/(2*Math.PI*k)*.55;}const tp=drawItem(x,it,pg);if(pg<1&&tp)tip={x:tp[0],y:tp[1],lift:0};prev=it;}
  return tip;}
// ---------- sprite (character) -> stroke groups (data from scripts/prep.py) ----------
const SP={};function spriteItems(name,x0,y0,o={}){const d=SP[name];if(!d)throw new Error('sprite data missing: '+name+' (run: python bpmv.py prep)');const s=d.sc*(o.scale||1);const T=([u,v])=>[x0+u*s,y0+v*s];const r=rnd(name.length*999+7);
  const lines=d.lines.map((l,i)=>mkItem(l.map(T),{w:STP.line_w??3.2,a:STP.line_a??.93,seed:1000+i,amp:STP.line_wobble??.5}));
  const leaves=d.leaves.map((l,i)=>mkItem(l.map(T),{c:'g',w:STP.accent_w??2.0,a:STP.accent_a??.9,seed:3000+i,amp:.25,gap:.02}));
  const stars=d.stars.map((l,i)=>mkItem(l.map(T),{c:'r',w:STP.red_w??2.2,a:STP.red_a??.9,seed:3500+i,amp:.3}));
  const hatch=d.layers.map((L,li)=>L.segs.map((sg,i)=>{const a=T(sg[0]),b=T(sg[1]);const m=[(a[0]+b[0])/2+(r()-.5)*1.4,(a[1]+b[1])/2+(r()-.5)*1.4];
     return mkItem([a,m,b],{c:L.c,w:li>=2&&L.c==='b'?(STP.hatch_w_dark??1.55):(STP.hatch_w_light??1.7),a:L.c==='b'?(li>=2?(STP.hatch_a_dark??.78):(STP.hatch_a_light??.72)):(STP.hatch_a_red??.75),seed:5000+li*3000+i,raw:true,kind:'hatch',gap:.004,blob:false});}));
  return {lines,leaves,stars,hatch};}
// ---------- area hatching (scene elements): inside(x,y,row)->bool, bbox, angle(deg), spacing(px) ----------
function hatchArea(inside,bb,ang,sp,o={}){const r=rnd(o.seed||5);const a=ang*Math.PI/180,d=[Math.cos(a),Math.sin(a)],n=[-d[1],d[0]];const cs=[[bb[0],bb[1]],[bb[2],bb[1]],[bb[0],bb[3]],[bb[2],bb[3]]];
  const os=cs.map(c=>c[0]*n[0]+c[1]*n[1]),ss=cs.map(c=>c[0]*d[0]+c[1]*d[1]);const out=[];let row=0;
  for(let off=Math.min(...os);off<Math.max(...os);off+=sp,row++){const of2=off+(r()-.5)*sp*(STH.row_jitter??.18);let run=null;const segs=[];
    for(let s=Math.min(...ss);s<=Math.max(...ss)+2;s+=2){const px=s*d[0]+of2*n[0],py=s*d[1]+of2*n[1];const ok=px>=bb[0]&&px<=bb[2]&&py>=bb[1]&&py<=bb[3]&&inside(px,py,row);if(ok&&!run)run=[s];if((!ok||s>Math.max(...ss))&&run){run.push(s);segs.push(run);run=null;}}
    for(const [s0,s1] of segs){const Lr=s1-s0;if(Lr<5)continue;const m=Math.max(1,Math.ceil(Lr/(o.maxlen||STH.maxlen||110)));for(let j=0;j<m;j++){let a0=s0+Lr*j/m+r()*1.5,a1=s0+Lr*(j+1)/m-r()*3;if(a1-a0<4)continue;
      let A=[a0*d[0]+of2*n[0],a0*d[1]+of2*n[1]],B=[a1*d[0]+of2*n[0],a1*d[1]+of2*n[1]];if(row%2){const t=A;A=B;B=t;}const MJ=STH.mid_jitter??1.6;const M=[(A[0]+B[0])/2+(r()-.5)*MJ,(A[1]+B[1])/2+(r()-.5)*MJ];
      out.push(mkItem([A,M,B],{c:o.c||'b',w:o.w||STH.w||1.6,a:o.a||STH.a||.72,seed:(o.seed||5)*7777+out.length,raw:true,kind:'hatch',gap:.004,blob:false}));}}}
  return out;}
const circ=(cx,cy,r,a0=0,a1=Math.PI*2,n=60)=>Array.from({length:n+1},(_,i)=>{const a=a0+(a1-a0)*i/n;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];});
// ---------- handwriting: font glyph -> connected-component "stroke blocks", written block by block along each block's main axis ----------
const GLY={};const FONT=CFG.hand_font;const HAND=true;const PUN='，。、：；！？,.!?;:';
function glyph(ch,size,font=FONT,seed=0,hand=false,col='b'){const key=ch+'|'+size+'|'+font+'|'+seed+'|'+hand+'|'+col;if(GLY[key])return GLY[key];const S=Math.ceil(size*1.5),pad=Math.round(size*.25),base=Math.round(size*1.12);
  const c=new Canvas(S,S),g=c.getContext('2d');g.font=`${size}px ${font}`;g.fillStyle='#000';g.fillText(ch,pad,base);const adv=g.measureText(ch).width;
  const d=g.getImageData(0,0,S,S).data;let A=new Uint8Array(S*S);for(let i=0;i<S*S;i++)A[i]=d[i*4+3];
  if(hand){// slight wobble of the outline: smooth noise displacement field (bilinear)
    const amp=Math.min(1.7,Math.max(.8,size*.02)),f=.07,B=new Uint8Array(S*S),s1=seed*3.1+1,s2=seed*5.7+2;
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){const sx=x+(vn(y*f,s1)-.5)*2*amp+(vn(x*f*2.3,s1+4)-.5)*amp*.5,sy=y+(vn(x*f,s2)-.5)*2*amp+(vn(y*f*2.3,s2+4)-.5)*amp*.5;
      const x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0;if(x0<0||y0<0||x0>=S-1||y0>=S-1)continue;const q=y0*S+x0;
      B[y*S+x]=(A[q]*(1-fx)+A[q+1]*fx)*(1-fy)+(A[q+S]*(1-fx)+A[q+S+1]*fx)*fy;}A=B;}
  let l=1e9,r=-1e9;for(let i=0;i<S*S;i++){if(A[i]>40){const x=i%S;l=Math.min(l,x);r=Math.max(r,x);}}
  if(l>r){l=pad;r=pad;}
  const lab=new Int32Array(S*S).fill(-1);const comps=[];
  for(let i=0;i<S*S;i++){if(A[i]<=40||lab[i]>=0)continue;const id=comps.length;const st=[i];lab[i]=id;const px=[];
    while(st.length){const p=st.pop();px.push(p);const x=p%S,y=(p/S)|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=S||ny>=S)continue;const q=ny*S+nx;if(A[q]>40&&lab[q]<0){lab[q]=id;st.push(q);}}}
    comps.push(px);}
  const [R0,G0,B0]=hex2rgb(INK[col]||col);
  const parts=comps.filter(px=>px.length>=4).map(px=>{let mx=0,my=0;for(const p of px){mx+=p%S;my+=(p/S)|0;}mx/=px.length;my/=px.length;let sxx=0,syy=0,sxy=0,x0=1e9,y0=1e9;
      for(const p of px){const x=p%S-mx,y=((p/S)|0)-my;sxx+=x*x;syy+=y*y;sxy+=x*y;x0=Math.min(x0,p%S);y0=Math.min(y0,(p/S)|0);}
      const th=.5*Math.atan2(2*sxy,sxx-syy);let dir=[Math.cos(th),Math.sin(th)];if(Math.abs(dir[0])>=Math.abs(dir[1])){if(dir[0]<0)dir=[-dir[0],-dir[1]];}else if(dir[1]<0)dir=[-dir[0],-dir[1]];
      const pj=px.map(p=>(p%S)*dir[0]+((p/S)|0)*dir[1]);let p0=1e9,p1=-1e9;for(const v of pj){if(v<p0)p0=v;if(v>p1)p1=v;}
      const N=14,path=[];for(let k=0;k<=N;k++){const lo=p0+(p1-p0)*(k-.5)/N,hi=p0+(p1-p0)*(k+.5)/N;let sx=0,sy=0,n=0;px.forEach((p,i)=>{if(pj[i]>=lo&&pj[i]<=hi){sx+=p%S;sy+=(p/S)|0;n++;}});path.push(n?[sx/n,sy/n]:(path.length?path[path.length-1]:[mx,my]));}
      const cv=new Canvas(S,S),cg=cv.getContext('2d'),im=cg.createImageData(S,S);px.forEach((p,i)=>{let al=A[p],cr=R0,cgc=G0,cb=B0;if(hand){const u=(pj[i]-p0)/Math.max(1,p1-p0);const ink=u<.08?1:.70+.3*Math.pow(Math.abs(u-.55)/.47,1.6);const k=clamp(ink*(.86+.14*hash(p*.37+seed)));al=al*k;
        cr=Math.round(clamp(lerp(R0+16,R0-10,k),0,255));cgc=Math.round(clamp(lerp(G0+16,G0-14,k),0,255));cb=Math.round(clamp(lerp(B0+12,B0-18,k),0,255));}im.data[p*4]=cr;im.data[p*4+1]=cgc;im.data[p*4+2]=cb;im.data[p*4+3]=al;});cg.putImageData(im,0,0);
      return {cv,dir,p0,p1,path,key:x0+y0*1.25,len:p1-p0};});
  parts.sort((a,b)=>a.key-b.key);GLY[key]={S,pad,base,parts,adv,l,r};return GLY[key];}
// textItems(str, x, baselineY, size, t0, t1, {align:'left'|'center'|'right', seed, inkvar, c:'b'|'r'|'g', font, track})
function textItems(str,x0,base,size,t0,t1,o={}){const chars=[...str];const out=[];const font=o.font||FONT,hand=o.hand??HAND,col=o.c||'b';const sd=o.seed??Math.round(hash(str.length*7.3+size+x0*.01)*1000);
  // hand feel: size ±8%, rotation ±4.5°, baseline jitter, uneven tracking, slight slope
  const sizes=chars.map((ch,i)=>hand?Math.round(size*(1+(hash(sd+i*3.7)-.5)*(STT.size_jitter??.16))):size);
  const lay=[];let x=0;chars.forEach((ch,i)=>{const sz=sizes[i];const G=glyph(ch,sz,font,hand?sd+i:0,hand,col);if(PUN.includes(ch)){const l=G.l-G.pad,r=G.r-G.pad;const dx=x+sz*.04-l;lay.push(dx);x=dx+r+sz*.24;}else if(ch===' '){lay.push(x);x+=sz*.32;}else{lay.push(x);x+=G.adv*(o.track||STT.tracking||.98)*(hand?1-(STT.tracking_jitter??.12)*.667+(STT.tracking_jitter??.12)*hash(sd+i*9.1):1);}});
  const tw=x;const ox=o.align==='right'?x0-tw:o.align==='center'?x0-tw/2:x0;const slope=hand?(hash(sd+.5)-.5)*(STT.slope??.035):0;
  const per=chars.length?(t1-t0)/chars.length:0;
  chars.forEach((ch,i)=>{const sz=sizes[i];const G=glyph(ch,sz,font,hand?sd+i:0,hand,col);const tot=G.parts.reduce((s,p)=>s+Math.pow(p.len+4,.85)+sz*.12,0)||1;let acc=0;const ts=t0+i*per,te=t0+(i+.86)*per;
    const parts=G.parts.map(p=>{const a=acc;acc+=Math.pow(p.len+4,.85)+sz*.12;return {...p,ts:lerp(ts,te,(a+sz*.06)/tot),te:lerp(ts,te,(acc-sz*.06)/tot)};});
    const BJ=STT.baseline_jitter||[.11,.06];const bj=hand?(hash(sd+i*5.3)-.5)*size*BJ[0]+(vn(i*.6,sd)-.5)*size*BJ[1]:(hash(i*13.1+size)-.5)*size*.05;
    const IV=STT.ink_var||[.8,.2];const ik=o.inkvar?IV[0]+IV[1]*(.45*hash(sd+i*4.3)+.55*vn(i*.33,sd+7)):1;if(o.inkvar)parts.forEach((p,k)=>p.k=.86+.14*hash(sd*1.7+i*11.3+k*2.1));
    out.push({ch,G,parts,x:ox+lay[i],base:base+bj+slope*lay[i],rot:hand?(hash(sd+i*2.9)-.5)*(STT.rot_jitter_rad??.157):(hash(i*7.7+size)-.5)*.06,size:sz,ts,te,a:(o.a??.95)*ik});});
  return out;}
function drawText(x,items,t){let tip=null;let last=null;
  for(const it of items){if(t<it.ts){if(PEN2&&last&&!tip){const a=last.endTip,b=gpt(it,it.parts[0]?.path[0]||[it.G.pad,it.G.base]);if(a){const v=sine(pr(t,last.te,it.ts));tip={x:lerp(a.x,b.x,v),y:lerp(a.y,b.y,v),lift:.55*Math.sin(v*Math.PI)};}}break;}
    const G=it.G;const real=!(x===NULLX);if(real){x.save();x.translate(it.x,it.base);x.rotate(it.rot);x.translate(-G.pad,-G.base);x.globalAlpha=it.a;}
    let prevEnd=null;for(let k=0;k<it.parts.length;k++){const p=it.parts[k];
      if(t<p.ts){if(prevEnd&&!tip&&t<it.te+.001){const v=sine(pr(t,it.parts[k-1].te,p.ts));const b=gpt(it,p.path[0]);tip={x:lerp(prevEnd.x,b.x,v),y:lerp(prevEnd.y,b.y,v),lift:.35*Math.sin(v*Math.PI)};}break;}
      if(real)x.globalAlpha=it.a*(p.k||1);let u=pr(t,p.ts,p.te);if(PEN2&&u>0&&u<1)u=u-Math.sin(2*Math.PI*u)/(2*Math.PI)*.45;
      if(real){if(u>=1)x.drawImage(p.cv,0,0);else{x.save();const f=p.p0+(p.p1-p.p0)*u+1.5;const d=p.dir,n=[-d[1],d[0]];const BIG=G.S*3;x.beginPath();
        x.moveTo(f*d[0]+n[0]*BIG,f*d[1]+n[1]*BIG);x.lineTo(f*d[0]-n[0]*BIG,f*d[1]-n[1]*BIG);x.lineTo((f-BIG)*d[0]-n[0]*BIG,(f-BIG)*d[1]-n[1]*BIG);x.lineTo((f-BIG)*d[0]+n[0]*BIG,(f-BIG)*d[1]+n[1]*BIG);x.closePath();x.clip();x.drawImage(p.cv,0,0);x.restore();}}
      const q=p.path[Math.min(p.path.length-1,Math.round(u*(p.path.length-1)))];prevEnd=gpt(it,p.path[p.path.length-1]);if(u<1)tip={...gpt(it,q),lift:0};}
    if(real)x.restore();it.endTip=gpt(it,it.parts.length?it.parts[it.parts.length-1].path.slice(-1)[0]:[G.pad,G.base]);last=it;}
  return tip;}
function gpt(it,q){const G=it.G;const lx=q[0]-G.pad,ly=q[1]-G.base;const c=Math.cos(it.rot),s=Math.sin(it.rot);return {x:it.x+lx*c-ly*s,y:it.base+lx*s+ly*c};}
// ---------- corner logo (optional): any SVG/PNG, re-inked in ballpoint colour with uneven ink ----------
let LOGOA=null,LOGOBOX=null,LOGOIMG=null;const LOGO_INK=(CFG.logo&&CFG.logo.ink)??.82;
async function buildLogo(){const L=CFG.logo;if(!L||!L.file)return;const im=await loadImage(L.file);LOGOIMG=im;
  const LH=L.height||66,LW=LH*im.width/im.height,fx=W-(L.right??58)-LW,fy=L.top??45;LOGOBOX=[fx,fy,fx+LW,fy+LH];
  // rasterize first (drawImage(canvas) in skia-canvas replays vector recordings every frame)
  const c=new Canvas(Math.ceil(LW)+4,Math.ceil(LH)+4),g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(im,2,2,LW,LH);
  if(L.recolor!==false){g.globalCompositeOperation='source-in';g.fillStyle=INK[L.color||'b']||L.color;g.fillRect(0,0,c.width,c.height);}
  g.globalCompositeOperation='source-atop';const r=rnd(3);for(let i=0;i<Math.round(LW*LH/26);i++){g.fillStyle=`rgba(245,240,226,${r()*.16})`;g.beginPath();g.ellipse(r()*c.width,r()*c.height,1+r()*4,1+r()*1.5,r()*3,0,7);g.fill();}
  const o=new Canvas(W,H);o.getContext('2d').drawImage(await loadImage(await c.toBuffer('png')),fx-2,fy-2);LOGOA=await loadImage(await o.toBuffer('png'));}
function logo(x,a){if(a<=0||!LOGOA)return;x.save();x.globalAlpha=a*LOGO_INK;x.drawImage(LOGOA,0,0);x.restore();}
// ---------- page flip: current page lifts from right to left revealing the next ----------
function flip(x,A,B,u){const f=W*(1-io(u));x.drawImage(B,0,0);x.save();x.beginPath();x.rect(0,0,f,H);x.clip();x.drawImage(A,0,0);x.restore();
  const fw=Math.min(f,(W-f)*.42);if(fw>1){const g=x.createLinearGradient(f,0,f+120,0);g.addColorStop(0,'rgba(40,40,60,.28)');g.addColorStop(1,'rgba(40,40,60,0)');x.fillStyle=g;x.fillRect(f,0,120,H);
    x.save();x.beginPath();x.rect(f-fw,0,fw,H);x.clip();x.translate(f,0);x.scale(-fw/W*2.4,1);x.globalAlpha=1;x.drawImage(PAPER,0,0);x.restore();
    const g2=x.createLinearGradient(f-fw,0,f,0);g2.addColorStop(0,'rgba(255,255,255,.0)');g2.addColorStop(.7,'rgba(255,255,255,.18)');g2.addColorStop(1,'rgba(60,60,80,.22)');x.fillStyle=g2;x.fillRect(f-fw,0,fw,H);
    x.strokeStyle='rgba(60,60,80,.35)';x.lineWidth=1.5;x.beginPath();x.moveTo(f-fw,0);x.lineTo(f-fw,H);x.stroke();}}
// ---------- page eraser: zig-zag with hand shake over the whole page, uneven elliptical dabs, faint residue + crumbs ----------
const ER=(()=>{const p=[];const r=rnd(901);let y=Math.max(36,PC.rule_top-112),d=1;const n=Math.ceil((H-y)/78)+1;for(let k=0;k<n;k++){const xa=d>0?100+r()*40:W-4-r()*16,xb=d>0?W-4-r()*16:100+r()*40;p.push([xa,y]);p.push([xb,y+10+r()*16]);y+=72+r()*12;d=-d;}return mkItem(p,{raw:false,amp:9,seed:902,w:1});})();
const DABS=(()=>{const out=[];const r=rnd(903);const P=ER.pts,L=ER.L;for(let s=0;s<ER.len;s+=9){let k=1;while(k<L.length-1&&L[k]<s)k++;const v=(s-L[k-1])/(L[k]-L[k-1]||1);const x=lerp(P[k-1][0],P[k][0],v),y=lerp(P[k-1][1],P[k][1],v);
  const ang=Math.atan2(P[k][1]-P[k-1][1],P[k][0]-P[k-1][0]);out.push({s,x:x+(r()-.5)*10,y:y+(r()-.5)*10,rx:62+r()*22,ry:46+r()*14,ang:ang+(r()-.5)*.4,a:.16+.42*vn(s*.01,7)*(.6+.4*r())});}return out;})();
let EM=null,ETMP=null;
function eraseState(layer,u){if(!EM){EM=new Canvas(W,H);ETMP=new Canvas(W,H);}const m=EM.getContext('2d');m.setTransform(1,0,0,1,0,0);m.clearRect(0,0,W,H);const end=ER.len*io(u);
  for(const d of DABS){if(d.s>end)break;m.save();m.translate(d.x,d.y);m.rotate(d.ang);m.globalAlpha=d.a;m.fillStyle='#000';m.beginPath();m.ellipse(0,0,d.rx,d.ry,0,0,7);m.fill();m.restore();}
  const g=ETMP.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.drawImage(layer,0,0);g.globalCompositeOperation='destination-out';g.drawImage(EM,0,0);g.globalCompositeOperation='source-over';
  return {end};}
function drawErased(x,layer,u){const {end}=eraseState(layer,u);x.drawImage(ETMP,0,0);return end;}
function eraser(x,layer,t,t0,t1){const u=pr(t,t0,t1);const end=drawErased(x,layer,u);
  const r=rnd(77);for(let i=0;i<120;i++){const s=r()*end;let k=1;while(k<ER.L.length-1&&ER.L[k]<s)k++;const v=(s-ER.L[k-1])/(ER.L[k]-ER.L[k-1]||1);const px=lerp(ER.pts[k-1][0],ER.pts[k][0],v)+(r()-.5)*170,py=lerp(ER.pts[k-1][1],ER.pts[k][1],v)+(r()-.5)*110;
    const fresh=clamp(1-(end-s)/900);x.fillStyle=`rgba(${r()<.3?'90,100,160':'160,140,150'},${(.25+.35*fresh).toFixed(2)})`;x.beginPath();x.ellipse(px,py,1.5+r()*4.5,1+r()*2,r()*3,0,7);x.fill();}
  if(u<1){let k=1;while(k<ER.L.length-1&&ER.L[k]<end)k++;const v=(end-ER.L[k-1])/(ER.L[k]-ER.L[k-1]||1);const tx=lerp(ER.pts[k-1][0],ER.pts[k][0],v),ty=lerp(ER.pts[k-1][1],ER.pts[k][1],v);const ang=Math.atan2(ER.pts[k][1]-ER.pts[k-1][1],ER.pts[k][0]-ER.pts[k-1][0]);
    eraserObj(x,tx,ty,ang,t,1);}}
function eraserObj(x,tx,ty,ang,t,sc){x.save();x.translate(tx,ty);x.rotate(ang*.25-.3+Math.sin(t*38)*.04);x.scale(sc,sc);x.save();x.filter='blur(5px)';x.fillStyle='rgba(40,40,60,.22)';x.fillRect(-60,-22,140,64);x.restore();
    x.fillStyle='#F0B4AE';x.beginPath();x.roundRect(-74,-34,148,62,[14,10,10,14]);x.fill();x.fillStyle='rgba(120,60,60,.18)';x.fillRect(-74,18,148,10);
    x.fillStyle='#3A57B8';x.beginPath();x.roundRect(-6,-35,82,64,[0,10,10,0]);x.fill();x.fillStyle='rgba(255,255,255,.35)';x.fillRect(-74,-34,148,7);x.restore();}
const NULLX=new Proxy({},{get:(o,k)=>k==='canvas'?null:(()=>({addColorStop(){}})),set:()=>true});
