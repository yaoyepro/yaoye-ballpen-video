// ============================================================================
// yaoye-ballpen-video · engine/main.js  (FRAGMENT, concatenated LAST, after the project's scenes.js)
// Frame compositor + CLI:  node build/mv.js <mode>
//   warn                       -> timing warnings of the scene plan
//   info                       -> JSON summary (pages, transitions, lyric placement)
//   png <dir> <t1,t2,...>      -> still frames (fast preview, no video)
//   chunk <out.mp4> <f0> <f1> <fps>  -> render frames [f0,f1) to an h264 chunk (used by scripts/render.py)
//   selfcheck                  -> JSON geometry/timing checks (used by scripts/check.py)
//   penlog <out.json>          -> pen-down/speed samples + transitions (used for foley sound, scripts/audio.py)
// ============================================================================
let BUF1=null,BUF2=null;
function pageAt(t){let P=null;for(const p of PAGES)if(t>=p.t0&&t<p.t1)P=p;return P;}
function transAt(t){for(const tr of TRANS)if(t>=tr.t0&&t<tr.t1)return tr;return null;}
function tipAt(t){if(t<0||transAt(t))return null;for(const [e0,e1] of HIDEW)if(t>=e0&&t<e1)return null;const P=pageAt(t);return P?pageTip(P,t):null;}
const PENM=require(path.join(ENGINE_DIR,'pen.js'));PENM.INK=INK.b;
PENM.HIDE=t=>{let f=1;for(const [e0,e1] of HIDEW){if(t>e0-.4&&t<e1+.3)f=Math.min(f,1-pr(t,e0-.4,e0-.08)*(1-pr(t,e1+.02,e1+.3)));}for(const tr of TRANS){if(t>tr.t0-.3&&t<tr.t1+.3)f=Math.min(f,1-pr(t,tr.t0-.3,tr.t0)*(1-pr(t,tr.t1,tr.t1+.3)));}return f;};
// corner logo: fades in at the start; fades out before any page flagged P.noLogo=true (e.g. an end card showing the big logo)
function logoA(t){let a=pr(t,.15,.6);for(const P of PAGES)if(P.noLogo&&t>=P.t0-.55&&t<P.t1)a=Math.min(a,1-pr(t,P.t0-.55,P.t0-.05));return a;}
function frame(cv,t,o={}){const x=cv.getContext('2d');x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;let tip=null;
  if(!BUF1){BUF1=new Canvas(W,H);BUF2=new Canvas(W,H);}
  const tr=transAt(t);
  if(tr&&tr.type==='flip'){const a=BUF1.getContext('2d');a.drawImage(PAPER,0,0);a.drawImage(layerAt(tr.A,tr.t0,'end'),0,0);const b=BUF2.getContext('2d');b.drawImage(PAPER,0,0);b.drawImage(layerAt(tr.B,tr.t1,'start'),0,0);flip(x,BUF1,BUF2,pr(t,tr.t0,tr.t1));}
  else if(tr&&tr.type==='erase'){x.drawImage(PAPER,0,0);eraser(x,layerAt(tr.A,tr.t0,'end'),t,tr.t0,tr.t1);}
  else{x.drawImage(PAPER,0,0);const P=pageAt(t);if(P){drawPage(x,P,t,o);tip=pageTip(P,t);}}
  if(!o.noPen){for(const [e0,e1] of HIDEW)if(t>=e0&&t<e1)tip=null;if(tr)tip=null;PENM.draw(x,t,tipAt,tip);}
  if(!o.noLogo){const a=logoA(t);if(a>0)logo(x,a);}// logo drawn after the pen: always on top
  return cv;}
async function load(){buildPaper();await loadSprites();for(const n of Object.keys(SP))await spriteMask(n);await buildLogo();PENM.AVOID=LOGOBOX;
  if(typeof prepare==='function')await prepare();// optional async hook in scenes.js
  if(typeof build!=='function')throw new Error('scenes.js must define function build()');build();finalizePages();}
if(require.main===module){(async()=>{await load();const [mode,...a]=process.argv.slice(2);const {spawn}=require('child_process');
  if(mode==='warn'){console.log(BUILDWARN.join('\n')||'no warnings');}
  if(mode==='info'){const placed={};for(const P of PAGES)for(const T of P.tasks)if(T.type==='text'&&T.li)(placed[T.li]=placed[T.li]||[]).push({page:P.id,ts:+T.ts.toFixed(2)});
    console.log(JSON.stringify({duration:MDUR,lead_in:LEAD,pages:PAGES.map(P=>({id:P.id,t0:P.t0,t1:P.t1,tasks:P.tasks.length})),transitions:TRANS.map(t=>({type:t.type,from:t.A.id,to:t.B.id,t0:t.t0,t1:t.t1})),lyrics:LY.map((L,i)=>({i:i+1,text:L.text,sung:+L.t.toFixed(2),skip:L.skip,placed:placed[i+1]||[]})),warnings:BUILDWARN},null,1));}
  if(mode==='png'){fs.mkdirSync(a[0],{recursive:true});const cv=new Canvas(W,H);for(const ts of a[1].split(',')){frame(cv,+ts);await cv.toFile(path.join(a[0],`t_${(+ts).toFixed(2).padStart(6,'0')}.png`));}console.log('ok');}
  if(mode==='chunk'){const [out,f0,f1,fps]=a.map((v,i)=>i?+v:v);const cv=new Canvas(W,H);const tmp=out+'.part.mp4';
    const ff=spawn(process.env.FFMPEG||'ffmpeg',['-v','error','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${W}x${H}`,'-r',String(fps),'-i','-','-c:v','libx264','-preset','veryfast','-crf',String(CFG.render.chunk_crf),'-pix_fmt','yuv420p',tmp],{stdio:['pipe','inherit','inherit']});
    for(let f=f0;f<f1;f++){frame(cv,f/fps);const b=cv.toBufferSync('raw');if(!ff.stdin.write(b))await new Promise(r=>ff.stdin.once('drain',r));}
    ff.stdin.end();const code=await new Promise(r=>ff.on('close',r));if(code!==0)throw new Error('ffmpeg exit '+code);fs.renameSync(tmp,out);}
  if(mode==='selfcheck')await selfcheck(a[0]?+a[0]:null);
  if(mode==='penlog'){// pen activity for foley: 100 Hz samples [down(0/1), speed px/s] + transitions + small erasers
    const fps=100,N=Math.ceil(MDUR*fps);const S=[];let prev=null;for(let f=0;f<N;f++){const t=f/fps;const p=tipAt(t);let down=0,v=0;if(p){down=(p.lift||0)<.05?1:0;if(prev)v=Math.hypot(p.x-prev.x,p.y-prev.y)*fps;}prev=p;S.push([down,Math.round(v)]);}
    const small=PAGES.flatMap(P=>P.groups.map(G=>[G.e0,G.e1]));
    fs.writeFileSync(a[0],JSON.stringify({fps,duration:MDUR,samples:S,transitions:TRANS.map(t=>({type:t.type,t0:t.t0,t1:t.t1})),small_erase:small}));console.log('ok');}
})().catch(e=>{console.error(e);process.exit(1);});}
