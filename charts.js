"use strict";
(()=>{const A=SimApp;
function makeScale(arrays,mode,domain){const tr=mode==="log"?(v=>v>0?Math.log10(v):NaN):mode==="symlog"?(v=>A.symlog(v)):(v=>v);let lo=Infinity,hi=-Infinity,n=0;for(const ar of arrays)for(const v of ar){const t=tr(v);if(Number.isFinite(t)){lo=Math.min(lo,t);hi=Math.max(hi,t);n++;}}if(!n)return null;if(domain){if(Number.isFinite(domain.min)){const t=tr(domain.min);if(Number.isFinite(t))lo=t;}if(Number.isFinite(domain.max)){const t=tr(domain.max);if(Number.isFinite(t))hi=t;}}if(lo===hi){lo-=.05;hi+=.05;}const pad=(hi-lo)*.035||.05;return{mode,min:lo-pad,max:hi+pad,transform:tr};}
function logTicks(s){const o=[];for(let p=Math.floor(s.min);p<=Math.ceil(s.max);p++)for(const m of[1,2,4,6,8]){const v=m*10**p,t=Math.log10(v);if(t>=s.min&&t<=s.max)o.push({t,value:v,major:m===1});}return o.sort((a,b)=>a.t-b.t);}
function symlogTicks(s){const o=[{t:0,value:0,major:true}],max=Math.max(Math.abs(A.invSymlog(s.min)),Math.abs(A.invSymlog(s.max))),pm=Math.ceil(Math.log10(Math.max(1,max/CONFIG.symlogLinearThreshold)));for(let p=-3;p<=pm;p++)for(const m of[1,2,4,6,8])for(const sg of[-1,1]){const v=sg*m*10**p,t=A.symlog(v);if(t>=s.min&&t<=s.max)o.push({t,value:v,major:m===1});}return o.sort((a,b)=>a.t-b.t);}
function ypx(s,v,p){const t=s.transform(v);return Number.isFinite(t)?p.y+p.h*(1-(t-s.min)/(s.max-s.min)):NaN;}
function drawY(ctx,p,s){
  const ticks=s.mode==="log"?logTicks(s):s.mode==="symlog"?symlogTicks(s):[];
  for(const tk of ticks){
    const y=p.y+p.h*(1-(tk.t-s.min)/(s.max-s.min));
    ctx.strokeStyle=tk.major?A.style.gridMajor:A.style.gridMinor;
    ctx.lineWidth=tk.major?1.15:.8;
    ctx.beginPath();ctx.moveTo(p.x,y);ctx.lineTo(p.x+p.w,y);ctx.stroke();

    const label=A.numberLabel(tk.value);
    ctx.fillStyle=tk.major?A.style.axisColor:"rgba(192,200,212,.72)";
    ctx.font=tk.major?"11px system-ui":"9px system-ui";
    ctx.textBaseline="middle";

    ctx.textAlign="right";
    ctx.fillText(label,p.x-8,y);

    ctx.textAlign="left";
    ctx.fillText(label,p.x+p.w+8,y);
  }
}
function drawX(ctx,p,xv){
  if(!xv?.length)return;
  const first=Number(xv[0]??0),last=Number(xv[xv.length-1]??(xv.length-1));
  const totalDays=Math.max(0,last-first);
  const totalYears=totalDays/CONFIG.tradingDaysPerYear;
  const intervalYears=totalYears>=5?5:1;
  const marks=[0];
  for(let y=intervalYears;y<=totalYears+1e-9;y+=intervalYears)marks.push(y);

  // 最終年が刻みから大きく外れる場合だけ末尾も表示
  if(totalYears>0 && totalYears-marks[marks.length-1] >= intervalYears*.45) marks.push(totalYears);

  ctx.font="10px system-ui";
  for(const years of marks){
    const targetDay=first+years*CONFIG.tradingDaysPerYear;
    const ratio=totalDays>0?(targetDay-first)/totalDays:0;
    const x=p.x+p.w*A.clamp(ratio,0,1);

    ctx.strokeStyle=A.style.gridMajor;
    ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,p.y);ctx.lineTo(x,p.y+p.h);ctx.stroke();

    const roundedYears=Math.abs(years-Math.round(years))<1e-8?Math.round(years):Number(years.toFixed(1));
    ctx.fillStyle=A.style.axisColor;
    ctx.textAlign="center";
    ctx.textBaseline="top";
    ctx.fillText(`${roundedYears}年`,x,p.y+p.h+10);
  }
}
function placeTooltip(el,x,y,html,wrap){el.innerHTML=html;el.classList.remove("hidden");requestAnimationFrame(()=>{const w=el.offsetWidth,h=el.offsetHeight,r=wrap.getBoundingClientRect();let left=A.clamp(x-w/2,4,r.width-w-4),top=y-h-12;if(top<4)top=y+12;el.style.left=`${left}px`;el.style.top=`${A.clamp(top,4,r.height-h-4)}px`;});}
A.drawPathChart=(canvas,series,opts={})=>{const{ctx,w,h}=A.resizeCanvas(canvas),pad=CONFIG.chartPadding,p={x:pad.left,y:pad.top,w:w-pad.left-pad.right,h:h-pad.top-pad.bottom};ctx.clearRect(0,0,w,h);const arrays=series.map(s=>s.values);if(opts.band)arrays.push(opts.band.lower,opts.band.upper);if(opts.median)arrays.push(opts.median);if(opts.mean)arrays.push(opts.mean);if(opts.reference)arrays.push(opts.reference);let mode=opts.scaleMode||"log";if(mode==="log"&&arrays.some(ar=>Array.from(ar).some(v=>Number.isFinite(v)&&v<=0)))mode="symlog";const scale=makeScale(arrays,mode,opts.domainOriginal);if(!scale)return;drawY(ctx,p,scale);drawX(ctx,p,opts.xValues);ctx.save();ctx.beginPath();ctx.rect(p.x,p.y,p.w,p.h);ctx.clip();
if(opts.band){const n=opts.band.lower.length;ctx.beginPath();let st=false;for(let i=0;i<n;i++){const x=p.x+p.w*i/Math.max(1,n-1),y=ypx(scale,opts.band.upper[i],p);if(!Number.isFinite(y))continue;if(!st){ctx.moveTo(x,y);st=true}else ctx.lineTo(x,y);}for(let i=n-1;i>=0;i--){const x=p.x+p.w*i/Math.max(1,n-1),y=ypx(scale,opts.band.lower[i],p);if(Number.isFinite(y))ctx.lineTo(x,y);}ctx.closePath();ctx.fillStyle=A.rgba(A.style.ciColor,A.style.ciFillAlpha);ctx.fill();for(const ar of[opts.band.lower,opts.band.upper]){ctx.beginPath();st=false;for(let i=0;i<n;i++){const x=p.x+p.w*i/Math.max(1,n-1),y=ypx(scale,ar[i],p);if(!Number.isFinite(y))continue;if(!st){ctx.moveTo(x,y);st=true}else ctx.lineTo(x,y);}ctx.strokeStyle=A.rgba(A.style.ciColor,A.style.ciEdgeAlpha);ctx.lineWidth=A.style.ciEdgeWidth;ctx.stroke();}}
for(const s of series){ctx.beginPath();let st=false;for(let i=0;i<s.values.length;i++){const y=ypx(scale,s.values[i],p);if(!Number.isFinite(y)){st=false;continue;}const x=p.x+p.w*i/Math.max(1,s.values.length-1);if(!st){ctx.moveTo(x,y);st=true}else ctx.lineTo(x,y);}ctx.strokeStyle=s.color;ctx.globalAlpha=s.alpha;ctx.lineWidth=s.width;ctx.stroke();ctx.globalAlpha=1;}
const ref=(ar,c,wid,al=1,d=[])=>{if(!ar)return;ctx.beginPath();let st=false;for(let i=0;i<ar.length;i++){const y=ypx(scale,ar[i],p);if(!Number.isFinite(y)){st=false;continue;}const x=p.x+p.w*i/Math.max(1,ar.length-1);if(!st){ctx.moveTo(x,y);st=true}else ctx.lineTo(x,y);}ctx.strokeStyle=c;ctx.globalAlpha=al;ctx.lineWidth=wid;ctx.setLineDash(d);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;};
if(opts.reference)ref(opts.reference,"#c9a55a",1.4,.9,[5,4]);if(opts.median)ref(opts.median,A.style.medianColor,A.style.medianWidth,A.style.medianAlpha);if(opts.mean)ref(opts.mean,A.style.meanColor,A.style.meanWidth,A.style.meanAlpha,[7,4]);ctx.restore();ctx.strokeStyle=A.style.frameColor;ctx.strokeRect(p.x,p.y,p.w,p.h);
canvas.__lineMeta={plot:p,scale,xValues:opts.xValues,centerValues:opts.centerValues,tooltipId:opts.tooltipId,valueLabel:opts.valueLabel,transformY:v=>ypx(scale,v,p)};};
A.handleLineClick=(canvas,e)=>{const m=canvas.__lineMeta;if(!m||!m.centerValues)return;const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;if(x<m.plot.x||x>m.plot.x+m.plot.w)return;const i=A.clamp(Math.round((x-m.plot.x)/m.plot.w*(m.centerValues.length-1)),0,m.centerValues.length-1),px=m.plot.x+m.plot.w*i/Math.max(1,m.centerValues.length-1),py=m.transformY(m.centerValues[i]);if(!Number.isFinite(py)||Math.abs(y-py)>14)return;const step=Number(m.xValues[i]??i),years=step/CONFIG.tradingDaysPerYear,el=A.$(m.tooltipId),wrap=canvas.parentElement;placeTooltip(el,px,py,`時点：${A.numberLabel(step)}日 (${years.toFixed(1)}年)<br>${m.valueLabel}：${A.numberLabel(m.centerValues[i])}`,wrap);};
A.drawLogHistogram=(canvas,values,opts={})=>{const clean=values.filter(v=>Number.isFinite(v)&&v>0);if(!clean.length)return null;const{lowerQ,upperQ}=A.getConfidence(),s=A.summarize(clean,lowerQ,upperQ),logs=clean.map(Math.log10);let lo=Math.min(...logs),hi=Math.max(...logs);if(lo===hi){lo-=.05;hi+=.05;}const bins=CONFIG.histogramBins,cnt=Array(bins).fill(0),bw=(hi-lo)/bins;for(const x of logs){let b=Math.floor((x-lo)/bw);if(b===bins)b--;cnt[A.clamp(b,0,bins-1)]++;}const cum=[];let cs=0;for(const c of cnt){cs+=c;cum.push(cs);}const{ctx,w,h}=A.resizeCanvas(canvas),pad=CONFIG.chartPadding,p={x:pad.left,y:pad.top,w:w-pad.left-pad.right,h:h-pad.top-pad.bottom},ym=Math.max(...cnt)*1.08||1;ctx.clearRect(0,0,w,h);ctx.font="10px system-ui";for(let k=0;k<=5;k++){const c=Math.round(ym*k/5),y=p.y+p.h*(1-k/5);ctx.strokeStyle=A.style.gridMajor;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(p.x,y);ctx.lineTo(p.x+p.w,y);ctx.stroke();ctx.fillStyle=A.style.axisColor;ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText(c.toLocaleString(),p.x-8,y);}
for(const tk of logTicks({min:lo,max:hi})){const x=p.x+p.w*(tk.t-lo)/(hi-lo);ctx.strokeStyle=tk.major?A.style.gridMajor:A.style.gridMinor;ctx.lineWidth=tk.major?1.1:.8;ctx.beginPath();ctx.moveTo(x,p.y);ctx.lineTo(x,p.y+p.h);ctx.stroke();ctx.save();ctx.translate(x,p.y+p.h+9);ctx.rotate(-Math.PI/2);ctx.fillStyle=tk.major?A.style.axisColor:"rgba(192,200,212,.72)";ctx.font=tk.major?"10px system-ui":"8px system-ui";ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText(A.numberLabel(tk.value),0,0);ctx.restore();}
const bar=p.w/bins;for(let i=0;i<bins;i++){const bh=p.h*cnt[i]/ym;ctx.fillStyle="#5077c8";ctx.fillRect(p.x+i*bar+1,p.y+p.h-bh,Math.max(1,bar-2),bh);}const marker=(v,c,wid,d=[])=>{const xl=Math.log10(v),x=p.x+p.w*(xl-lo)/(hi-lo);if(x<p.x||x>p.x+p.w)return;ctx.save();ctx.strokeStyle=c;ctx.lineWidth=wid;ctx.setLineDash(d);ctx.beginPath();ctx.moveTo(x,p.y);ctx.lineTo(x,p.y+p.h);ctx.stroke();ctx.restore();};marker(s.lower,A.rgba(A.style.ciColor,A.style.ciEdgeAlpha),A.style.ciEdgeWidth,[5,4]);marker(s.upper,A.rgba(A.style.ciColor,A.style.ciEdgeAlpha),A.style.ciEdgeWidth,[5,4]);if(opts.showMedian)marker(s.median,A.style.medianColor,A.style.medianWidth);if(opts.showMean)marker(s.mean,A.style.meanColor,A.style.meanWidth,[7,4]);
if(Number.isFinite(opts.centerValue)&&opts.centerValue>0){const xl=Math.log10(opts.centerValue),x=p.x+p.w*(xl-lo)/(hi-lo);if(x>=p.x&&x<=p.x+p.w){ctx.fillStyle=A.style.centerColor;ctx.beginPath();ctx.moveTo(x,p.y+3);ctx.lineTo(x-7,p.y-8);ctx.lineTo(x+7,p.y-8);ctx.closePath();ctx.fill();ctx.strokeStyle=A.style.centerColor;ctx.globalAlpha=.45;ctx.beginPath();ctx.moveTo(x,p.y);ctx.lineTo(x,p.y+p.h);ctx.stroke();ctx.globalAlpha=1;}}
ctx.strokeStyle=A.style.frameColor;ctx.strokeRect(p.x,p.y,p.w,p.h);canvas.__histMeta={plot:p,lo,hi,bins,counts:cnt,cumulative:cum,total:clean.length,bw,tooltipId:opts.tooltipId,selected:null,ymax:ym};return s;};
A.handleHistogramClick=(canvas,e)=>{const m=canvas.__histMeta;if(!m)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left;if(x<m.plot.x||x>m.plot.x+m.plot.w)return;const i=A.clamp(Math.floor((x-m.plot.x)/m.plot.w*m.bins),0,m.bins-1),el=A.$(m.tooltipId);if(m.selected===i){m.selected=null;el.classList.add("hidden");return;}m.selected=i;const low=10**(m.lo+i*m.bw),high=10**(m.lo+(i+1)*m.bw),l=m.counts[i],cum=m.cumulative[i],N=m.total,p1=l/N,p2=cum/N,bx=m.plot.x+(i+.5)*m.plot.w/m.bins,by=m.plot.y+m.plot.h*(1-l/m.ymax);placeTooltip(el,bx,by,`<strong>範囲：${A.numberLabel(low)} ～ ${A.numberLabel(high)}</strong><br>該当本数：${l.toLocaleString()} (${A.percentDisplay(p1)}) / ${cum.toLocaleString()} (${A.percentDisplay(p2)}) / ${N.toLocaleString()} 本`,canvas.parentElement);};
})();
