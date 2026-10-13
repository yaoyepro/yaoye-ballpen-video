# Scene API (what you can call inside `scenes.js`)

`scenes.js` is plain JavaScript concatenated between the engine fragments (`engine/core.js`, `engine/pages.js` before it,
`engine/main.js` after it), so every engine function/constant below is in scope. It must define `function build(){...}`;
optionally `async function prepare(){...}` (runs before build, e.g. to load an extra image with `await loadImage(path)`).
Canvas is always **1920×1080**; origin top-left. **All times are video seconds** (= song time + `lead_in`).

## Globals
| name | meaning |
|---|---|
| `CFG` | resolved project.json (`CFG.title`, `CFG.credits`, `CFG.lead_in`, `CFG.palette` …) |
| `LY[i-1]` | timeline line *i*: `{text, t (sung start), e (sung end), split (start of the part after the first comma or null), skip}` |
| `MDUR` | total duration; the last page must end at `MDUR` |
| `W,H` | 1920, 1080 |
| `RULE(n)` | y of the n-th ruled line (baseline for handwriting). Lines are `rule_gap` (44) apart starting at `rule_top` (150) |
| `INK` | `{b, r, g}` pen colours |
| `LOGOBOX`, `LOGOIMG` | corner logo box `[x0,y0,x1,y1]` and image (null if no logo) |

## Pages and transitions
```js
const P=newPage(id,t0,t1,{slots:[[x,RULE(3)],[x,RULE(5)]], size:60, cam:t=>({s,ax,ay})});
flipPage(A,B,t0,t1);    // page turn A->B, t1 == B.t0, A.t1 == t0; prepare B's background before t0 (its plans may start in the past)
erasePage(A,B,t0,t1);   // big eraser wipes A (faint residue stays under B)
P.noLogo=true;          // corner logo fades out before this page (end card)
```
Pages must tile the timeline with no gaps: `P1.t1 == transition.t0`, `transition.t1 == P2.t0`. Typical flip 0.5 s, erase 0.7–0.8 s.
Items planned on B *before* B.t0 are already on the paper when it is revealed (horizon lines, frames, night sky).

## Drawing with the ONE pen
```js
addPlan(P, items, ts, te, {move:t=>[dx,dy]})   // pen draws items in order over [ts,te]; returns task
addFn(P, ts, te, draw(x,t), tip(t)|null, {cache})  // custom drawing; tip!=null means the pen follows it
```
Rule: pen tasks (plans, lyrics, fn with tip) must not overlap in time, and the pen must be idle 0.3 s before an eraser/flip.
`python bpmv.py build` prints every violation.

## Lyrics (always verbatim from the timeline)
```js
const T=lyric(P, i, slot, ts?, {size, align:'left'|'right'|'center', te})
//   i = timeline line number (1-based); slot = index into P.slots or [x,baselineY]; ts default LY[i-1].t+0.05
//   duration = clamp(0.1 s * chars, 0.62, 1.35) -> T.te ; T.box = text bbox
lyErase(P, e0, e1, [T1,T2])   // small eraser rubs those lines out (ghost fades) so slots can be reused
LYGHOST(P,i,slot)             // bbox of a line that will be written later (to keep hatching away from it in advance)
softLy([T...])                // ex(x,y,row): hatching thins naturally around these lyrics
```
Never type lyric text into scenes.js — fix the text in `work/timeline.json`.
`LY[i-1].split` (start of the half after the first comma, when ASR found it) is handy to time things to the second half.

## Other handwriting
```js
writeText(P, str, x, baselineY, size, ts, te, {align, c:'b'|'r'|'g', seed})   // titles, captions
credits(P, ts, te, {x, y0, size, align})        // CFG.credits, faded in (not pen-written)
textItems(...) / drawText(x, items, t)          // low level
```

## Characters (sprites)
```js
const s=spr(name, centerX, bottomY, {scale:1, pad:16});   // data from bpmv.py prep; display height from project.json
// s.lines (blue line art), s.stars (red hair-clip outline), s.leaves (green accent outlines), s.hatch[0..6]
// hatch layers: 0..3 blue (light->dark), 4..5 red (mouth/blush), 6 red hair-clip fill
// s.inside(x,y) silhouette test (+pad), s.box bbox
drawSprite(P, s, t0, t1, {hatch:[0,1,2,3,4,5,6], split:[.5,.08,.42]});  // line art -> accents -> hatching
hatchOf(s,[0,2,4])     // pick layers yourself and addPlan them at different times
```
Placement: keep the whole box inside 1920×1080, away from lyric slots and the logo box. Never mirror a sprite.

