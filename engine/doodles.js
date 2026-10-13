// ============================================================================
// yaoye-ballpen-video · engine/doodles.js  (FRAGMENT, concatenated after pages.js)
// Reusable doodle library: small hand-drawn OBJECTS (no characters / no people / no animals with faces).
//   doodle(name, cx, cy, size, seed, {c}) -> {name, items:[stroke items], inside:(x,y)=>bool|null, hatchC, anim, kind, box}
//   size ~ height of the doodle in px (wide things like horizon/city/road use size*aspect as width).
//   inside()  : region that can be shaded with hatching (closed shapes only)
//   anim      : default calm idle motion (see animDoodle)   kind: 'sky' | 'ground' | 'object' | 'mark'
// List them with DOODLE_NAMES; references/STRUCTURE.md has a picture-free catalogue with tags.
// ============================================================================
const DOODLES={};const AUTOWARN=[];
function regD(name,meta,fn){DOODLES[name]={...meta,fn};}
const DOODLE_NAMES=()=>Object.keys(DOODLES);
const ell=(cx,cy,rx,ry,a0=0,a1=TAU,n=48)=>Array.from({length:n+1},(_,i)=>{const a=a0+(a1-a0)*i/n;return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];});
function pip(poly){return (x,y)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;};}
const P_=(pts,o)=>poly(pts,o);
function itemsBox(items){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const it of items)for(const p of it.pts){if(p[0]<x0)x0=p[0];if(p[1]<y0)y0=p[1];if(p[0]>x1)x1=p[0];if(p[1]>y1)y1=p[1];}return [x0,y0,x1,y1];}
function doodle(name,cx,cy,s,seed=1,o={}){const D=DOODLES[name];if(!D)throw new Error('unknown doodle "'+name+'" (known: '+DOODLE_NAMES().join(', ')+')');
  const r=D.fn(cx,cy,s,seed,o)||{};const out=Array.isArray(r)?{items:r}:r;out.items=out.items.flat(3).filter(Boolean);out.name=name;out.inside=out.inside||null;
  out.hatchC=o.hatchC??D.hatch??null;out.anim=o.anim??D.anim??null;out.kind=D.kind||'object';out.box=itemsBox(out.items);out.cx=cx;out.cy=cy;out.s=s;return out;}
// ---- sky ----
regD('sun',{kind:'sky',anim:'pulse',hatch:'r',tags:'太阳 阳光 日出 夏天 sun sunny morning warm'},(cx,cy,s,sd)=>{const r=s*.27;const it=[mkItem(circ(cx,cy,r,0,TAU*1.03,56),{c:'r',w:2.8,seed:sd,amp:.5})];
  for(let i=0;i<12;i++){const a=i/12*TAU+.13;const l0=r+s*.07,l1=r+s*(i%2?.15:.21);it.push(mkItem([[cx+Math.cos(a)*l0,cy+Math.sin(a)*l0],[cx+Math.cos(a)*l1,cy+Math.sin(a)*l1]],{c:'r',w:2.5,seed:sd+10+i,amp:.3,gap:.012}));}
  return {items:it,inside:(x,y)=>Math.hypot(x-cx,y-cy)<r-5};});
regD('moon',{kind:'sky',anim:'sway',hatch:'b',tags:'月亮 月光 明月 夜 晚安 moon night'},(cx,cy,s,sd)=>{const R=s*.42;return {items:crescent(cx,cy,R,sd),inside:inCres(cx,cy,R)};});
regD('star',{kind:'sky',anim:'twinkle',hatch:null,tags:'星星 梦想 希望 star dream wish'},(cx,cy,s,sd)=>{const pts=[];for(let i=0;i<=10;i++){const a=-Math.PI/2+i/10*TAU;const r=i%2?s*.21:s*.5;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}
  return {items:[mkItem(pts,{w:2.5,seed:sd,amp:.35})],inside:pip(pts)};});
