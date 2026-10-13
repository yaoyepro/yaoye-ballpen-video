// yaoye-ballpen-video · engine/pen.js — the visible ballpoint pen prop (required by build/mv.js).
// Realistic pen: transparent hexagonal barrel, coloured cap + clip, metal tip, highlights; the cast shadow separates/blurs with lift height
// and touches the tip when writing. Angle follows the writing direction slowly; lifts slightly when moving; fades out after idling.
// Logo avoidance: neither barrel nor shadow may enter the logo box (M.AVOID); the pen is stood up steeper near it (smooth precomputed field).
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),lerp=(a,b,u)=>a+(b-a)*u;
const ANG0=-1.08,LEN=600;
const M={AVOID:null,INK:'#2440B8',W:1920,H:1080};
function hits(x,y,ang,lift,m=26){const B=M.AVOID;if(!B)return false;const b=[B[0]-m,B[1]-m,B[2]+m,B[3]+m];const c=Math.cos(ang),s=Math.sin(ang);
  for(let d=40;d<=LEN+10;d+=15){const w=d<62?10:24;const px=x-lift*6+c*d,py=y-lift*16+s*d;if(px+w>b[0]&&px-w<b[2]&&py+w>b[1]&&py-w<b[3])return true;
    const h=lift*26+d*.24,sw=lerp(3,17,d/LEN)+8;const qx=x+c*d+.62*h,qy=y+s*d+.42*h;if(qx+sw>b[0]&&qx-sw<b[2]&&qy+sw>b[1]&&qy-sw<b[3])return true;}return false;}
let CAP=null;const GS=16;
function buildCap(){const B=M.AVOID;const nx=Math.ceil(M.W/GS)+1,ny=Math.ceil(M.H/GS)+1;let g=new Float32Array(nx*ny).fill(.5);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=i*GS,y=j*GS;if(x<B[0]-LEN-80||y>B[3]+LEN+80){continue;}let a=.5;
    a=-2.05;for(let c=-2.05;c<=.5;c+=.01){if(hits(x,y,c,0)||hits(x,y,c,1))break;a=c;}g[j*nx+i]=a-.14;}
  // 最小值扩张（保守）+ 盒式模糊（平滑）
  const mn=new Float32Array(g.length);for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let m=9;for(let dj=-5;dj<=5;dj++)for(let di=-5;di<=5;di++){const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<nx&&b<ny)m=Math.min(m,g[b*nx+a]);}mn[j*nx+i]=m;}
  for(let pass=0;pass<4;pass++){const o=new Float32Array(g.length);for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let s=0,n=0;for(let dj=-3;dj<=3;dj++)for(let di=-3;di<=3;di++){const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<nx&&b<ny){s+=mn[b*nx+a];n++;}}o[j*nx+i]=s/n;}mn.set(o);}
  CAP={g:mn,nx,ny};}
function capAt(x,y){if(!M.AVOID)return 9;if(!CAP)buildCap();const {g,nx,ny}=CAP;const fx=clamp(x/GS,0,nx-1.001),fy=clamp(y/GS,0,ny-1.001),i=Math.floor(fx),j=Math.floor(fy),u=fx-i,v=fy-j;
  return lerp(lerp(g[j*nx+i],g[j*nx+i+1],u),lerp(g[(j+1)*nx+i],g[(j+1)*nx+i+1],u),v);}
