"use strict";
(() => {
  const A=window.SimApp;

  A.state={steps:[],paths:[],headers:[],sourceName:"",indexSummaryCache:new Map(),portfolio:null,preparedItems:[]};

  A.splitCsvLine=line=>{
    const out=[];let cur="",quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;
      }else if(ch===","&&!quoted){out.push(cur);cur="";}else cur+=ch;
    }
    out.push(cur);return out;
  };

  A.parseCSV=text=>{
    const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim().length);
    if(lines.length<2)throw new Error("CSVにデータ行がありません。");
    const header=A.splitCsvLine(lines[0]).map(s=>s.trim());
    if(header[0].toLowerCase()!=="step")throw new Error("先頭列名が step ではありません。");
    if(header.length<2)throw new Error("path列がありません。");
    const steps=[],cols=Array.from({length:header.length-1},()=>[]);let skipped=0;
    for(let i=1;i<lines.length;i++){
      const cells=A.splitCsvLine(lines[i]);
      if(cells.length<header.length){skipped++;continue;}
      const step=Number(cells[0]);if(!Number.isFinite(step)){skipped++;continue;}
      const vals=new Array(cols.length);let ok=true;
      for(let j=0;j<cols.length;j++){
        const v=Number(cells[j+1]);if(!Number.isFinite(v)||v<=0){ok=false;break;}vals[j]=v;
      }
      if(!ok){skipped++;continue;}
      steps.push(step);for(let j=0;j<cols.length;j++)cols[j].push(vals[j]);
    }
    if(steps.length<2)throw new Error("有効なデータ行が2行未満です。");
    return {steps,paths:cols,headers:header.slice(1),skipped};
  };

  A.loadLocalFile=async file=>{
    if(!file)return;A.setMessage("CSVを読み込んでいます…");
    try{A.applyDataset(A.parseCSV(await file.text()),file.name);}
    catch(err){A.setMessage(err.message,true);}
  };

  A.loadPreparedManifest=async()=>{
    const select=A.$("preparedDataSelect");
    select.innerHTML='<option value="">データを選択...</option>';
    try{
      const res=await fetch(window.CONFIG.preparedManifestUrl,{cache:"no-store"});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const manifest=await res.json();
      const items=Array.isArray(manifest)?manifest:(manifest.files||[]);
      A.state.preparedItems=items.filter(x=>x&&x.file);
      for(const item of A.state.preparedItems){
        const opt=document.createElement("option");
        opt.value=item.file;
        opt.textContent=item.label||item.name||item.file;
        select.appendChild(opt);
      }
      A.setMessage(`prepared data を ${A.state.preparedItems.length} 件読み込みました。`);
    }catch(err){
      A.state.preparedItems=[];
      A.setMessage(`prepared data一覧を取得できませんでした: ${err.message}。simulation_data/manifest.json を確認してください。`,true);
    }
  };

  A.loadPreparedCsv=async()=>{
    const file=A.$("preparedDataSelect").value;
    if(!file){A.setMessage("prepared data を選択してください。",true);return;}
    const url=`./simulation_data/${file.replace(/^\.?\//,"")}`;
    A.setMessage(`${file} を読み込んでいます…`);
    try{
      const res=await fetch(url,{cache:"no-store"});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      A.applyDataset(A.parseCSV(await res.text()),file);
    }catch(err){A.setMessage(`prepared data読込エラー: ${err.message}`,true);}
  };

  A.applyDataset=(ds,sourceName)=>{
    A.state.steps=ds.steps;A.state.paths=ds.paths;A.state.headers=ds.headers;A.state.sourceName=sourceName;
    A.state.indexSummaryCache.clear();A.state.portfolio=null;

    const last=ds.steps.length-1,center=Math.max(1,Math.ceil(ds.paths.length/2));
    for(const id of ["indexDistStep","portfolioDistStep"]){A.$(id).max=last;A.$(id).value=last;}
    for(const id of ["indexCenterPath","portfolioCenterPath"]){A.$(id).max=ds.paths.length;A.$(id).value=center;}

    A.$("dataStatus").textContent=`${sourceName} / ${A.fmt0.format(ds.paths.length)} paths × ${A.fmt0.format(ds.steps.length)} steps`;
    A.setMessage(`読込完了。${ds.skipped?`${ds.skipped}行を除外。`:""} グラフ座標は対数系で描画します。`);
    A.refreshAll();A.runPortfolio();
  };

  A.ensureData=()=>{
    if(!A.state.paths.length){A.setMessage("先にCSVを読み込んでください。",true);return false;}return true;
  };
  A.getIndexDistributionAt=t=>A.state.paths.map(p=>p[t]);

  A.computeIndexSummarySeries=()=>{
    if(!A.ensureData())return null;
    const {lowerQ,upperQ}=A.getConfidence(),key=`${lowerQ}:${upperQ}`;
    if(A.state.indexSummaryCache.has(key))return A.state.indexSummaryCache.get(key);
    const T=A.state.steps.length,P=A.state.paths.length;
    const lower=new Float64Array(T),upper=new Float64Array(T),median=new Float64Array(T),mean=new Float64Array(T),vals=new Array(P);
    for(let t=0;t<T;t++){
      let sum=0;for(let p=0;p<P;p++){const v=A.state.paths[p][t];vals[p]=v;sum+=v;}
      vals.sort((a,b)=>a-b);lower[t]=A.quantile(vals,lowerQ);upper[t]=A.quantile(vals,upperQ);median[t]=A.quantile(vals,.5);mean[t]=sum/P;
    }
    const out={lower,upper,median,mean,lowerQ,upperQ};A.state.indexSummaryCache.set(key,out);return out;
  };
})();