regD('sparkle',{kind:'sky',anim:'twinkle',tags:'闪光 亮 sparkle shine'},(cx,cy,s,sd)=>starX(cx,cy,s*.45,sd%7+1));
regD('stars',{kind:'sky',anim:'pulse',tags:'星空 夜空 stars'},(cx,cy,s,sd)=>{const r=rnd(sd);return Array.from({length:5},(_,k)=>starX(cx+(r()-.5)*s*1.6,cy+(r()-.5)*s*.9,s*(.09+r()*.06),sd+k*3));});
regD('cloud',{kind:'sky',anim:'flow',hatch:null,tags:'云 天空 白云 cloud sky'},(cx,cy,s,sd)=>{const w=s*1.7,h=s*.62;const pts=[];const n=90;
  for(let i=0;i<=n;i++){const a=Math.PI+i/n*Math.PI;const bump=Math.abs(Math.sin(a*3.5+.4))*.38+.62;pts.push([cx+Math.cos(a)*w/2,cy+h*.18+Math.sin(a)*h*.82*bump]);}
  pts.push([cx-w/2,cy+h*.18]);const top=pts.slice();return {items:[mkItem(pts,{w:2.5,seed:sd,amp:.6}),P_([[cx-w*.38,cy+h*.3],[cx+w*.36,cy+h*.3]],{w:2,seed:sd+1,a:.6})],inside:pip(top)};});
regD('rain',{kind:'sky',anim:null,tags:'雨 下雨 rain'},(cx,cy,s,sd)=>{const r=rnd(sd);const it=[];for(let k=0;k<14;k++){const x=cx+(r()-.5)*s*1.3,y=cy+(r()-.5)*s;it.push(P_([[x,y],[x-8,y+s*.16]],{w:2,seed:sd+k,amp:.2,gap:.01}));}return it;});
regD('snowflake',{kind:'sky',anim:'twinkle',tags:'雪 霜 冬天 冷 snow frost winter'},(cx,cy,s,sd)=>{const it=[];const R=s*.45;for(let k=0;k<6;k++){const a=k/6*TAU;const ex=cx+Math.cos(a)*R,ey=cy+Math.sin(a)*R;it.push(P_([[cx,cy],[ex,ey]],{w:2.2,seed:sd+k,amp:.2}));
  for(const f of [.55,.78]){const bx=cx+Math.cos(a)*R*f,by=cy+Math.sin(a)*R*f;for(const d of [-1,1]){const b=a+d*.7;it.push(P_([[bx,by],[bx+Math.cos(b)*R*.22,by+Math.sin(b)*R*.22]],{w:1.9,seed:sd+k*9+f*10+d,amp:.15,gap:.01}));}}}return it;});
regD('birds',{kind:'sky',anim:'bob',tags:'鸟 飞 自由 birds fly freedom'},(cx,cy,s,sd)=>[birds(cx-s*.35,cy,s*.32,sd),birds(cx+s*.25,cy-s*.28,s*.24,sd+5),birds(cx+s*.4,cy+s*.2,s*.18,sd+9)]);
regD('planet',{kind:'sky',anim:'sway',hatch:'b',tags:'星球 宇宙 太空 planet space universe'},(cx,cy,s,sd)=>{const r=s*.3;return {items:[mkItem(circ(cx,cy,r,0,TAU*1.02,50),{w:2.6,seed:sd,amp:.4}),mkItem(ell(cx,cy,s*.62,s*.16,-.25,Math.PI+.25,40).map(([x,y])=>{const a=-.25;return [cx+(x-cx)*Math.cos(a)-(y-cy)*Math.sin(a),cy+(x-cx)*Math.sin(a)+(y-cy)*Math.cos(a)];}),{c:'r',w:2.4,seed:sd+1,amp:.4})],inside:(x,y)=>Math.hypot(x-cx,y-cy)<r-5};});
regD('rocket',{kind:'sky',anim:'bob',hatch:'b',tags:'火箭 出发 梦想 rocket launch future'},(cx,cy,s,sd)=>{const w=s*.2,h=s*.62,top=cy-s*.45;const body=[[cx,top],[cx+w*.8,top+h*.28],[cx+w,top+h],[cx-w,top+h],[cx-w*.8,top+h*.28],[cx,top]];
  return {items:[mkItem(body,{w:2.7,seed:sd,amp:.4}),mkItem(circ(cx,top+h*.42,w*.42,0,TAU,24),{w:2.2,seed:sd+1,amp:.2}),P_([[cx-w,top+h*.7],[cx-w*1.7,top+h*1.08],[cx-w,top+h]],{w:2.4,seed:sd+2}),P_([[cx+w,top+h*.7],[cx+w*1.7,top+h*1.08],[cx+w,top+h]],{w:2.4,seed:sd+3}),
    mkItem([[cx-w*.6,top+h],[cx-w*.3,top+h+s*.2],[cx,top+h+s*.08],[cx+w*.3,top+h+s*.24],[cx+w*.6,top+h]],{c:'r',w:2.4,seed:sd+4,amp:.4})],inside:(x,y)=>pip(body)(x,y)&&Math.hypot(x-cx,y-(top+h*.42))>w*.5};});