function avoidD(x,y,ang,lift){if(!hits(x,y,ang,lift))return 0;for(let k=1;k<=40;k++){const d=k*.015;if(ang-d>=-1.62&&!hits(x,y,ang-d,lift))return -d;if(k<=20&&!hits(x,y,ang+d,lift))return d;}return -(ang+1.62);}// 右手握笔：笔尖在左下，笔杆往右上方斜（不压刚写好的部分）；投影仍落在右下
function state(t,tipAt,cur,raw){
  const hist=[];for(let k=1;k<=8;k++){const p=tipAt(t-k*.05);hist.push(p);}
  let tip=cur,idle=0,fade=1;
  if(!tip){// 停笔：停在最后一个位置，抬起，慢慢淡出
    let k=hist.findIndex(p=>p);if(k<0)return null;tip={...hist[k],lift:1};idle=(k+1)*.05;
    // 若马上又要落笔（翻页/擦除等长停顿除外），保持可见
    let nx=null;for(let j=1;j<=6;j++){const p=tipAt(t+j*.05);if(p){nx=p;break;}}
    if(nx){tip={x:lerp(tip.x,nx.x,.0),y:tip.y,lift:1};fade=1;}else fade=1-clamp((idle-.25)/.4);
    if(fade<=0)return null;}
  // 刚出现：淡入
  const seen=hist.slice(0,4).filter(Boolean).length;if(cur&&seen===0)fade=Math.min(fade,.35);else if(cur&&seen<3)fade=Math.min(fade,.6+seen*.15);
  // 运笔方向（0.3s 位移，平滑）
  const old=hist.slice(2,6).filter(Boolean);let vx=0,vy=0;if(old.length){const o={x:old.reduce((s,p)=>s+p.x,0)/old.length,y:old.reduce((s,p)=>s+p.y,0)/old.length};vx=(tip.x-o.x)/.2;vy=(tip.y-o.y)/.2;}
  let ang=ANG0+.13*Math.tanh(vx/700)-.06*Math.tanh(vy/700)+.02*Math.sin(t*1.3);
  const lift=clamp(tip.lift||0);
  // 避让：查预先算好的平滑「最大允许角」场（越靠近 Logo 要求笔越陡），取 min，连续不抖
  const pp=[tip,...hist.slice(0,6).filter(Boolean)];const ax=pp.reduce((s,p)=>s+p.x,0)/pp.length,ay=pp.reduce((s,p)=>s+p.y,0)/pp.length;
  ang=Math.min(ang,capAt(ax,ay),capAt(tip.x,tip.y)+.1);
  // 时间平滑：与前 5 帧（1/60s 间隔）的角度做加权平均，避免笔向一帧内突变；平滑后再兜底避让
  if(!raw&&M.SMOOTH!==false){let sw=1,sa=ang;for(let k=1;k<=10;k++){const q=state(t-k/60,tipAt,tipAt(t-k/60),true);if(!q)break;const w=1-k/11;sa+=q.ang*w;sw+=w;}ang=sa/sw;}
  // 兜底：只要笔/笔影真正进入 Logo 外 10px，就最小幅度地再立陡
  if(hits(tip.x,tip.y,ang,lift,10)){for(let d=.01;d<.8&&hits(tip.x,tip.y,ang,lift,10);d+=.01)ang-=.01;}
  return {x:tip.x,y:tip.y,ang,lift,fade};}
