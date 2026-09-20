"use strict";

window.SimApp = window.SimApp || {};

(() => {
  const A = window.SimApp;
  A.$ = id => document.getElementById(id);
  A.fmt = new Intl.NumberFormat("ja-JP", {maximumFractionDigits: 2});
  A.fmt0 = new Intl.NumberFormat("ja-JP", {maximumFractionDigits: 0});

  A.clamp = (v,a,b) => Math.max(a,Math.min(b,v));

  A.quantile = (sorted, q) => {
    if(!sorted.length) return NaN;
    const pos=(sorted.length-1)*q;
    const base=Math.floor(pos), rest=pos-base;
    return sorted[base+1] !== undefined
      ? sorted[base] + rest*(sorted[base+1]-sorted[base])
      : sorted[base];
  };

  A.mean = arr => {
    let s=0,n=0;
    for(const v of arr){ if(Number.isFinite(v)){s+=v;n++;} }
    return n ? s/n : NaN;
  };

  A.getConfidence = () => {
    const raw = Number(A.$("confidenceLevel").value);
    const level = A.clamp(Number.isFinite(raw) ? raw : 90, 50, 99.9);
    A.$("confidenceLevel").value = level;
    const tail = (1 - level/100) / 2;
    return {level, lowerQ:tail, upperQ:1-tail};
  };

  A.summarize = (arr, lowerQ=.05, upperQ=.95) => {
    const a = arr.filter(Number.isFinite).slice().sort((x,y)=>x-y);
    const mean = A.mean(a);
    return {
      n:a.length,
      min:a[0],
      lower:A.quantile(a,lowerQ),
      p25:A.quantile(a,.25),
      median:A.quantile(a,.5),
      mean,
      p75:A.quantile(a,.75),
      upper:A.quantile(a,upperQ),
      max:a[a.length-1]
    };
  };

  A.axisFormat = v => {
    if(!Number.isFinite(v)) return "—";
    const av=Math.abs(v);
    if(av>=1e12) return (v/1e12).toFixed(1)+"T";
    if(av>=1e9) return (v/1e9).toFixed(1)+"B";
    if(av>=1e6) return (v/1e6).toFixed(1)+"M";
    if(av>=1e3) return (v/1e3).toFixed(1)+"k";
    if(av>=10) return A.fmt0.format(v);
    if(av>=1) return A.fmt.format(v);
    return v.toPrecision(2);
  };

  A.setMessage = (msg,isErr=false) => {
    const el=A.$("message");
    el.textContent=msg;
    el.className=isErr ? "note error" : "note";
  };

  A.resizeCanvas = canvas => {
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(320,Math.floor(rect.width));
    const h=Math.max(220,Math.floor(rect.height));
    const rw=Math.floor(w*dpr), rh=Math.floor(h*dpr);
    if(canvas.width!==rw || canvas.height!==rh){
      canvas.width=rw; canvas.height=rh;
    }
    const ctx=canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return {ctx,w,h};
  };

  A.stepIndexFromInput = id => {
    const last=A.state.steps.length-1;
    return A.clamp(Math.round(Number(A.$(id).value)||0),0,last);
  };

  A.transformLog10 = v => v>0 ? Math.log10(v) : NaN;
  A.inverseLog10 = y => 10**y;

  A.symlog = (v, lin=window.CONFIG.symlogLinearThreshold) => {
    if(!Number.isFinite(v)) return NaN;
    return Math.sign(v) * Math.log10(1 + Math.abs(v)/lin);
  };
  A.invSymlog = (y, lin=window.CONFIG.symlogLinearThreshold) => {
    if(!Number.isFinite(y)) return NaN;
    return Math.sign(y) * lin * (10**Math.abs(y)-1);
  };

  A.makeSelectedPathIndices = (centerOneBased, before, after, total) => {
    const center = A.clamp(Math.round(centerOneBased)-1,0,total-1);
    const b = A.clamp(Math.round(before)||0,0,window.CONFIG.maxNeighborPathsPerSide);
    const a = A.clamp(Math.round(after)||0,0,window.CONFIG.maxNeighborPathsPerSide);
    const lo=Math.max(0,center-b), hi=Math.min(total-1,center+a);
    const ids=[];
    for(let i=lo;i<=hi;i++) ids.push(i);
    return {center,lo,hi,ids};
  };

  A.pathColor = (idx, center, lo, hi) => {
    const C=window.CONFIG.colors;
    if(idx===center) return {color:C.center, alpha:1, width:3.1};
    if(idx<center){
      const maxDist=Math.max(1,center-lo);
      const d=center-idx;
      const closeness=1-(d-1)/maxDist;
      const alpha=.18 + .58*closeness;
      return {color:`rgb(${C.before.join(",")})`,alpha,width:1.15};
    }
    const maxDist=Math.max(1,hi-center);
    const d=idx-center;
    const closeness=1-(d-1)/maxDist;
    const alpha=.18 + .58*closeness;
    return {color:`rgb(${C.after.join(",")})`,alpha,width:1.15};
  };

  A.percentLabel = q => {
    const pct=q*100;
    return Number.isInteger(pct) ? `P${pct}` : `P${pct.toFixed(2).replace(/0+$/,"").replace(/\.$/,"")}`;
  };
})();