regD('balloon',{kind:'sky',anim:'bob',hatch:'r',tags:'气球 庆祝 生日 balloon party birthday'},(cx,cy,s,sd)=>{const rx=s*.22,ry=s*.28,by=cy-s*.18;return {items:[mkItem(ell(cx,by,rx,ry,0,TAU*1.02,48),{c:'r',w:2.6,seed:sd,amp:.4}),P_([[cx-6,by+ry+2],[cx,by+ry+12],[cx+6,by+ry+2]],{c:'r',w:2.2,seed:sd+1}),
  mkItem(Array.from({length:20},(_,i)=>[cx+Math.sin(i*.6)*7,by+ry+12+i*s*.025]),{w:1.8,seed:sd+2,amp:.3})],inside:(x,y)=>((x-cx)/rx)**2+((y-by)/ry)**2<.86};});
regD('kite',{kind:'sky',anim:'sway',hatch:'r',tags:'风筝 风 春天 kite wind spring'},(cx,cy,s,sd)=>{const t=cy-s*.45,d=[[cx,t],[cx+s*.22,t+s*.3],[cx,t+s*.62],[cx-s*.22,t+s*.3],[cx,t]];const tail=Array.from({length:24},(_,i)=>[cx+Math.sin(i*.45)*s*.06+i*s*.012,t+s*.62+i*s*.016]);
  return {items:[mkItem(d,{c:'r',w:2.6,seed:sd,amp:.3}),P_([[cx,t],[cx,t+s*.62]],{w:1.8,seed:sd+1}),P_([[cx-s*.22,t+s*.3],[cx+s*.22,t+s*.3]],{w:1.8,seed:sd+2}),mkItem(tail,{w:1.8,seed:sd+3,amp:.3}),
    ...[6,13,20].map((k,j)=>P_([[tail[k][0]-9,tail[k][1]-5],[tail[k][0]+9,tail[k][1]+5]],{c:'r',w:2.2,seed:sd+5+j}))],inside:pip(d)};});
regD('plane',{kind:'sky',anim:'bob',tags:'纸飞机 远方 出发 paper plane journey message'},(cx,cy,s,sd)=>{const a=[cx+s*.5,cy-s*.2],b=[cx-s*.5,cy],c=[cx-s*.1,cy+s*.05],d=[cx-s*.18,cy+s*.3];
  const trail=Array.from({length:7},(_,i)=>{const x0=cx-s*.6-i*s*.17;return P_([[x0,cy+s*.08+Math.sin(i)*8],[x0-s*.08,cy+s*.1+Math.sin(i+.5)*8]],{w:1.8,seed:sd+10+i,a:.7,gap:.01});});
  return [P_([b,a,c,b],{w:2.5,seed:sd}),P_([c,a,d,c],{w:2.4,seed:sd+1}),...trail];});
// ---- marks / motion ----
regD('wind',{kind:'mark',anim:'flow',tags:'风 微风 吹 wind breeze'},(cx,cy,s,sd)=>[windLine(cx-s*.75,cy-s*.25,s*1.2,sd),windLine(cx-s*.55,cy+s*.12,s*.95,sd+1,{k:.7}),windLine(cx-s*.85,cy+s*.42,s*.7,sd+2,{k:.5})]);
regD('speed',{kind:'mark',anim:'flow',tags:'速度 奔跑 快 speed run fast'},(cx,cy,s,sd)=>{const r=rnd(sd);return Array.from({length:5},(_,k)=>{const y=cy-s*.4+k*s*.2,l=s*(.6+r()*.7);return P_([[cx+s*.5-l,y],[cx+s*.5,y+(r()-.5)*4]],{w:2.1,seed:sd+k,amp:.4,a:.85});});});
regD('arrow',{kind:'mark',anim:null,tags:'箭头 方向 前进 arrow direction next'},(cx,cy,s,sd)=>{const pts=Array.from({length:30},(_,i)=>{const u=i/29;return [cx-s*.6+u*s*1.2,cy+s*.12-Math.sin(u*Math.PI)*s*.3];});const e=pts[29],p=pts[25];const a=Math.atan2(e[1]-p[1],e[0]-p[0]);
  return [mkItem(pts,{w:2.6,seed:sd,amp:.5}),P_([[e[0]+Math.cos(a+2.6)*s*.16,e[1]+Math.sin(a+2.6)*s*.16],e,[e[0]+Math.cos(a-2.6)*s*.16,e[1]+Math.sin(a-2.6)*s*.16]],{w:2.6,seed:sd+1,amp:.3})];});
