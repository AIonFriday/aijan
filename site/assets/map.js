// The hero map: about 29,000 real street intersections of greater New Orleans (OpenStreetMap, ODbL),
// lit outward from The Nieux at 2040 St. Charles. Points come from nola-points.js (window.NOLA_POINTS).
// Performance: draws at ~30 fps, stops while scrolled off screen, phones under 700px draw ~60% of the dots,
// and prefers-reduced-motion shows the finished map with no animation.
(()=>{
const D=window.NOLA_POINTS, NIEUX=D.nieux;            // 2040 St. Charles Ave
const cv=document.getElementById('city'),ctx=cv.getContext('2d'),box=cv.parentElement;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPREAD=22000,FLASH=900,PIN=1200;
const hash=i=>{let h=i*374761393+668265263;h=(h^(h>>>13))*1274126177;return((h^(h>>>16))>>>0)/4294967296};
const ALL=[];
for(let i=0;i<D.p.length;i+=2){const x=D.p[i],y=D.p[i+1],r=hash(i);ALL.push({x,y,r,d:Math.hypot(x-NIEUX[0],y-NIEUX[1])})}
const maxD=[...ALL.map(p=>p.d)].sort((a,b)=>a-b)[Math.floor(ALL.length*0.9)];
ALL.forEach(p=>{p.keep=hash(p.x*31+p.y*17+5)<0.6;p.t=PIN+SPREAD*Math.pow(p.d/maxD,0.85)*(0.9+hash(p.x*7+p.y*13)*0.2)});
ALL.sort((a,b)=>a.t-b.t);
let pts=ALL,phone=null;
let waves=[],nextWave=0,onscreen=true,lastDraw=0;
let C={},W=0,H=0,sc=1,ox=0,oy=0,dot=2,layer,lctx,next=0,clock=0,last=0,req=0;
function readColors(){const s=getComputedStyle(document.documentElement);
  for(const k of['paper','ink','purple','green','gold','gold-bright','land-dim'])C[k]=s.getPropertyValue('--'+k).trim()}
const colOf=p=>p.r<0.5?C.purple:p.r<0.8?C.green:C.gold;
function layout(){
  const r=Math.min(devicePixelRatio||1,2);W=box.clientWidth;H=box.clientHeight;
  cv.width=W*r;cv.height=H*r;ctx.setTransform(r,0,0,r,0,0);
  sc=Math.min(H/740,W/470);
  const ph=W<700;                                          // phones draw half the dots; the detail is too fine to see there
  if(ph!==phone){phone=ph;pts=ph?ALL.filter(p=>p.keep):ALL;waves=[]}
  const k=Math.max(0,Math.min(1,(W/H-0.6)/0.8));          // 0 = tall phone, 1 = wide screen
  const fx=0.5+0.12*k;
  ox=fx*W-NIEUX[0]*sc;
  oy=k*(0.56*H-NIEUX[1]*sc)+(1-k)*(0.34*H-NIEUX[1]*sc);
  dot=Math.max(1.4,1.7*sc);
  layer=document.createElement('canvas');layer.width=W*r;layer.height=H*r;lctx=layer.getContext('2d');lctx.setTransform(r,0,0,r,0,0)}
const X=p=>ox+p.x*sc,Y=p=>oy+p.y*sc;
function settle(upTo){
  lctx.clearRect(0,0,W,H);
  lctx.fillStyle=C['land-dim'];for(const p of pts)lctx.fillRect(X(p)-dot/2,Y(p)-dot/2,dot,dot);
  next=0;while(next<pts.length&&pts[next].t+FLASH<=upTo){const p=pts[next++];lctx.fillStyle=colOf(p);lctx.fillRect(X(p)-dot/2,Y(p)-dot/2,dot,dot)}}
const spreadEnd=()=>pts[pts.length-1].t+FLASH;
function spawnWave(now){
  const o=pts[Math.floor(Math.random()*pts.length)],R=80+Math.random()*120;
  const order=[];for(const p of pts){const d=Math.hypot(p.x-o.x,p.y-o.y);if(d<R)order.push([d,p])}
  order.sort((a,b)=>a[0]-b[0]);
  const ci=Math.floor(Math.random()*3);
  waves.push({order,ptr:0,start:now,speed:R/7000,R,ci})}
function dotAt(c,p,s){c.fillRect(X(p)-s/2,Y(p)-s/2,s,s)}
function draw(now){
  while(next<pts.length&&pts[next].t+FLASH<=now){const p=pts[next++];lctx.fillStyle=colOf(p);dotAt(lctx,p,dot)}
  // after the city is lit: slow, quiet ripples that recolor a neighborhood as they pass
  if(!reduce&&now>spreadEnd()){
    if(now>nextWave&&waves.length<2){spawnWave(now);nextWave=now+4500+Math.random()*4000}
    for(const w of waves){const rad=(now-w.start)*w.speed;
      while(w.ptr<w.order.length&&w.order[w.ptr][0]<=rad){const p=w.order[w.ptr++][1];
        if(Math.random()<0.6){p.r=[0.25,0.65,0.9][w.ci];lctx.fillStyle=C.paper;dotAt(lctx,p,dot+1);lctx.fillStyle=colOf(p);dotAt(lctx,p,dot)}}}
    waves=waves.filter(w=>w.ptr<w.order.length)}
  ctx.fillStyle=C.paper;ctx.fillRect(0,0,W,H);
  ctx.drawImage(layer,0,0,W,H);
  // fresh lights: a soft gold flash, then they settle
  ctx.fillStyle=C.gold;
  for(let i=next;i<pts.length&&pts[i].t<=now;i++){const p=pts[i],k=1-(now-p.t)/FLASH;
    ctx.globalAlpha=0.3+0.45*k;dotAt(ctx,p,dot*(1+0.5*k))}
  // the ripple's leading edge glows faintly
  for(const w of waves){const rad=(now-w.start)*w.speed;ctx.fillStyle=C['gold-bright'];
    for(let i=w.ptr-1;i>=0&&w.order[i][0]>rad-10;i--){const f=(w.order[i][0]-(rad-10))/10;ctx.globalAlpha=0.35*f*(1-rad/w.R);dotAt(ctx,w.order[i][1],dot*1.4)}}
  ctx.globalAlpha=1;
  const px=ox+NIEUX[0]*sc,py=oy+NIEUX[1]*sc,pulse=reduce?0.5:(now%2600)/2600;
  ctx.strokeStyle=C.purple;ctx.lineWidth=1.25;ctx.globalAlpha=(1-pulse)*0.5;
  ctx.beginPath();ctx.arc(px,py,5+pulse*16,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
  ctx.fillStyle=C.gold;ctx.strokeStyle=C.ink;ctx.lineWidth=1.25;ctx.beginPath();ctx.arc(px,py,4.5,0,Math.PI*2);ctx.fill();ctx.stroke()}
function frame(t){
  if(!onscreen){req=0;return}                              // stop entirely while the map is scrolled away
  clock+=Math.min(t-last,100);last=t;
  if(t-lastDraw>=32){lastDraw=t;draw(clock)}               // ~30 frames a second is plenty for a slow spread
  req=requestAnimationFrame(frame)}
function start(){cancelAnimationFrame(req);readColors();layout();
  if(reduce){settle(Infinity);draw(Infinity);return}
  settle(-1);clock=0;last=performance.now();req=requestAnimationFrame(frame)}
function redraw(){const keep=clock;readColors();layout();settle(reduce?Infinity:keep);draw(reduce?Infinity:keep)}
start();
new IntersectionObserver(es=>{onscreen=es[0].isIntersecting;
  if(onscreen&&!req&&!reduce){last=performance.now();req=requestAnimationFrame(frame)}}).observe(box);
let rt;new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(redraw,60)}).observe(box);
})();
