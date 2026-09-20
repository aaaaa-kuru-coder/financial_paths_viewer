"use strict";

(() => {
  const A=window.SimApp;
  const C=window.CONFIG.colors;

  function buildScale(values, mode){
    let count=0, lo=Infinity, hi=-Infinity;

    if(mode==="log"){
      for(const v of values){
        if(Number.isFinite(v) && v>0){
          count++;
          const t=Math.log10(v);
          if(t<lo)lo=t;
          if(t>hi)hi=t;
        }
      }
      if(!count) return null;
      if(lo===hi){lo-=.05;hi+=.05;}
      const pad=(hi-lo)*.05 || .08;
      return {
        mode,
        min:lo-pad,max:hi+pad,
        transform:v=>v>0?Math.log10(v):NaN,
        inverse:y=>10**y
      };
    }

    if(mode==="symlog"){
      for(const v of values){
        if(Number.isFinite(v)){
          count++;
          const t=A.symlog(v);
          if(t<lo)lo=t;
          if(t>hi)hi=t;
        }
      }
      if(!count) return null;
      if(lo===hi){lo-=.1;hi+=.1;}
      const pad=(hi-lo)*.05 || .08;
      return {
        mode,
        min:lo-pad,max:hi+pad,
        transform:v=>A.symlog(v),
        inverse:y=>A.invSymlog(y)
      };
    }

    for(const v of values){
      if(Number.isFinite(v)){
        count++;
        if(v<lo)lo=v;
        if(v>hi)hi=v;
      }
    }
    if(!count) return null;
    if(lo===hi){lo-=1;hi+=1;}
    const pad=(hi-lo)*.05 || 1;
    return {mode:"linear",min:lo-pad,max:hi+pad,transform:v=>v,inverse:y=>y};
  }

  function logTicks(scale){
    const ticks=[];
    const p0=Math.floor(scale.min), p1=Math.ceil(scale.max);
    for(let p=p0;p<=p1;p++){
      const major=10**p;
      const t=Math.log10(major);
      if(t>=scale.min&&t<=scale.max) ticks.push({t,value:major,major:true});
      for(const m of [2,5]){
        const value=m*10**p;
        const tt=Math.log10(value);
        if(tt>=scale.min&&tt<=scale.max) ticks.push({t:tt,value,major:false});
      }
    }
    return ticks.sort((a,b)=>a.t-b.t);
  }

  function symlogTicks(scale){
    const ticks=[{t:0,value:0,major:true}];
    const maxAbs=Math.max(Math.abs(A.invSymlog(scale.min)),Math.abs(A.invSymlog(scale.max)));
    if(maxAbs<=0) return ticks;
    const pmax=Math.ceil(Math.log10(Math.max(1,maxAbs)));
    for(let p=0;p<=pmax;p++){
      const base=10**p;
      for(const mult of [1,2,5]){
        const v=base*mult;
        for(const sign of [-1,1]){
          const value=sign*v;
          const t=A.symlog(value);
          if(t>=scale.min&&t<=scale.max) ticks.push({t,value,major:mult===1});
        }
      }
    }
    return ticks.sort((a,b)=>a.t-b.t);
  }

  function transformedY(scale,v,plot){
    const t=scale.transform(v);
    if(!Number.isFinite(t)) return NaN;
    return plot.y+plot.h*(1-(t-scale.min)/(scale.max-scale.min));
  }

  function drawAxes(ctx,plot,scale,xLabels){
    ctx.font="11px system-ui";
    const ticks=scale.mode==="log"?logTicks(scale):
      scale.mode==="symlog"?symlogTicks(scale):[];

    for(const tk of ticks){
      const yy=plot.y+plot.h*(1-(tk.t-scale.min)/(scale.max-scale.min));
      ctx.strokeStyle=tk.major?C.grid:"rgba(42,49,61,.42)";
      ctx.lineWidth=tk.major?1:.6;
      ctx.beginPath();ctx.moveTo(plot.x,yy);ctx.lineTo(plot.x+plot.w,yy);ctx.stroke();
      if(tk.major){
        ctx.fillStyle=C.axis;
        ctx.textAlign="right";ctx.textBaseline="middle";
        ctx.fillText(A.axisFormat(tk.value),plot.x-8,yy);
      }
    }

    const n=xLabels.length;
    const xticks=5;
    ctx.textAlign="center";ctx.textBaseline="top";
    for(let k=0;k<=xticks;k++){
      const idx=Math.round(k*(n-1)/xticks);
      const xx=plot.x+plot.w*(idx/Math.max(1,n-1));
      ctx.strokeStyle=C.grid;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(xx,plot.y);ctx.lineTo(xx,plot.y+plot.h);ctx.stroke();
      ctx.fillStyle=C.axis;
      ctx.fillText(String(xLabels[idx]??idx),xx,plot.y+plot.h+8);
    }
  }

  A.drawPathChart = (canvas, seriesList, opts={}) => {
    const {ctx,w,h}=A.resizeCanvas(canvas);
    ctx.clearRect(0,0,w,h);
    const p=window.CONFIG.chartPadding;
    const plot={x:p.left,y:p.top,w:w-p.left-p.right,h:h-p.top-p.bottom};

    // 大規模CSVでも spread(...) で引数上限に達しないよう、配列を平坦化しない。
    const valueArrays = seriesList.map(s=>s.values);
    if(opts.band){ valueArrays.push(opts.band.lower, opts.band.upper); }
    if(opts.median) valueArrays.push(opts.median);
    if(opts.mean) valueArrays.push(opts.mean);
    if(opts.reference) valueArrays.push(opts.reference);

    let hasNonPositive=false;
    const scaleProbe=[];
    for(const arr of valueArrays){
      for(const v of arr){
        if(!Number.isFinite(v)) continue;
        if(v<=0) hasNonPositive=true;
        scaleProbe.push(v);
      }
    }

    let mode=opts.scaleMode||"log";
    if(mode==="log" && hasNonPositive) mode="symlog";
    const scale=buildScale(scaleProbe,mode);
    if(!scale) return;

    const xLabels=opts.xValues||seriesList[0]?.values.map((_,i)=>i)||[];
    drawAxes(ctx,plot,scale,xLabels);

    // Confidence band
    if(opts.band){
      ctx.save();
      ctx.beginPath();ctx.rect(plot.x,plot.y,plot.w,plot.h);ctx.clip();
      const n=opts.band.lower.length;
      ctx.beginPath();
      for(let i=0;i<n;i++){
        const x=plot.x+plot.w*(i/Math.max(1,n-1));
        const y=transformedY(scale,opts.band.upper[i],plot);
        if(!Number.isFinite(y)) continue;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      for(let i=n-1;i>=0;i--){
        const x=plot.x+plot.w*(i/Math.max(1,n-1));
        const y=transformedY(scale,opts.band.lower[i],plot);
        if(Number.isFinite(y))ctx.lineTo(x,y);
      }
      ctx.closePath();
      ctx.fillStyle=C.ciFill;ctx.fill();

      for(const vals of [opts.band.lower,opts.band.upper]){
        ctx.beginPath();
        for(let i=0;i<n;i++){
          const x=plot.x+plot.w*(i/Math.max(1,n-1));
          const y=transformedY(scale,vals[i],plot);
          if(!Number.isFinite(y))continue;
          if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.strokeStyle=C.ciEdge;ctx.lineWidth=1.2;ctx.stroke();
      }
      ctx.restore();
    }

    // Selected paths
    ctx.save();
    ctx.beginPath();ctx.rect(plot.x,plot.y,plot.w,plot.h);ctx.clip();
    for(const s of seriesList){
      ctx.beginPath();
      let started=false;
      for(let i=0;i<s.values.length;i++){
        const y=transformedY(scale,s.values[i],plot);
        if(!Number.isFinite(y)){started=false;continue;}
        const x=plot.x+plot.w*(i/Math.max(1,s.values.length-1));
        if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=s.color;ctx.globalAlpha=s.alpha??.5;
      ctx.lineWidth=s.width??1.1;ctx.stroke();
    }
    ctx.restore();ctx.globalAlpha=1;

    function drawReference(vals,color,width,dash=[]){
      if(!vals) return;
      ctx.save();ctx.beginPath();ctx.rect(plot.x,plot.y,plot.w,plot.h);ctx.clip();
      ctx.beginPath();let started=false;
      for(let i=0;i<vals.length;i++){
        const y=transformedY(scale,vals[i],plot);
        if(!Number.isFinite(y)){started=false;continue;}
        const x=plot.x+plot.w*(i/Math.max(1,vals.length-1));
        if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();
      ctx.restore();ctx.setLineDash([]);
    }

    if(opts.reference) drawReference(opts.reference,"#c8a45a",1.6,[5,4]);
    if(opts.median) drawReference(opts.median,C.median,2.0);
    if(opts.mean) drawReference(opts.mean,C.mean,2.0,[7,4]);

    ctx.strokeStyle=C.frame;ctx.lineWidth=1;
    ctx.strokeRect(plot.x,plot.y,plot.w,plot.h);

    if(opts.yLabel){
      ctx.save();ctx.translate(16,plot.y+plot.h/2);ctx.rotate(-Math.PI/2);
      ctx.fillStyle=C.axis;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(opts.yLabel,0,0);ctx.restore();
    }
  };

  A.drawLogHistogram = (canvas, values, opts={}) => {
    const clean=values.filter(v=>Number.isFinite(v)&&v>0);
    if(!clean.length) return;

    const {lowerQ,upperQ}=A.getConfidence();
    const s=A.summarize(clean,lowerQ,upperQ);
    const logVals=clean.map(v=>Math.log10(v));
    let lo=Infinity,hi=-Infinity;
    for(const x of logVals){ if(x<lo)lo=x; if(x>hi)hi=x; }
    if(lo===hi){lo-=.05;hi+=.05;}
    const bins=A.clamp(opts.bins||window.CONFIG.histogramBins,10,100);
    const counts=Array(bins).fill(0);
    const bw=(hi-lo)/bins;

    for(const x of logVals){
      let b=Math.floor((x-lo)/bw);
      if(b===bins)b=bins-1;
      counts[A.clamp(b,0,bins-1)]++;
    }

    const {ctx,w,h}=A.resizeCanvas(canvas);
    ctx.clearRect(0,0,w,h);
    const p=window.CONFIG.chartPadding;
    const plot={x:p.left,y:p.top,w:w-p.left-p.right,h:h-p.top-p.bottom};
    const ymax=Math.max(...counts)*1.08 || 1;

    // horizontal count grid
    const steps=5;
    ctx.font="11px system-ui";
    for(let k=0;k<=steps;k++){
      const count=Math.round(ymax*k/steps);
      const yy=plot.y+plot.h*(1-k/steps);
      ctx.strokeStyle=C.grid;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(plot.x,yy);ctx.lineTo(plot.x+plot.w,yy);ctx.stroke();
      ctx.fillStyle=C.axis;ctx.textAlign="right";ctx.textBaseline="middle";
      ctx.fillText(String(count),plot.x-8,yy);
    }

    // x log ticks
    const scale={mode:"log",min:lo,max:hi};
    for(const tk of logTicks(scale)){
      const xx=plot.x+plot.w*((tk.t-lo)/(hi-lo));
      ctx.strokeStyle=tk.major?C.grid:"rgba(42,49,61,.36)";
      ctx.beginPath();ctx.moveTo(xx,plot.y);ctx.lineTo(xx,plot.y+plot.h);ctx.stroke();
      if(tk.major){
        ctx.fillStyle=C.axis;ctx.textAlign="center";ctx.textBaseline="top";
        ctx.fillText(A.axisFormat(tk.value),xx,plot.y+plot.h+8);
      }
    }

    const barW=plot.w/bins;
    for(let i=0;i<bins;i++){
      const bh=plot.h*(counts[i]/ymax);
      ctx.fillStyle="#5077c8";
      ctx.fillRect(plot.x+i*barW+1,plot.y+plot.h-bh,Math.max(1,barW-2),bh);
    }

    const marker=(value,color,width,dash=[])=>{
      if(!(value>0))return;
      const xlog=Math.log10(value);
      const xx=plot.x+plot.w*((xlog-lo)/(hi-lo));
      if(xx<plot.x||xx>plot.x+plot.w)return;
      ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);
      ctx.beginPath();ctx.moveTo(xx,plot.y);ctx.lineTo(xx,plot.y+plot.h);ctx.stroke();
      ctx.restore();
    };

    marker(s.lower,C.ciEdge,1.8,[5,4]);
    marker(s.upper,C.ciEdge,1.8,[5,4]);
    if(opts.showMedian) marker(s.median,C.median,2.1);
    if(opts.showMean) marker(s.mean,C.mean,2.1,[7,4]);

    ctx.strokeStyle=C.frame;ctx.lineWidth=1;ctx.strokeRect(plot.x,plot.y,plot.w,plot.h);
    if(opts.xLabel){
      ctx.fillStyle=C.axis;ctx.textAlign="center";ctx.textBaseline="alphabetic";
      ctx.fillText(opts.xLabel,plot.x+plot.w/2,h-12);
    }
    return s;
  };
})();