regD('underline',{kind:'mark',anim:null,tags:'下划线 强调 underline'},(cx,cy,s,sd)=>[mkItem(Array.from({length:30},(_,i)=>[cx-s+i/29*2*s,cy+Math.sin(i*.55+sd)*s*.03]),{c:'r',w:2.8,seed:sd})]);
regD('spiral',{kind:'mark',anim:'spin',tags:'旋转 漩涡 时间 spiral swirl time'},(cx,cy,s,sd)=>[mkItem(Array.from({length:90},(_,i)=>{const a=i/89*TAU*2.6;const r=s*.48*i/89;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];}),{w:2.3,seed:sd,amp:.3})]);
regD('heart',{kind:'object',anim:'pulse',hatch:'r',tags:'爱 心 喜欢 温暖 heart love warm'},(cx,cy,s,sd)=>{const S=s*.55;return {items:[heart(cx,cy,S,sd)],inside:(x,y)=>{const X=(x-cx)/S*1.25,Y=-(y-cy)/S*1.25+.15;return (X*X+Y*Y-1)**3-X*X*Y*Y*Y<0;}};});
regD('hearts',{kind:'object',anim:'pulse',tags:'爱心 hearts'},(cx,cy,s,sd)=>[heart(cx-s*.25,cy+s*.08,s*.32,sd),heart(cx+s*.22,cy-s*.18,s*.22,sd+1)]);
regD('note',{kind:'object',anim:'bob',tags:'音乐 歌 唱 music song sing'},(cx,cy,s,sd)=>[note(cx-s*.2,cy+s*.25,s*.5,sd),note(cx+s*.25,cy+s*.05,s*.38,sd+3)]);
regD('footprints',{kind:'ground',anim:null,tags:'脚印 足迹 路 走 footprints path walk'},(cx,cy,s,sd)=>Array.from({length:6},(_,k)=>{const x=cx-s*1.1+k*s*.44,y=cy+(k%2?-s*.12:s*.12);return mkItem(ell(x,y,s*.09,s*.055,0,TAU,20),{w:2.2,seed:sd+k,amp:.2});}));
// ---- nature / ground ----
regD('flower',{kind:'ground',anim:'sway',hatch:null,tags:'花 春天 开花 flower spring bloom'},(cx,cy,s,sd)=>{const hx=cx,hy=cy-s*.22,by=cy+s*.5;const it=[mkItem([[cx,by],[cx+3,cy+s*.1],[hx,hy+s*.08]],{c:'g',w:2.4,seed:sd,amp:.6}),leafShape(cx-s*.12,cy+s*.22,s*.22,-.9,sd+1),leafShape(cx+s*.12,cy+s*.3,s*.2,.9,sd+2)];
  for(let k=0;k<6;k++){const a=k/6*TAU;it.push(petal(hx+Math.cos(a)*s*.13,hy+Math.sin(a)*s*.13,s*.11,a,sd+10+k));}it.push(mkItem(circ(hx,hy,s*.06,0,TAU,18),{w:2.2,seed:sd+20,amp:.2}));return it;});
regD('sprout',{kind:'ground',anim:'sway',tags:'发芽 成长 希望 植物 sprout grow plant hope'},(cx,cy,s,sd)=>[mkItem([[cx,cy+s*.5],[cx-2,cy+s*.1],[cx+2,cy-s*.15]],{c:'g',w:2.5,seed:sd,amp:.5}),leafShape(cx-s*.17,cy-s*.18,s*.3,-1.1,sd+1),leafShape(cx+s*.17,cy-s*.26,s*.3,1.1,sd+2),P_([[cx-s*.3,cy+s*.5],[cx+s*.3,cy+s*.5]],{w:2.2,seed:sd+3})]);
regD('grass',{kind:'ground',anim:'sway',tags:'草 草地 grass field'},(cx,cy,s,sd)=>{const r=rnd(sd);return Array.from({length:9},(_,k)=>{const x=cx-s*.6+k*s*.15,b=cy+s*.3,h=s*(.25+r()*.3);return P_([[x,b],[x+(r()-.5)*s*.12,b-h]],{c:'g',w:2,seed:sd+k,amp:.3,gap:.01});});});
regD('tree',{kind:'ground',anim:'sway',hatch:'g',tags:'树 森林 公园 tree forest park'},(cx,cy,s,sd)=>{const by=cy+s*.5;const r=s*.32;const ccx=cx,ccy=by-s*.62-r*.6;return {items:tree(cx,by,s,sd),inside:(x,y)=>Math.hypot((x-ccx)/1.1,y-ccy)<r*.86};});
regD('leaf',{kind:'object',anim:'sway',tags:'叶子 秋天 leaf autumn'},(cx,cy,s,sd)=>[leafShape(cx,cy,s*.8,.5,sd)]);
regD('mountain',{kind:'ground',anim:null,hatch:'b',tags:'山 远方 旅行 mountain travel far'},(cx,cy,s,sd)=>{const b=cy+s*.4,w=s*1.6;const pk=[[cx-w/2,b],[cx-w*.12,cy-s*.42],[cx+w*.08,cy-s*.08],[cx+w*.24,cy-s*.26],[cx+w/2,b]];
  return {items:[mkItem(pk,{w:2.7,seed:sd,amp:.8}),P_([[cx-w*.2,cy-s*.28],[cx-w*.15,cy-s*.22],[cx-w*.1,cy-s*.3],[cx-w*.05,cy-s*.24]],{w:2,seed:sd+1}),P_([[cx-w/2-20,b],[cx+w/2+20,b]],{w:2.4,seed:sd+2})],inside:(x,y)=>pip(pk)(x,y)&&x>cx-w*.12};});
