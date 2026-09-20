"use strict";
(() => {
  const A=window.SimApp;

  function scanScale(arrays,mode,domainOriginal){
    let lo=Infinity,hi=-Infinity,count=0;
    const transform=mode==="log"?(v=>v>0?Math.log10(v):NaN):mode==="symlog"?(v=>A.symlog(v)):(v=>v);
    for(const arr of arrays)for(const v of arr){
      const t=transform(v);if(Number.isFinite(t)){count++;if(t<lo)lo=t;if(t>hi)hi=t;}
    }
    if(domainOriginal){
      if(Number.isFinite(domainOriginal.min)){
        const t=transform(domainOriginal.min);if(Number.isFinite(t))lo=t;
      }
      if(Number.isFinite(domainOriginal.max)){
        const t=transform(domainOriginal.max);if(Number.isFinite(t))hi=t;
      }
    }
    if(!count||!Number.isFinite(lo)||!Number.isFinite(hi))return null;
    if(lo===hi){lo-=.05;hi+=.05;}
    const pad=(hi-lo)*.035||.05;
    return {mode,min:lo-pad,max:hi+pad,transform};
  }

  function logTicks(scale){
    const out=[];const p0=Math.floor(scale.min),p1=Math.ceil(scale.max);
    for(let p=p0;p<=p1;p++){
      for(const m of [1,2,4,6,8]){
        const value=m*10**p,t=Math.log10(value);
        if(t>=scale.min&&t<=scale.max)out.push({t,value,major:m===1});
      }
    }
    return out.sort((a,b)=>a.t-b.t);
  }

  function symlogTicks(scale){
    const out=[{t:0,value:0,major:true}];
    const maxAbs=Math.max(Math.abs(A.invSymlog(scale.min)),Math.abs(A.invSymlog(scale.max)));
    const pmax=Math.ceil(Math.log10(Math.max(1,maxAbs)));
    for(let p=0;p<=pmax;p++)for(const m of [1,2,4,6,8])for(const sign of [-1,1]){
      const value=sign*m*10**p,t=A.symlog(value);
      if(t>=scale.min&&t<=scale.max)out.push({t,value,major:m===1});
    }
    return out.sort((a,b)=>a.t-b.t);
  }

  function yPx(scale,v,plot){
    const t=scale.transform(v);return Number.isFinite(t)?plot.y+plot.h*(1-(t-scale.min)/(scale.max-scale.min)):NaN;
  }

  function drawYAxis(ctx,plot,scale){
    const ticks=scale.mode==="log"?logTicks(scale):scale.mode==="symlog"?symlogTicks(scale):[];
    for(const tk of ticks){
      const yy=plot.y+plot.h*(1-(tk.t-scale.min)/(scale.max-scale.min));
      ctx.strokeStyle=tk.major?A.style.gridColor:"rgba(80,90,108,.30)";
      ctx.lineWidth=tk.major?1:.65;ctx.beginPath();ctx.moveTo(plot.x,yy);ctx.lineTo(plot.x+plot.w,yy);ctx.stroke();
      if(tk.major){
        ctx.fillStyle=A.style.axisColor;ctx.font="11px system-ui";ctx.textAlign="right";ctx.textBaseline="middle";
        ctx.fillText(A.numberLabel(tk.value),plot.x-8,yy);
      }
    }
  }

  function drawXAxis(ctx,plot,xLabels){
    const n=xLabels.length,marks=5;
    ctx.font="11px system-ui";
    for(let k=0;k<=marks;k++){
      const idx=Math.round(k*(n-1)/marks),xx=plot.x+plot.w*(idx/Math.max(1,n-1));
      ctx.strokeStyle=A.style.gridColor;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xx,plot.y);ctx.lineTo(xx,plot.y+plot.h);ctx.stroke();
      const txt=String(xLabels[idx]??idx);
      ctx.save();ctx.translate(xx,plot.y+plot.h+9);ctx.rotate(-Math.PI/2);
      ctx.fillStyle=A.style.axisColor;ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText(txt,0,0);ctx.restore();
    }
  }

  A.drawPathChart=(canvas,seriesList,opts={})=>{
    const {ctx,w,h}=A.resizeCanvas(canvas);ctx.clearRect(0,0,w,h);
    const p=window.CONFIG.chartPadding,plot={x:p.left,y:p.top,w:w-p.left-p.right,h:h-p.top-p.bottom};
    const arrays=seriesList.map(s=>s.values);
    if(opts.band)arrays.push(opts.band.lower,opts.band.upper);
    if(opts.median)arrays.push(opts.median);if(opts.mean)arrays.push(opts.mean);if(opts.reference)arrays.push(opts.reference);

    let mode=opts.scaleMode||"log";
    if(mode==="log"){
      let nonPositive=false;outer:for(const arr of arrays)for(const v of arr){if(Number.isFinite(v)&&v<=0){nonPositive=true;break outer;}}
      if(nonPositive)mode="symlog";
    }
    const scale=scanScale(arrays,mode,opts.domainOriginal);if(!scale)return;

    drawYAxis(ctx,plot,scale);drawXAxis(ctx,plot,opts.xValues||seriesList[0]?.values.map((_,i)=>i)||[]);

    ctx.save();ctx.beginPath();ctx.rect(plot.x,plot.y,plot.w,plot.h);ctx.clip();

    if(opts.band){
      const n=opts.band.lower.length;ctx.beginPath();let started=false;
      for(let i=0;i<n;i++){const x=plot.x+plot.w*i/Math.max(1,n-1),y=yPx(scale,opts.band.upper[i],plot);if(!Number.isFinite(y))continue;if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);}
      for(let i=n-1;i>=0;i--){const x=plot.x+plot.w*i/Math.max(1,n-1),y=yPx(scale,opts.band.lower[i],plot);if(Number.isFinite(y))ctx.lineTo(x,y);}
      ctx.closePath();ctx.fillStyle=A.rgba(A.style.ciColor,A.style.ciAlpha);ctx.fill();
      for(const vals of [opts.band.lower,opts.band.upper]){
        ctx.beginPath();started=false;
        for(let i=0;i<n;i++){const x=plot.x+plot.w*i/Math.max(1,n-1),y=yPx(scale,vals[i],plot);if(!Number.isFinite(y))continue;if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);}
        ctx.strokeStyle=A.rgba(A.style.ciColor,Math.min(1,A.style.ciAlpha+.45));ctx.lineWidth=1.1;ctx.stroke();
      }
    }

    for(const s of seriesList){
      ctx.beginPath();let started=false;
      for(let i=0;i<s.values.length;i++){
        const y=yPx(scale,s.values[i],plot);if(!Number.isFinite(y)){started=false;continue;}
        const x=plot.x+plot.w*i/Math.max(1,s.values.length-1);if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=s.color;ctx.globalAlpha=s.alpha??.5;ctx.lineWidth=s.width??1;ctx.stroke();ctx.globalAlpha=1;
    }

    const ref=(vals,color,width,dash=[])=>{
      if(!vals)return;ctx.beginPath();let started=false;
      for(let i=0;i<vals.length;i++){const y=yPx(scale,vals[i],plot);if(!Number.isFinite(y)){started=false;continue;}const x=plot.x+plot.w*i/Math.max(1,vals.length-1);if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);}
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
    };
    if(opts.reference)ref(opts.reference,"#c9a55a",1.5,[5,4]);
    if(opts.median)ref(opts.median,A.style.medianColor,A.style.medianWidth);
    if(opts.mean)ref(opts.mean,A.style.meanColor,A.style.meanWidth,[7,4]);
    ctx.restore();

    ctx.strokeStyle=A.style.frameColor;ctx.lineWidth=1;ctx.strokeRect(plot.x,plot.y,plot.w,plot.h);
    if(opts.yLabel){ctx.save();ctx.translate(16,plot.y+plot.h/2);ctx.rotate(-Math.PI/2);ctx.fillStyle=A.style.axisColor;ctx.textAlign="center";ctx.fillText(opts.yLabel,0,0);ctx.restore();}
  };

  A.drawLogHistogram=(canvas,values,opts={})=>{
    const clean=values.filter(v=>Number.isFinite(v)&&v>0);if(!clean.length)return null;
    const {lowerQ,upperQ}=A.getConfidence(),s=A.summarize(clean,lowerQ,upperQ),logs=clean.map(Math.log10);
    let lo=Infinity,hi=-Infinity;for(const x of logs){if(x<lo)lo=x;if(x>hi)hi=x;}if(lo===hi){lo-=.05;hi+=.05;}
    const bins=A.clamp(opts.bins||window.CONFIG.histogramBins,10,100),counts=Array(bins).fill(0),bw=(hi-lo)/bins;
    for(const x of logs){let b=Math.floor((x-lo)/bw);if(b===bins)b--;counts[A.clamp(b,0,bins-1)]++;}
    const cumulative=[];let cs=0;for(const c of counts){cs+=c;cumulative.push(cs);}

    const {ctx,w,h}=A.resizeCanvas(canvas);ctx.clearRect(0,0,w,h);
    const p=window.CONFIG.chartPadding,plot={x:p.left,y:p.top,w:w-p.left-p.right,h:h-p.top-p.bottom},ymax=Math.max(...counts)*1.08||1;
    ctx.font="11px system-ui";
    for(let k=0;k<=5;k++){
      const c=Math.round(ymax*k/5),yy=plot.y+plot.h*(1-k/5);ctx.strokeStyle=A.style.gridColor;ctx.beginPath();ctx.moveTo(plot.x,yy);ctx.lineTo(plot.x+plot.w,yy);ctx.stroke();
      ctx.fillStyle=A.style.axisColor;ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText(c.toLocaleString("ja-JP"),plot.x-8,yy);
    }

    for(const tk of logTicks({min:lo,max:hi})){
      const xx=plot.x+plot.w*(tk.t-lo)/(hi-lo);ctx.strokeStyle=tk.major?A.style.gridColor:"rgba(80,90,108,.30)";
      ctx.lineWidth=tk.major?1:.65;ctx.beginPath();ctx.moveTo(xx,plot.y);ctx.lineTo(xx,plot.y+plot.h);ctx.stroke();
      if(tk.major){
        ctx.save();ctx.translate(xx,plot.y+plot.h+9);ctx.rotate(-Math.PI/2);ctx.fillStyle=A.style.axisColor;ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText(A.numberLabel(tk.value),0,0);ctx.restore();
      }
    }

    const barW=plot.w/bins;
    for(let i=0;i<bins;i++){const bh=plot.h*counts[i]/ymax;ctx.fillStyle="#5077c8";ctx.fillRect(plot.x+i*barW+1,plot.y+plot.h-bh,Math.max(1,barW-2),bh);}

    const marker=(value,color,width,dash=[])=>{
      const xlog=Math.log10(value),xx=plot.x+plot.w*(xlog-lo)/(hi-lo);if(xx<plot.x||xx>plot.x+plot.w)return;
      ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(xx,plot.y);ctx.lineTo(xx,plot.y+plot.h);ctx.stroke();ctx.restore();
    };
    marker(s.lower,A.rgba(A.style.ciColor,.9),1.8,[5,4]);marker(s.upper,A.rgba(A.style.ciColor,.9),1.8,[5,4]);
    if(opts.showMedian)marker(s.median,A.style.medianColor,A.style.medianWidth);
    if(opts.showMean)marker(s.mean,A.style.meanColor,A.style.meanWidth,[7,4]);

    ctx.strokeStyle=A.style.frameColor;ctx.strokeRect(plot.x,plot.y,plot.w,plot.h);

    canvas.__histMeta={plot,lo,hi,bins,counts,cumulative,total:clean.length,binWidthLog:bw,selectedBin:null,infoElementId:opts.infoElementId};
    canvas.style.cursor="pointer";
    return s;
  };

  A.handleHistogramClick=(canvas,event)=>{
    const m=canvas.__histMeta;if(!m)return;
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left;
    if(x<m.plot.x||x>m.plot.x+m.plot.w)return;
    const idx=A.clamp(Math.floor((x-m.plot.x)/m.plot.w*m.bins),0,m.bins-1);
    const info=A.$(m.infoElementId);
    if(m.selectedBin===idx){m.selectedBin=null;info.classList.add("hidden");info.innerHTML="";return;}
    m.selectedBin=idx;
    const low=10**(m.lo+idx*m.binWidthLog),high=10**(m.lo+(idx+1)*m.binWidthLog);
    const l=m.counts[idx],cum=m.cumulative[idx],N=m.total;
    info.innerHTML=`<strong>範囲: ${A.numberLabel(low)} ～ ${A.numberLabel(high)}</strong><br>`+
      `該当本数: ${l.toLocaleString("ja-JP")} (${(100*l/N).toFixed(2)}%) / `+
      `${cum.toLocaleString("ja-JP")} (${(100*cum/N).toFixed(2)}%) / ${N.toLocaleString("ja-JP")} 本`+
      `<div class="muted">中央の値は「このビン以下の累積本数」で、経験パーセンタイルに相当します。もう一度同じビンをクリックすると閉じます。</div>`;
    info.classList.remove("hidden");
  };
})();