function draw(x,t,tipAt,cur){const s=state(t,tipAt,cur);if(!s)return;const {ang,lift}=s;const fade=s.fade*(M.HIDE?M.HIDE(t):1);if(fade<=.01)return;const dir=[Math.cos(ang),Math.sin(ang)];
  x.save();x.globalAlpha=fade;
  // ---- 纸上投影：笔尖着纸处影子与笔尖重合；越往笔尾离纸越高，影子越偏、越虚 ----
  const L=[.62,.42];const h0=lift*26;// 抬笔高度
  const seg=[[0,90],[90,220],[220,380],[380,LEN]];
  for(const [d0,d1] of seg){const hA=h0+d0*.24,hB=h0+d1*.24;const wA=lerp(3,17,d0/LEN)+lift*3,wB=lerp(3,17,d1/LEN)+lift*3;
    const A=[s.x+dir[0]*d0+L[0]*hA,s.y+dir[1]*d0+L[1]*hA],B=[s.x+dir[0]*d1+L[0]*hB,s.y+dir[1]*d1+L[1]*hB];const n=[-dir[1],dir[0]];
    x.save();x.filter=`blur(${(1.5+(d0+d1)/2/55+lift*4).toFixed(1)}px)`;x.fillStyle=`rgba(45,40,60,${(.36-(d0+d1)/2/LEN*.16-lift*.08).toFixed(3)})`;
    x.beginPath();x.moveTo(A[0]+n[0]*wA,A[1]+n[1]*wA);x.lineTo(B[0]+n[0]*wB,B[1]+n[1]*wB);x.lineTo(B[0]-n[0]*wB,B[1]-n[1]*wB);x.lineTo(A[0]-n[0]*wA,A[1]-n[1]*wA);x.closePath();x.fill();x.restore();}
  // 笔尖与纸接触的一点墨影
  if(lift<.2){x.save();x.filter='blur(1.2px)';x.fillStyle=`rgba(30,40,90,${.35*(1-lift*5)})`;x.beginPath();x.arc(s.x+1,s.y+1,2.2,0,7);x.fill();x.restore();}
  // ---- 笔体（抬笔时朝镜头抬起：上移、略放大）----
  x.translate(s.x-lift*6,s.y-lift*16);x.rotate(ang);x.scale(1+lift*.05,1+lift*.05);
  const hw=d=>d<32?lerp(1.3,7.5,d/32):d<62?lerp(8,12,(d-32)/30):lerp(12.5,17,(d-62)/(LEN-62));
  const body=(d0,d1)=>{x.beginPath();x.moveTo(d0,-hw(d0));for(let d=d0;d<=d1;d+=20)x.lineTo(d,-hw(d));x.lineTo(d1,-hw(d1));x.lineTo(d1,hw(d1));for(let d=d1;d>=d0;d-=20)x.lineTo(d,hw(d));x.lineTo(d0,hw(d0));x.closePath();};
  // 金属笔尖
  let g=x.createLinearGradient(0,-7,0,7);g.addColorStop(0,'#6E727B');g.addColorStop(.35,'#EEF0F3');g.addColorStop(.6,'#A9ADB5');g.addColorStop(1,'#5B5F68');x.fillStyle=g;body(0,32);x.fill();
  x.fillStyle='#2A2C33';x.beginPath();x.arc(.8,0,1.3,0,7);x.fill();
  // 前握段（半透明白塑料）
  g=x.createLinearGradient(0,-10,0,10);g.addColorStop(0,'rgba(250,250,252,.92)');g.addColorStop(.4,'rgba(232,236,242,.88)');g.addColorStop(1,'rgba(180,186,198,.92)');x.fillStyle=g;body(32,62);x.fill();
  // 笔芯（透过笔杆可见）：蓝色墨水 + 后段透明
  x.fillStyle=M.INK;x.globalAlpha*=.92;x.fillRect(50,-2.8,330,5.6);x.globalAlpha/=.92;x.fillStyle='rgba(150,165,200,.6)';x.fillRect(380,-2.8,140,5.6);x.fillStyle='rgba(36,64,184,.18)';x.fillRect(70,1.5,300,4);
  // 透明六棱笔杆
  g=x.createLinearGradient(0,-13,0,13);g.addColorStop(0,'rgba(120,130,150,.45)');g.addColorStop(.12,'rgba(255,255,255,.55)');g.addColorStop(.3,'rgba(220,228,240,.28)');g.addColorStop(.55,'rgba(200,210,226,.18)');g.addColorStop(.85,'rgba(150,160,182,.32)');g.addColorStop(1,'rgba(90,98,120,.5)');
  x.fillStyle=g;body(62,LEN-70);x.fill();x.strokeStyle='rgba(80,88,112,.6)';x.lineWidth=1.3;x.stroke();
  // 棱线 + 长高光
  x.strokeStyle='rgba(255,255,255,.75)';x.lineWidth=2.2;x.beginPath();x.moveTo(64,-hw(64)*.55);x.lineTo(LEN-80,-hw(LEN-80)*.55);x.stroke();
  x.strokeStyle='rgba(110,120,145,.25)';x.lineWidth=1;for(const k of [-.15,.35]){x.beginPath();x.moveTo(64,hw(64)*k);x.lineTo(LEN-80,hw(LEN-80)*k);x.stroke();}
  // 蓝色笔帽（尾塞）+ 笔夹
  g=x.createLinearGradient(0,-15,0,15);g.addColorStop(0,'#3D5BD0');g.addColorStop(.3,'#6F88E6');g.addColorStop(.55,M.INK);g.addColorStop(1,'#14267A');x.fillStyle=g;
  x.beginPath();x.roundRect(LEN-74,-18,82,36,[3,11,11,3]);x.fill();
  x.save();x.filter='blur(2px)';x.fillStyle='rgba(20,30,70,.25)';x.fillRect(LEN-190,-22,150,6);x.restore();
  x.fillStyle=M.INK;x.beginPath();x.roundRect(LEN-200,-25,170,7,3);x.fill();x.fillStyle='rgba(255,255,255,.45)';x.fillRect(LEN-195,-24.5,150,1.8);
  x.restore();}
module.exports=M;M.draw=draw;M.state=state;M.hits=hits;M.capAt=capAt;