regD('wave',{kind:'ground',anim:'flow',tags:'海 浪 河 水 sea wave river water'},(cx,cy,s,sd)=>[0,1,2].map(k=>mkItem(Array.from({length:40},(_,i)=>{const u=i/39;return [cx-s+u*2*s,cy-s*.2+k*s*.2+Math.sin(u*TAU*2+k)*s*.06];}),{w:2.4-k*.2,seed:sd+k,amp:.5})));
regD('horizon',{kind:'ground',anim:null,tags:'地平线 田野 远方 horizon field'},(cx,cy,s,sd)=>hills(cy,cx-s*2.2,cx+s*2.2,sd,s*.12));
regD('sunrise',{kind:'ground',anim:null,hatch:'r',tags:'日出 黎明 开始 sunrise dawn start'},(cx,cy,s,sd)=>{const r=s*.42;return {items:[...sun(cx,cy,r,sd,true),P_([[cx-s*.78,cy],[cx+s*.78,cy]],{w:2.6,seed:sd+30})],inside:(x,y)=>y<cy-4&&Math.hypot(x-cx,y-cy)<r-5};});
regD('road',{kind:'ground',anim:null,tags:'路 道路 远方 前进 小路 road way path future'},(cx,cy,s,sd)=>{const t=cy-s*.38,b=cy+s*.5;
  // winding path that narrows towards a horizon line with two low hills (reads as a road, not a triangle)
  const q=(x0,y0,x1,y1,x2,y2,x3,y3,n=34)=>Array.from({length:n+1},(_,k)=>{const u=k/n,v=1-u;return [v*v*v*x0+3*v*v*u*x1+3*v*u*u*x2+u*u*u*x3,v*v*v*y0+3*v*v*u*y1+3*v*u*u*y2+u*u*u*y3];});
  const vx=cx+s*.18;const L=q(cx-s*.62,b,cx-s*.05,b-(b-t)*.45,cx+s*.42,b-(b-t)*.62,vx-s*.025,t),R=q(cx+s*.34,b,cx+s*.62,b-(b-t)*.38,cx+s*.3,b-(b-t)*.7,vx+s*.025,t);
  const it=[P_([[cx-s*1.15,t],[vx-s*.05,t]],{w:2.4,seed:sd+20}),P_([[vx+s*.05,t],[cx+s*1.15,t]],{w:2.4,seed:sd+21}),
    P_(q(cx-s*1.05,t,cx-s*.85,t-s*.2,cx-s*.55,t-s*.22,cx-s*.3,t),{w:2.4,seed:sd+22}),P_(q(cx+s*.45,t,cx+s*.62,t-s*.14,cx+s*.85,t-s*.15,cx+s*1.05,t),{w:2.4,seed:sd+23}),
    P_(L,{w:2.8,seed:sd}),P_(R,{w:2.8,seed:sd+1})];
  const C=L.map((p,k)=>[(p[0]+R[k][0])/2,(p[1]+R[k][1])/2]);for(let k=0;k<6;k++){const a=Math.floor(Math.pow(k/6,1.25)*34),e=Math.min(34,a+Math.max(2,Math.round(4-k*.5)));it.push(P_(C.slice(a,e+1),{c:'r',w:2.2,seed:sd+5+k}));}
  return it;});
