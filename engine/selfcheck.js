// ============================================================================
// yaoye-ballpen-video · engine/selfcheck.js  (FRAGMENT) — geometry/timing checks, no rendering.
//  lyricOverlap : other ink on top of a written lyric glyph (dilated 4px) while it is visible
//  lyricOut     : lyric box outside the frame or touching the logo box
//  animOut/animLogo/animLyric : moving groups leaving the frame / touching logo / sprites crossing lyrics
//  elemOnSprite : elements drawn/moving on top of a character silhouette
//  spriteOut    : sprite boxes outside the frame
//  lyricsMissing/lyricsDuplicated/lyricsLate : every timeline line written exactly once, close to when it is sung
//  penInLogo    : frames where the pen barrel/shadow enters the logo box
// ============================================================================
async function selfcheck(step){
  const res={lyricOverlap:[],lyricOut:[]};
  const cv=new Canvas(W,H);const g=cv.getContext('2d');const tc=new Canvas(W,H);const tg=tc.getContext('2d');let n=0,worst=0;
  for(const P of PAGES)for(const T of P.tasks){if(T.type!=='text'||!T.li)continue;const end=T.grp?T.grp.e0-.05:P.t1-.05;
    const b=T.box.map(Math.round);const bw=b[2]-b[0],bh=b[3]-b[1];tg.setTransform(1,0,0,1,0,0);tg.clearRect(0,0,W,H);drawText(tg,T.items,1e4);const td=tg.getImageData(b[0],b[1],bw,bh).data;
    const m=new Uint8Array(bw*bh);for(let i=0;i<m.length;i++)m[i]=td[i*4+3]>40?1:0;const R=4;const md=new Uint8Array(bw*bh);for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){if(!m[y*bw+x])continue;for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<bw&&yy<bh)md[yy*bw+xx]=1;}}
    let tot=0;for(const v of md)tot+=v;
    const TS=[T.te+.3,end];for(let q=T.te+.8;q<end;q+=.6)TS.push(q);for(const t of TS){if(t<P.t0||t>=P.t1)continue;n++;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);drawPage(g,P,t,{noLyr:true,noCache:true});
      const d=g.getImageData(b[0],b[1],bw,bh).data;let ink=0;for(let i=0;i<md.length;i++)if(md[i]&&d[i*4+3]>60)ink++;const frac=ink/tot;worst=Math.max(worst,frac);
      if(frac>.003)res.lyricOverlap.push({line:T.li,page:P.id,t:+t.toFixed(2),inkFrac:+frac.toFixed(4)});}
    if(b[0]<0||b[2]>W||b[1]<0||b[3]>H||(LOGOBOX&&b[2]>LOGOBOX[0]-10&&b[1]<LOGOBOX[3]+10))res.lyricOut.push({line:T.li,box:b});}
  // 动态：每组在动的过程中外框不出画面、不碰 Logo（人物额外检查与本页歌词框不相交）
  res.animOut=[];res.animLogo=[];res.animLyric=[];let ng=0;
  for(const P of PAGES)for(const G of (P.anims||[])){ng++;const bb=G.bb;let bad={o:0,l:0,y:0};const ly=P.tasks.filter(T=>T.type==='text'&&T.li);
    for(let t=G.t0;t<P.t1;t+=.05){const tr=agTr(G,t);const cs=[[bb[0],bb[1]],[bb[2],bb[1]],[bb[0],bb[3]],[bb[2],bb[3]]].map(([X,Y])=>trPt(tr,X,Y));
      const xs=cs.map(c=>c[0]),ys=cs.map(c=>c[1]);const b=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
      const tol=12;if(!bad.o&&(b[0]<-tol||b[1]<-tol||b[2]>W+tol||b[3]>H+tol)){bad.o=1;res.animOut.push({page:P.id,g:G.name||G.kind,t:+t.toFixed(2),b:b.map(Math.round)});}
      if(!bad.l&&LOGOBOX&&b[2]>LOGOBOX[0]-20&&b[1]<LOGOBOX[3]+20){bad.l=1;res.animLogo.push({page:P.id,g:G.name||G.kind,t:+t.toFixed(2)});}
      if(G.kind==='sprite'&&!bad.y)for(const L of ly){if(t<L.ts||(L.grp&&t>=L.grp.e0))continue;const B=L.box;if(b[0]<B[2]&&b[2]>B[0]&&b[1]<B[3]&&b[3]>B[1]){bad.y=1;res.animLyric.push({page:P.id,g:G.name,t:+t.toFixed(2),line:L.li});break;}}}}
  res.animGroups=ng;
  // 动态元素 / 后画的静态元素 与人物（剪影外扩 16px）逐帧检测
  res.elemOnSprite=[];
  for(const P of PAGES){const SG=(P.anims||[]).filter(G=>G.kind==='sprite');if(!SG.length)continue;
    const EG=(P.anims||[]).filter(G=>G.kind!=='sprite');
    for(const S of SG){const sp=S.knock;const seen=new Set();
      for(let t=Math.max(P.t0,S.knockFrom??S.t0);t<P.t1;t+=.1){const ts=t>=S.t0?agTr(S,t):null;
        const hit=(X,Y)=>{const q=ts?invPt(ts,X,Y):[X,Y];return sp.inside(q[0],q[1]);};
        for(const E of EG){if(t<E.t0||seen.has(E))continue;const te=agTr(E,t);let n=0;for(const it of E.items)for(let i=0;i<it.pts.length;i+=3){const p=trPt(te,it.pts[i][0],it.pts[i][1]);if(hit(p[0],p[1]))n++;}
          if(n>0){seen.add(E);res.elemOnSprite.push({page:P.id,sprite:sp.name,el:'anim@'+E.items[0].ts.toFixed(2),bb:E.bb&&E.bb.map(Math.round),t:+t.toFixed(2),pts:n});}}
        for(const T of P.tasks){if(T.type!=='plan'||seen.has(T))continue;for(const it of T.items){if(it.ag||it.ts===undefined||it.ts<(S.knockFrom??0)||t<it.ts||it.kind==='hatch')continue;let n=0;for(let i=0;i<it.pts.length;i+=3)if(hit(it.pts[i][0],it.pts[i][1]))n++;
          if(n>0){seen.add(T);res.elemOnSprite.push({page:P.id,sprite:sp.name,el:'static@'+it.ts.toFixed(2),bb:[Math.min(...it.pts.map(p=>p[0])),Math.min(...it.pts.map(p=>p[1])),Math.max(...it.pts.map(p=>p[0])),Math.max(...it.pts.map(p=>p[1]))].map(Math.round),t:+t.toFixed(2),pts:n});break;}}}}}}


  const out=(globalThis.SPRB||[]).filter(([nm,a,b,c,d])=>a<-2||b<-2||c>W+2||d>H+2);
  const placed={};for(const P of PAGES)for(const T of P.tasks)if(T.type==='text'&&T.li)(placed[T.li]=placed[T.li]||[]).push(T.ts);
  res.lyricsMissing=LY.map((L,i)=>i+1).filter(i=>!LY[i-1].skip&&!placed[i]);res.lyricsDuplicated=Object.keys(placed).filter(k=>placed[k].length>1).map(Number);
  res.lyricsLate=Object.entries(placed).map(([k,v])=>({line:+k,sung:+LY[k-1].t.toFixed(2),written:+v[0].toFixed(2),d:+(v[0]-LY[k-1].t).toFixed(2)})).filter(o=>o.d>.8||o.d<-1.5);
  res.penInLogo=[];if(LOGOBOX){const dt=step||1/10;for(let t=0;t<MDUR;t+=dt){const tip=tipAt(t);const s=PENM.state(t,tipAt,tip);if(s&&PENM.hits(s.x,s.y,s.ang,s.lift,0)&&(PENM.HIDE?PENM.HIDE(t):1)>.05)res.penInLogo.push(+t.toFixed(2));}}
  // motion too fast: any animated channel reversing direction > 6 times within 1 s with visible amplitude (= >=3 Hz jitter / A-B swapping)
  res.animFast=[];for(const P of PAGES)for(const G of (P.anims||[])){const ch=['dx','dy','r','sx','sy'],amp={dx:1.5,dy:1.5,r:.6*DEG,sx:.006,sy:.006};let flagged=false;
    for(let w0=G.t0;w0<P.t1-.5&&!flagged;w0+=1){const v=[];for(let t=w0;t<Math.min(w0+1,P.t1);t+=1/60){const q=agTr(G,t);v.push(q);}
      for(const c of ch){let rev=0,last=0,acc=0;for(let i=1;i<v.length;i++){const d=v[i][c]-v[i-1][c];acc+=Math.abs(d);if(Math.abs(d)<1e-9)continue;const sg=Math.sign(d);if(last&&sg!==last&&acc>amp[c]){rev++;acc=0;}last=sg;}
        if(rev>6){res.animFast.push({page:P.id,g:G.name||G.kind,t:+w0.toFixed(1),channel:c,reversals:rev});flagged=true;break;}}}}
  res.buildWarnings=BUILDWARN;
  console.log(JSON.stringify({checks:n,worstFrac:+worst.toFixed(4),...res,sprites:(globalThis.SPRB||[]).length,spriteOut:out}));}
