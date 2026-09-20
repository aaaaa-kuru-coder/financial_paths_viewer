"use strict";
window.SimApp = window.SimApp || {};

(() => {
  const A=window.SimApp;
  A.$=id=>{
    const el=document.getElementById(id);
    if(!el) throw new Error(`UI element not found: #${id}. index.html とJavaScriptのバージョンを確認してください。`);
    return el;
  };

  A.fmt=new Intl.NumberFormat("ja-JP",{maximumFractionDigits:2});
  A.fmt0=new Intl.NumberFormat("ja-JP",{maximumFractionDigits:0});
  A.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  A.quantile=(sorted,q)=>{
    if(!sorted.length)return NaN;
    const pos=(sorted.length-1)*q,base=Math.floor(pos),rest=pos-base;
    return sorted[base+1]!==undefined?sorted[base]+rest*(sorted[base+1]-sorted[base]):sorted[base];
  };
  A.mean=arr=>{let s=0,n=0;for(const v of arr){if(Number.isFinite(v)){s+=v;n++;}}return n?s/n:NaN;};

  A.getConfidence=()=>{
    const raw=Number(A.$("confidenceLevel").value);
    const level=A.clamp(Number.isFinite(raw)?raw:90,50,99.9);
    A.$("confidenceLevel").value=level;
    const tail=(1-level/100)/2;
    return {level,lowerQ:tail,upperQ:1-tail};
  };

  A.summarize=(arr,lowerQ=.05,upperQ=.95)=>{
    const a=arr.filter(Number.isFinite).slice().sort((x,y)=>x-y);
    return {n:a.length,min:a[0],lower:A.quantile(a,lowerQ),p25:A.quantile(a,.25),
      median:A.quantile(a,.5),mean:A.mean(a),p75:A.quantile(a,.75),
      upper:A.quantile(a,upperQ),max:a[a.length-1]};
  };

  A.numberLabel=v=>{
    if(!Number.isFinite(v))return "—";
    const av=Math.abs(v);
    if(av>=100) return Math.round(v).toLocaleString("ja-JP");
    if(av>=1) return Number(v.toFixed(2)).toLocaleString("ja-JP");
    return Number(v.toPrecision(3)).toLocaleString("ja-JP");
  };

  A.setMessage=(msg,isErr=false)=>{
    const el=A.$("message");el.textContent=msg;el.className=isErr?"note error":"note";
  };

  A.resizeCanvas=canvas=>{
    const dpr=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect();
    const w=Math.max(320,Math.floor(rect.width)),h=Math.max(220,Math.floor(rect.height));
    const rw=Math.floor(w*dpr),rh=Math.floor(h*dpr);
    if(canvas.width!==rw||canvas.height!==rh){canvas.width=rw;canvas.height=rh;}
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w,h};
  };

  A.stepIndexFromInput=id=>{
    const last=A.state.steps.length-1;
    return A.clamp(Math.round(Number(A.$(id).value)||0),0,last);
  };

  A.symlog=(v,lin=window.CONFIG.symlogLinearThreshold)=>Number.isFinite(v)?Math.sign(v)*Math.log10(1+Math.abs(v)/lin):NaN;
  A.invSymlog=(y,lin=window.CONFIG.symlogLinearThreshold)=>Number.isFinite(y)?Math.sign(y)*lin*(10**Math.abs(y)-1):NaN;

  A.makeSelectedPathIndices=(centerOneBased,neighbors,total)=>{
    const center=A.clamp(Math.round(centerOneBased)-1,0,total-1);
    const n=A.clamp(Math.round(neighbors)||0,0,window.CONFIG.maxNeighborPathsPerSide);
    const lo=Math.max(0,center-n),hi=Math.min(total-1,center+n),ids=[];
    for(let i=lo;i<=hi;i++)ids.push(i);
    return {center,lo,hi,ids,neighbors:n};
  };

  A.hexToRgb=hex=>{
    const h=hex.replace("#","");
    const n=parseInt(h.length===3?h.split("").map(x=>x+x).join(""):h,16);
    return [(n>>16)&255,(n>>8)&255,n&255];
  };
  A.rgba=(hex,alpha)=>{
    const [r,g,b]=A.hexToRgb(hex);return `rgba(${r},${g},${b},${A.clamp(alpha,0,1)})`;
  };

  A.pathStyle=(idx,sel)=>{
    const S=A.style;
    if(idx===sel.center)return {color:S.centerColor,alpha:1,width:S.centerWidth};
    const dist=Math.abs(idx-sel.center);
    const maxDist=idx<sel.center?Math.max(1,sel.center-sel.lo):Math.max(1,sel.hi-sel.center);
    const t=maxDist<=1?0:(dist-1)/(maxDist-1);
    const alpha=S.neighborAlpha1+(S.neighborAlpha2-S.neighborAlpha1)*A.clamp(t,0,1);
    return {color:idx<sel.center?S.beforeColor:S.afterColor,alpha,width:S.neighborWidth};
  };

  A.percentLabel=q=>{
    const pct=q*100;
    return `P${Number.isInteger(pct)?pct:pct.toFixed(2).replace(/0+$/,"").replace(/\.$/,"")}`;
  };

  A.loadJsonStorage=(key,fallback)=>{
    try{
      const raw=localStorage.getItem(key);
      if(!raw)return structuredClone(fallback);
      return {...structuredClone(fallback),...JSON.parse(raw)};
    }catch{return structuredClone(fallback);}
  };
  A.saveJsonStorage=(key,obj)=>{
    try{localStorage.setItem(key,JSON.stringify(obj));}catch(e){console.warn("localStorage save failed",e);}
  };

  A.style=A.loadJsonStorage(window.CONFIG.styleStorageKey,window.DEFAULT_STYLE);
})();