// ---- objects ----
regD('house',{kind:'ground',anim:null,hatch:'b',tags:'家 房子 回家 故乡 乡 home house hometown'},(cx,cy,s,sd)=>{const w=s*.9,h=s;const H=house(cx-w/2,cy-h/2,w,h,sd);const wi=H.win;return {items:H,inside:(x,y)=>H.inside(x,y)&&!(x>wi[0]-6&&x<wi[2]+6&&y>wi[1]-6&&y<wi[3]+6)&&!(x>cx-w/2+w*.58-6&&x<cx-w/2+w*.82+6&&y>cy-h/2+h*.66-6)};});
regD('window',{kind:'object',anim:null,hatch:'b',tags:'窗 窗户 夜晚 window'},(cx,cy,s,sd)=>{const w=s*.95,h=s,x0=cx-w/2,y0=cy-h/2,x1=cx+w/2,y1=cy+h/2;return {items:[...rectItems(x0,y0,x1,y1,sd,{w:3.2}),P_([[cx,y0],[cx,y1]],{w:2.8,seed:sd+5}),P_([[x0,cy],[x1,cy]],{w:2.8,seed:sd+6}),P_([[x0-24,y1+12],[x1+24,y1+12]],{w:2.8,seed:sd+7})],
  inside:(x,y)=>x>x0+6&&x<x1-6&&y>y0+6&&y<y1-6&&Math.abs(x-cx)>6&&Math.abs(y-cy)>6};});
regD('lamp',{kind:'ground',anim:null,tags:'路灯 夜 街 lamp street night'},(cx,cy,s,sd)=>lampPost(cx,cy+s*.5,s*.8,sd));
regD('book',{kind:'object',anim:null,tags:'书 读 学习 知识 book read study'},(cx,cy,s,sd)=>{const w=s*.75,h=s*.45;const L=[[cx,cy+h*.45],[cx-w*.5,cy+h*.3],[cx-w,cy+h*.45],[cx-w,cy-h*.5],[cx-w*.5,cy-h*.62],[cx,cy-h*.45]],R=L.map(([x,y])=>[2*cx-x,y]);
  const it=[mkItem(L,{w:2.6,seed:sd,amp:.4}),mkItem(R,{w:2.6,seed:sd+1,amp:.4}),P_([[cx,cy-h*.45],[cx,cy+h*.45]],{w:2.2,seed:sd+2})];
  for(let k=0;k<4;k++){const y=cy-h*.25+k*h*.17;it.push(P_([[cx-w*.85,y],[cx-w*.15,y-4]],{w:1.6,a:.6,seed:sd+5+k,gap:.01}));it.push(P_([[cx+w*.15,y-4],[cx+w*.85,y]],{w:1.6,a:.6,seed:sd+10+k,gap:.01}));}return it;});
regD('cup',{kind:'object',anim:null,hatch:'b',tags:'咖啡 茶 杯子 早晨 cup coffee tea'},(cx,cy,s,sd)=>{const w=s*.32,t=cy-s*.1,b=cy+s*.4;const body=[[cx-w,t],[cx-w*.85,b],[cx+w*.85,b],[cx+w,t]];
  return {items:[mkItem(body,{w:2.6,seed:sd,amp:.4}),mkItem(ell(cx,t,w,w*.18,0,TAU,30),{w:2.2,seed:sd+1,amp:.2}),mkItem(ell(cx+w*1.1,(t+b)/2,w*.32,s*.13,-1.5,1.5,20),{w:2.4,seed:sd+2,amp:.3}),
    ...[-1,0,1].map(k=>mkItem(Array.from({length:14},(_,i)=>[cx+k*w*.45+Math.sin(i*.7+k)*6,t-12-i*s*.018]),{w:1.8,a:.7,seed:sd+5+k,amp:.2}))],inside:(x,y)=>pip(body)(x,y)&&y>t+w*.2};});
regD('clock',{kind:'object',anim:null,tags:'时钟 时间 等待 clock time wait'},(cx,cy,s,sd)=>{const r=s*.45;const it=[mkItem(circ(cx,cy,r,0,TAU*1.02,56),{w:2.7,seed:sd,amp:.4}),P_([[cx,cy],[cx,cy-r*.65]],{w:2.6,seed:sd+1}),P_([[cx,cy],[cx+r*.45,cy+r*.12]],{c:'r',w:2.6,seed:sd+2})];
  for(let k=0;k<12;k++){const a=k/12*TAU;it.push(P_([[cx+Math.cos(a)*r*.82,cy+Math.sin(a)*r*.82],[cx+Math.cos(a)*r*.93,cy+Math.sin(a)*r*.93]],{w:2,seed:sd+5+k,gap:.008}));}return it;});
