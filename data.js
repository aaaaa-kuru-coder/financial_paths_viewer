"use strict";

(() => {
  const A=window.SimApp;

  A.state = {
    steps: [],
    paths: [],
    headers: [],
    sourceName: "",
    indexSummaryCache: new Map(),
    portfolio: null
  };

  A.splitCsvLine = line => {
    const out=[]; let cur=""; let quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch === '"'){
        if(quoted && line[i+1] === '"'){ cur+='"'; i++; }
        else quoted=!quoted;
      }else if(ch === "," && !quoted){
        out.push(cur); cur="";
      }else cur+=ch;
    }
    out.push(cur);
    return out;
  };

  A.parseCSV = text => {
    const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim().length);
    if(lines.length<2) throw new Error("CSVにデータ行がありません。");

    const header=A.splitCsvLine(lines[0]).map(s=>s.trim());
    if(header[0].toLowerCase()!=="step"){
      throw new Error("先頭列名が step ではありません。想定: step, path_0, path_1, ...");
    }
    if(header.length<2) throw new Error("path列がありません。");

    const steps=[];
    const cols=Array.from({length:header.length-1},()=>[]);
    let skipped=0;

    for(let i=1;i<lines.length;i++){
      const cells=A.splitCsvLine(lines[i]);
      if(cells.length<header.length){skipped++;continue;}
      const step=Number(cells[0]);
      if(!Number.isFinite(step)){skipped++;continue;}

      const vals=new Array(cols.length);
      let ok=true;
      for(let j=0;j<cols.length;j++){
        const v=Number(cells[j+1]);
        if(!Number.isFinite(v)||v<=0){ok=false;break;}
        vals[j]=v;
      }
      if(!ok){skipped++;continue;}

      steps.push(step);
      for(let j=0;j<cols.length;j++) cols[j].push(vals[j]);
    }

    if(steps.length<2) throw new Error("有効なデータ行が2行未満です。");
    if(cols.length<1) throw new Error("有効なpath列がありません。");
    return {steps,paths:cols,headers:header.slice(1),skipped};
  };

  A.loadLocalFile = async file => {
    if(!file) return;
    A.setMessage("CSVを読み込んでいます…");
    try{
      const text=await file.text();
      A.applyDataset(A.parseCSV(text),file.name);
    }catch(err){
      A.setMessage(err.message,true);
    }
  };

  A.loadRemoteCsv = async () => {
    if(!window.CONFIG.remoteCsvUrl){
      A.setMessage("CONFIG.remoteCsvUrl が未設定です。ローカル利用ではこのままで正常です。",true);
      return;
    }
    A.setMessage("GitHub上のCSVを読み込んでいます…");
    try{
      const res=await fetch(window.CONFIG.remoteCsvUrl,{cache:"no-store"});
      if(!res.ok) throw new Error(`CSV取得失敗: HTTP ${res.status}`);
      const text=await res.text();
      A.applyDataset(A.parseCSV(text),window.CONFIG.remoteCsvUrl);
    }catch(err){
      A.setMessage("リモートCSV読込エラー: "+err.message,true);
    }
  };

  A.applyDataset = (ds,sourceName) => {
    A.state.steps=ds.steps;
    A.state.paths=ds.paths;
    A.state.headers=ds.headers;
    A.state.sourceName=sourceName;
    A.state.indexSummaryCache.clear();
    A.state.portfolio=null;

    const last=ds.steps.length-1;
    A.$("indexDistStep").max=last;
    A.$("indexDistStep").value=last;
    A.$("portfolioDistStep").max=last;
    A.$("portfolioDistStep").value=last;

    const center=Math.max(1,Math.ceil(ds.paths.length/2));
    A.$("indexCenterPath").max=ds.paths.length;
    A.$("portfolioCenterPath").max=ds.paths.length;
    A.$("indexCenterPath").value=center;
    A.$("portfolioCenterPath").value=center;

    A.$("dataStatus").textContent=
      `${sourceName} / ${A.fmt0.format(ds.paths.length)} paths × ${A.fmt0.format(ds.steps.length)} steps`;

    A.setMessage(
      `読込完了。${ds.skipped ? `${ds.skipped}行を不正値として除外。` : ""}`+
      `指数・資産額のグラフ座標は対数変換して描画します。`
    );

    A.refreshAll();
    A.runPortfolio();
  };

  A.ensureData = () => {
    if(!A.state.paths.length){
      A.setMessage("先にCSVを読み込んでください。",true);
      return false;
    }
    return true;
  };

  A.getIndexDistributionAt = t => A.state.paths.map(p=>p[t]);

  A.computeIndexSummarySeries = () => {
    if(!A.ensureData()) return null;
    const {lowerQ,upperQ}=A.getConfidence();
    const key=`${lowerQ.toFixed(6)}:${upperQ.toFixed(6)}`;
    if(A.state.indexSummaryCache.has(key)) return A.state.indexSummaryCache.get(key);

    const T=A.state.steps.length, P=A.state.paths.length;
    const lower=new Float64Array(T);
    const upper=new Float64Array(T);
    const median=new Float64Array(T);
    const mean=new Float64Array(T);
    const vals=new Array(P);

    for(let t=0;t<T;t++){
      let sum=0;
      for(let p=0;p<P;p++){
        const v=A.state.paths[p][t];
        vals[p]=v; sum+=v;
      }
      vals.sort((a,b)=>a-b);
      lower[t]=A.quantile(vals,lowerQ);
      upper[t]=A.quantile(vals,upperQ);
      median[t]=A.quantile(vals,.5);
      mean[t]=sum/P;
    }
    const out={lower,upper,median,mean,lowerQ,upperQ};
    A.state.indexSummaryCache.set(key,out);
    return out;
  };
})();