## Scene elements (return stroke items; pass to addPlan)
`poly(pts,{w,a,c,seed,amp})`, `mkItem(pts,o)`, `circ(cx,cy,r,a0,a1,n)` (points), `rectItems(x0,y0,x1,y1,seed)`,
`hills(y,x0,x1,seed,amp)`, `windLine(x,y,len,seed)`, `leafShape(cx,cy,h,rot,seed,c)`, `heart(cx,cy,size,seed)`,
`starX(cx,cy,r,seed,c)`, `crescent(cx,cy,r,seed)` (+`inCres`), `sun(cx,cy,r,seed,half)`, `lampPost(x,by,h,seed)`,
`house(x,y,w,h,seed)` (+`.inside`, `.win`), `tree(x,by,h,seed)`, `lanternS(x,y,r,seed)`, `butterfly(x,y,s,seed)`,
`note(x,y,s,seed)`, `petal(x,y,s,a,seed)`, `birds(x,y,s,seed)`, `fence(x0,x1,by,h,seed)`, `pagoda(x,by,s,seed)`,
`clipItems(pts,ex,o)`.
Hatching: `hatchArea(inside(x,y,row), [x0,y0,x1,y1], angleDeg, spacing, {seed,a,w,c,maxlen})`;
night sky: `night(ex, [140,150,1910,1075], seed, {sp:6.8, layers:3})` where `ex(x,y,row)` returns true to keep paper white —
combine `softLy(...)`, `s.inside`, `glowEx(x,y,r)`, `softGlow(x,y,r)`, `boxEx(box,pad)`, `LOGOEX`, `x<140` (margin).
Seeds: give each element its own seed so re-builds are identical.

## Motion after drawing (calm, ≤ 3 back-and-forth per second)
```js
animSpr(P, s, (t,k)=>({...breathe(k,t)}), {parts:[{poly:[[u,v]...], pivot:[u,v], f:(t,k)=>angle}], knock:s, knockFrom})
ANIM(P, items, (t,k,tAbs)=>({dx,dy,r,sx,sy,a}), {pivot|base:true|top:true})
aTwinkle, aSway(P,items,'base'|'top'|[x,y],deg,per), aBob, aFlow, aPulse, aRise, aFall, aSpin, aFly, aButterfly
osc(t,per,ph), bump(t,per), sine(u), pr(t,a,b), DEG
```
`t` = seconds since the group finished drawing, `k` eases 0→1. Moving characters: pass `knock` (default in animSpr) so the paper
hides lines under them. Self-check verifies animated boxes stay in frame, off the logo and off lyrics.

## Camera
`newPage(..., {cam:t=>({s:1+.08*sine(pr(t,a,b)), ax:1100, ay:760})})` — slow push-in; items drawn with `cam` follow it.
Lyrics are not scaled by the camera.

## Script-mode helpers (engine/doodles.js, engine/auto.js)
| function / const | meaning |
|---|---|
| `autoBuild({after, replace})` | builds the whole film from `work/plan.json`; hooks per page id (see STRUCTURE.md §7) |
| `doodle(name,cx,cy,size,seed,{c})` | library doodle → `{items, inside, hatchC, anim, kind, box}`; draw with `addPlan(P,d.items,ts,te)` |
| `hatchMain(d)` | 2-layer hatching items for a shaded doodle (second layer on the shadow half) |
| `animDoodle(P,d,phase)` | attach the doodle's calm idle motion (pulse/sway/twinkle/flow/bob) |
| `placeExtra(name,occ,mainBox,seed,size)` | find free space for a small doodle (avoids text, main, margin, logo) |
| `strokeMask(items,pad)` | `(x,y)=>bool` near any of the given strokes — use as hatch exclusion so shading stays off outlines |
| `GROUND` | y of the pen ground line (1000) |
| `regD(name,{kind,anim,hatch,tags},fn)` | register a new doodle (objects/nature only) |
| `DOODLE_NAMES()` | list of library doodles |