regD('bulb',{kind:'object',anim:'pulse',hatch:null,tags:'灯泡 想法 灵感 idea bulb inspiration'},(cx,cy,s,sd)=>{const r=s*.27,gy=cy-s*.12;const it=[mkItem(circ(gy?cx:cx,gy,r,Math.PI*.72,Math.PI*2.28,46),{w:2.6,seed:sd,amp:.4}),P_([[cx-r*.5,gy+r*.8],[cx-r*.45,gy+r*1.35],[cx+r*.45,gy+r*1.35],[cx+r*.5,gy+r*.8]],{w:2.4,seed:sd+1}),
  P_([[cx-r*.45,gy+r*1.05],[cx+r*.45,gy+r*1.05]],{w:2,seed:sd+2}),P_([[cx-r*.25,gy+r*1.55],[cx+r*.25,gy+r*1.55]],{w:2.2,seed:sd+3})];for(let k=0;k<5;k++){const a=-Math.PI/2+(k-2)*.5;it.push(P_([[cx+Math.cos(a)*r*1.3,gy+Math.sin(a)*r*1.3],[cx+Math.cos(a)*r*1.65,gy+Math.sin(a)*r*1.65]],{c:'r',w:2.3,seed:sd+5+k,gap:.01}));}return it;});
regD('umbrella',{kind:'object',anim:'sway',hatch:'r',tags:'伞 雨天 保护 umbrella rain protect'},(cx,cy,s,sd)=>{const r=s*.48,top=cy-s*.1;const can=[...circ(cx,top,r,Math.PI,TAU,40)];const sc=[];for(let k=0;k<4;k++){const a=cx-r+k*r/2;sc.push(...ell(a+r/4,top,r/4,r*.12,0,Math.PI,10).reverse());}
  return {items:[mkItem([...can,...sc],{c:'r',w:2.6,seed:sd,amp:.4}),mkItem([[cx,top],[cx,cy+s*.42],[cx-s*.03,cy+s*.48],[cx-s*.08,cy+s*.45]],{w:2.5,seed:sd+1,amp:.3})],inside:(x,y)=>y<top-4&&Math.hypot(x-cx,y-top)<r-6};});
regD('letter',{kind:'object',anim:null,tags:'信 信封 想念 letter mail miss'},(cx,cy,s,sd)=>{const w=s*.7,h=s*.45;return [...rectItems(cx-w,cy-h,cx+w,cy+h,sd,{w:2.6}),P_([[cx-w,cy-h],[cx,cy+h*.15],[cx+w,cy-h]],{w:2.4,seed:sd+5}),heart(cx,cy+h*.45,s*.12,sd+6)];});
regD('sneaker',{kind:'ground',anim:null,hatch:'b',tags:'运动鞋 跑步 出发 sneaker running shoe'},(cx,cy,s,sd)=>{const w=s*.75,b=cy+s*.22;const up=[[cx-w,b-s*.06],[cx-w*.95,cy-s*.22],[cx-w*.55,cy-s*.26],[cx-w*.3,cy-s*.08],[cx+w*.35,cy+s*.02],[cx+w*.85,cy+s*.08],[cx+w,b-s*.06]];
  const it=[mkItem(up,{w:2.7,seed:sd,amp:.5}),mkItem([[cx-w,b-s*.06],[cx-w,b],[cx+w*.95,b],[cx+w,b-s*.06]],{w:2.7,seed:sd+1,amp:.4}),P_([[cx-w*1.02,b-s*.07],[cx+w,b-s*.07]],{c:'r',w:2.2,seed:sd+2})];
  for(let k=0;k<3;k++)it.push(P_([[cx-w*.38+k*w*.16,cy-s*.12+k*s*.03],[cx-w*.22+k*w*.16,cy-s*.17+k*s*.03]],{w:2,seed:sd+5+k,gap:.01}));
  return {items:it,inside:(x,y)=>pip([...up,[cx+w,b-s*.07],[cx-w,b-s*.07]])(x,y)&&x<cx-w*.35};});
