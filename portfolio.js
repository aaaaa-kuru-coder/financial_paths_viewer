"use strict";

(() => {
  const A=window.SimApp;

  A.runPortfolio = () => {
    if(!A.ensureData()) return;
    const initial=Math.max(0,Number(A.$("initialAmount").value)||0);
    const interval=Math.max(1,Math.round(Number(A.$("intervalDays").value)||21));
    const recur=Math.max(0,Number(A.$("recurringAmount").value)||0);
    const firstNow=A.$("firstRecurring").value==="now";

    if(initial===0 && recur===0){
      A.setMessage("頭金と積立額が両方0では資産推移を計算できません。",true);
      return;
    }

    const T=A.state.steps.length;
    const principalByStep=new Float64Array(T);
    let principal=initial;
    for(let t=0;t<T;t++){
      const recurringToday=firstNow ? (t%interval===0) : (t>0&&t%interval===0);
      if(recurringToday) principal+=recur;
      principalByStep[t]=principal;
    }

    A.state.portfolio={
      principalByStep,initial,interval,recur,firstNow,
      summaryCache:new Map()
    };

    A.$("portfolioAssumption").textContent=
      `頭金 ${A.fmt0.format(initial)}、${interval} stepごとに ${A.fmt0.format(recur)} を積立。`+
      (firstNow?"step 0にも積立額を追加。":`最初の積立は step ${interval}。`);

    A.drawPortfolioPaths();
    A.drawPortfolioHistogram();
    A.refreshCheckpointTable();
  };

  A.portfolioPath = path => {
    const cfg=A.state.portfolio;
    const T=path.length;
    const out=new Float64Array(T);
    let units=cfg.initial/path[0];
    if(cfg.firstNow) units+=cfg.recur/path[0];
    out[0]=units*path[0];

    for(let t=1;t<T;t++){
      if(t%cfg.interval===0) units+=cfg.recur/path[t];
      out[t]=units*path[t];
    }
    return out;
  };

  A.portfolioValueAt = (path,t) => {
    const cfg=A.state.portfolio;
    let units=cfg.initial/path[0];
    if(cfg.firstNow) units+=cfg.recur/path[0];
    for(let k=cfg.interval;k<=t;k+=cfg.interval) units+=cfg.recur/path[k];
    return units*path[t];
  };

  A.portfolioDistributionAt = t => {
    const vals=new Array(A.state.paths.length);
    for(let p=0;p<A.state.paths.length;p++){
      vals[p]=A.portfolioValueAt(A.state.paths[p],t);
    }
    return vals;
  };

  A.portfolioSeriesForMode = (vals,mode) => {
    const principal=A.state.portfolio.principalByStep;
    if(mode==="profit") return Array.from(vals,(v,t)=>v-principal[t]);
    if(mode==="ratio") return Array.from(vals,(v,t)=>principal[t]>0?v/principal[t]:NaN);
    return Array.from(vals);
  };

  A.computePortfolioSummarySeries = mode => {
    const cfg=A.state.portfolio;
    if(!cfg) return null;
    const {lowerQ,upperQ}=A.getConfidence();
    const key=`${mode}:${lowerQ.toFixed(6)}:${upperQ.toFixed(6)}`;
    if(cfg.summaryCache.has(key)) return cfg.summaryCache.get(key);

    const P=A.state.paths.length,T=A.state.steps.length;
    const units=new Float64Array(P);
    const current=new Array(P);
    const lower=new Float64Array(T),upper=new Float64Array(T);
    const median=new Float64Array(T),mean=new Float64Array(T);

    for(let p=0;p<P;p++){
      units[p]=cfg.initial/A.state.paths[p][0];
      if(cfg.firstNow) units[p]+=cfg.recur/A.state.paths[p][0];
    }

    for(let t=0;t<T;t++){
      if(t>0 && t%cfg.interval===0){
        for(let p=0;p<P;p++) units[p]+=cfg.recur/A.state.paths[p][t];
      }
      let sum=0;
      for(let p=0;p<P;p++){
        const value=units[p]*A.state.paths[p][t];
        let x=value;
        const principal=cfg.principalByStep[t];
        if(mode==="profit") x=value-principal;
        else if(mode==="ratio") x=principal>0?value/principal:NaN;
        current[p]=x;
        if(Number.isFinite(x)) sum+=x;
      }
      const sorted=current.filter(Number.isFinite).sort((a,b)=>a-b);
      lower[t]=A.quantile(sorted,lowerQ);
      upper[t]=A.quantile(sorted,upperQ);
      median[t]=A.quantile(sorted,.5);
      mean[t]=sorted.length?sum/sorted.length:NaN;
    }

    const out={lower,upper,median,mean,lowerQ,upperQ};
    cfg.summaryCache.set(key,out);
    return out;
  };
})();