// ---- city / tech ----
regD('city',{kind:'ground',anim:null,hatch:'b',tags:'城市 高楼 赛博朋克 霓虹 city skyline cyberpunk urban'},(cx,cy,s,sd)=>{const r=rnd(sd);const b=cy+s*.5;let x=cx-s*1.3;const it=[],boxes=[];
  while(x<cx+s*1.25){const w=s*(.18+r()*.2),h=s*(.35+r()*.6);boxes.push([x,b-h,x+w,b]);it.push(P_([[x,b],[x,b-h],[x+w,b-h],[x+w,b]],{w:2.4,seed:sd+it.length}));
    for(let wy=b-h+16;wy<b-16;wy+=22)for(let wx=x+10;wx<x+w-14;wx+=18)if(r()<.35)it.push(P_([[wx,wy],[wx+8,wy]],{c:r()<.25?'r':'b',w:2,seed:sd+100+it.length,gap:.006}));x+=w+s*.02;}
  it.push(P_([[cx-s*1.35,b],[cx+s*1.3,b]],{w:2.6,seed:sd+999}));return {items:it,inside:(px,py)=>boxes.some(q=>px>q[0]+5&&px<q[2]-5&&py>q[1]+5&&py<q[3]-2)};});
regD('circuit',{kind:'mark',anim:null,tags:'电路 科技 赛博 数据 circuit tech cyber data'},(cx,cy,s,sd)=>{const r=rnd(sd);const it=[];for(let k=0;k<6;k++){let x=cx-s*.7+r()*s*.3,y=cy-s*.45+k*s*.18;const pts=[[x,y]];for(let j=0;j<3;j++){if(j%2===0)x+=s*(.25+r()*.3);else y+=(r()-.5)*s*.2;pts.push([x,y]);}
  it.push(mkItem(pts,{c:k%3===1?'r':'b',w:2.1,seed:sd+k,amp:.2,raw:false}));it.push(mkItem(circ(x,y,6,0,TAU,12),{w:2,seed:sd+50+k,amp:.1}));}return it;});
regD('chip',{kind:'object',anim:'pulse',hatch:'b',tags:'芯片 AI 机器 chip ai machine'},(cx,cy,s,sd)=>{const h=s*.3;const it=[...rectItems(cx-h,cy-h,cx+h,cy+h,sd,{w:2.7}),...rectItems(cx-h*.45,cy-h*.45,cx+h*.45,cy+h*.45,sd+9,{w:2.2,c:'r'})];
  for(let k=0;k<4;k++){const o=-h*.6+k*h*.4;it.push(P_([[cx+o,cy-h],[cx+o,cy-h-s*.12]],{w:2,seed:sd+20+k,gap:.006}),P_([[cx+o,cy+h],[cx+o,cy+h+s*.12]],{w:2,seed:sd+30+k,gap:.006}),P_([[cx-h,cy+o],[cx-h-s*.12,cy+o]],{w:2,seed:sd+40+k,gap:.006}),P_([[cx+h,cy+o],[cx+h+s*.12,cy+o]],{w:2,seed:sd+50+k,gap:.006}));}
  return {items:it,inside:(x,y)=>Math.abs(x-cx)<h-5&&Math.abs(y-cy)<h-5&&!(Math.abs(x-cx)<h*.5&&Math.abs(y-cy)<h*.5)};});
regD('fence',{kind:'ground',anim:null,tags:'篱笆 院子 fence yard'},(cx,cy,s,sd)=>fence(cx-s,cx+s,cy+s*.4,s*.6,sd));
regD('pagoda',{kind:'ground',anim:null,tags:'塔 古 中国 pagoda ancient'},(cx,cy,s,sd)=>pagoda(cx,cy+s*.5,s*.8,sd));
regD('lantern',{kind:'object',anim:'sway',tags:'灯笼 节日 lantern festival'},(cx,cy,s,sd)=>lanternS(cx,cy,s*.3,sd));
regD('butterfly',{kind:'sky',anim:'butterfly',tags:'蝴蝶 春天 butterfly spring'},(cx,cy,s,sd)=>butterfly(cx,cy,s*.35,sd));
// idle motion for a drawn doodle (calm: periods >= 1.9 s, small amplitudes)
function animDoodle(P,d,ph=0){const it=d.items;if(!d.anim||!it.length)return null;const b=d.box,pc=[(b[0]+b[2])/2,(b[1]+b[3])/2];
  switch(d.anim){case 'spin':return aSpin(P,it,[d.cx,d.cy],.12);case 'sway':return aSway(P,it,[pc[0],b[3]],3,3.4,ph);case 'twinkle':return aTwinkle(P,it,ph);
    case 'flow':return aFlow(P,it,8,3.6,ph);case 'bob':return aBob(P,it,6,2.8,ph);case 'pulse':return aPulse(P,it,.04,2.4,ph);case 'butterfly':return aButterfly(P,it,30,ph);}return null;}
