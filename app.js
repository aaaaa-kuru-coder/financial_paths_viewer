"use strict";
(() => {
  const A=window.SimApp;

  function showMedian(){return A.$("showMedian").checked}
  function showMean(){return A.$("showMean").checked}

  function updateConfidenceLabels(){
    const c=A.getConfidence(),lo=A.percentLabel(c.lowerQ),hi=A.percentLabel(c.upperQ),txt=`${c.level}%区間 (${lo}–${hi})`;
    A.$("indexCiLegend").textContent=txt;A.$("portfolioCiLegend").textContent=txt;
    A.$("indexHistCiLegend").textContent=`${lo} / ${hi}`;A.$("portfolioHistCiLegend").textContent=`${lo} / ${hi}`;
    A.$("checkpointLowerHead").textContent=lo;A.$("checkpointUpperHead").textContent=hi;
  }

  function applyStyleToControls(){
    const s=A.style,map={
      styleCenterColor:"centerColor",styleCenterWidth:"centerWidth",styleBeforeColor:"beforeColor",styleAfterColor:"afterColor",
      styleNeighborAlpha1:"neighborAlpha1",styleNeighborAlpha2:"neighborAlpha2",styleMedianColor:"medianColor",
      styleMedianWidth:"medianWidth",styleMeanColor:"meanColor",styleMeanWidth:"meanWidth",styleCiColor:"ciColor",
      styleCiAlpha:"ciAlpha",styleNeighborWidth:"neighborWidth",stylePortfolioYCapMultiplier:"portfolioYCapMultiplier"
    };
    for(const [id,key] of Object.entries(map))A.$(id).value=s[key];
  }

  function collectStyle(){
    const n=id=>Number(A.$(id).value),v=id=>A.$(id).value;
    return {...A.style,
      centerColor:v("styleCenterColor"),centerWidth:A.clamp(n("styleCenterWidth"),.5,10),
      beforeColor:v("styleBeforeColor"),afterColor:v("styleAfterColor"),
      neighborAlpha1:A.clamp(n("styleNeighborAlpha1"),0,1),neighborAlpha2:A.clamp(n("styleNeighborAlpha2"),0,1),
      medianColor:v("styleMedianColor"),medianWidth:A.clamp(n("styleMedianWidth"),.5,10),
      meanColor:v("styleMeanColor"),meanWidth:A.clamp(n("styleMeanWidth"),.5,10),
      ciColor:v("styleCiColor"),ciAlpha:A.clamp(n("styleCiAlpha"),0,1),
      neighborWidth:A.clamp(n("styleNeighborWidth"),.2,5),
      portfolioYCapMultiplier:A.clamp(n("stylePortfolioYCapMultiplier"),1,5)
    };
  }

  A.drawIndexPaths=()=>{
    if(!A.ensureData())return;
    const sel=A.makeSelectedPathIndices(Number(A.$("indexCenterPath").value),Number(A.$("indexNeighborCount").value),A.state.paths.length);
    A.$("indexCenterPath").value=sel.center+1;
    const series=sel.ids.map(i=>({values:A.state.paths[i],...A.pathStyle(i,sel)})),summary=A.computeIndexSummarySeries();
    A.drawPathChart(A.$("indexPathsCanvas"),series,{xValues:A.state.steps,scaleMode:"log",yLabel:"Index level (log)",
      band:{lower:summary.lower,upper:summary.upper},median:showMedian()?summary.median:null,mean:showMean()?summary.mean:null});
    A.$("indexPathSelectionNote").textContent=`path_${sel.lo} ～ path_${sel.hi} を表示。中心は path_${sel.center}。`;
  };

  A.drawIndexHistogram=()=>{
    if(!A.ensureData())return;
    const t=A.stepIndexFromInput("indexDistStep");A.$("indexDistStep").value=t;
    const s=A.drawLogHistogram(A.$("indexHistCanvas"),A.getIndexDistributionAt(t),{showMedian:showMedian(),showMean:showMean(),infoElementId:"indexHistBinInfo"});
    if(s)renderIndexStats(s);
  };

  function renderIndexStats(s){
    const c=A.getConfidence(),items=[[A.percentLabel(c.lowerQ),s.lower],["P25",s.p25],["Median",s.median],["Mean",s.mean],["P75",s.p75],[A.percentLabel(c.upperQ),s.upper]];
    A.$("indexStats").innerHTML=items.map(([k,v])=>`<div class="stat"><div class="k">${k}</div><div class="v">${A.numberLabel(v)}</div></div>`).join("");
  }

  A.drawPortfolioPaths=()=>{
    if(!A.state.portfolio){if(A.ensureData())A.runPortfolio();return;}
    const sel=A.makeSelectedPathIndices(Number(A.$("portfolioCenterPath").value),Number(A.$("portfolioNeighborCount").value),A.state.paths.length);
    A.$("portfolioCenterPath").value=sel.center+1;
    const mode=A.$("portfolioViewMode").value;
    const series=sel.ids.map(i=>({values:A.portfolioSeriesForMode(A.portfolioPath(A.state.paths[i]),mode),...A.pathStyle(i,sel)}));
    const summary=A.computePortfolioSummarySeries(mode),last=summary.upper.length-1;
    let reference=null,scaleMode=mode==="profit"?"symlog":"log",domainOriginal=null,label="Portfolio value";

    if(mode==="value"){
      reference=Array.from(A.state.portfolio.principalByStep);
      const cap=summary.upper[last]*A.style.portfolioYCapMultiplier;
      domainOriginal={max:cap};
    }else if(mode==="profit"){
      reference=Array(A.state.steps.length).fill(0);
      const upper=Math.abs(summary.upper[last]),lower=Math.abs(summary.lower[last]),cap=Math.max(upper,lower)*A.style.portfolioYCapMultiplier;
      domainOriginal={min:-cap,max:cap};label="Profit / Loss";
    }else{
      reference=Array(A.state.steps.length).fill(1);
      const cap=summary.upper[last]*A.style.portfolioYCapMultiplier;
      domainOriginal={max:cap};label="Portfolio / Principal";
    }

    A.drawPathChart(A.$("portfolioPathsCanvas"),series,{xValues:A.state.steps,scaleMode,yLabel:label,
      band:{lower:summary.lower,upper:summary.upper},median:showMedian()?summary.median:null,mean:showMean()?summary.mean:null,reference,domainOriginal});
    A.$("portfolioPathSelectionNote").textContent=`path_${sel.lo} ～ path_${sel.hi} を表示。中心は path_${sel.center}。表示上限倍率=${A.style.portfolioYCapMultiplier}。`;
  };

  A.drawPortfolioHistogram=()=>{
    if(!A.state.portfolio)return;
    const t=A.stepIndexFromInput("portfolioDistStep");A.$("portfolioDistStep").value=t;
    const vals=A.portfolioDistributionAt(t),s=A.drawLogHistogram(A.$("portfolioHistCanvas"),vals,{showMedian:showMedian(),showMean:showMean(),infoElementId:"portfolioHistBinInfo"});
    if(s)renderPortfolioStats(t,vals,s);
  };

  function renderPortfolioStats(t,vals,s){
    const c=A.getConfidence(),principal=A.state.portfolio.principalByStep[t],medianReturn=principal>0?s.median/principal-1:NaN,pLoss=vals.filter(v=>v<principal).length/vals.length;
    const items=[["投資元本",principal,"m"],[A.percentLabel(c.lowerQ),s.lower,"m"],["Median",s.median,"m"],["Mean",s.mean,"m"],[A.percentLabel(c.upperQ),s.upper,"m"],["中央値損益率",medianReturn,"p"],["元本割れ率",pLoss,"p"]];
    A.$("portfolioStats").innerHTML=items.map(([k,v,t])=>`<div class="stat"><div class="k">${k}</div><div class="v">${t==="p"?(100*v).toFixed(1)+"%":A.numberLabel(v)}</div></div>`).join("");
  }

  A.refreshCheckpointTable=()=>{
    if(!A.state.portfolio)return;
    const raw=A.$("checkpointSteps").value.split(",").map(x=>Math.round(Number(x.trim()))).filter(Number.isFinite),last=A.state.steps.length-1;
    const idxs=[...new Set(raw.map(x=>A.clamp(x,0,last)))].sort((a,b)=>a-b),c=A.getConfidence();
    A.$("checkpointBody").innerHTML=idxs.map(t=>{
      const s=A.summarize(A.portfolioDistributionAt(t),c.lowerQ,c.upperQ),p=A.state.portfolio.principalByStep[t];
      return `<tr><td>${A.state.steps[t]}</td><td>${A.numberLabel(p)}</td><td>${A.numberLabel(s.lower)}</td><td>${A.numberLabel(s.p25)}</td><td>${A.numberLabel(s.median)}</td><td>${A.numberLabel(s.mean)}</td><td>${A.numberLabel(s.p75)}</td><td>${A.numberLabel(s.upper)}</td></tr>`;
    }).join("");
  };

  A.refreshAll=()=>{
    updateConfidenceLabels();
    if(A.state.paths.length){A.drawIndexPaths();A.drawIndexHistogram();}
    if(A.state.portfolio){A.drawPortfolioPaths();A.drawPortfolioHistogram();A.refreshCheckpointTable();}
  };

  const dz=A.$("dropZone");
  dz.addEventListener("click",()=>A.$("fileInput").click());
  dz.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();A.$("fileInput").click();}});
  ["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("drag");}));
  ["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("drag");}));
  dz.addEventListener("drop",e=>A.loadLocalFile(e.dataTransfer.files?.[0]));
  A.$("fileInput").addEventListener("change",e=>A.loadLocalFile(e.target.files?.[0]));

  A.$("preparedDataBtn").addEventListener("click",async()=>{
    const panel=A.$("preparedDataPanel");panel.classList.toggle("hidden");
    if(!panel.classList.contains("hidden")&&!A.state.preparedItems.length)await A.loadPreparedManifest();
  });
  A.$("refreshPreparedDataBtn").addEventListener("click",A.loadPreparedManifest);
  A.$("loadPreparedDataBtn").addEventListener("click",A.loadPreparedCsv);

  A.$("openStyleSettingsBtn").addEventListener("click",()=>{applyStyleToControls();A.$("styleSettingsPanel").classList.remove("hidden");});
  A.$("closeStyleSettingsBtn").addEventListener("click",()=>A.$("styleSettingsPanel").classList.add("hidden"));
  A.$("saveStyleSettingsBtn").addEventListener("click",()=>{A.style=collectStyle();A.saveJsonStorage(window.CONFIG.styleStorageKey,A.style);A.$("styleSettingsPanel").classList.add("hidden");A.refreshAll();});
  A.$("resetStyleSettingsBtn").addEventListener("click",()=>{A.style=structuredClone(window.DEFAULT_STYLE);A.saveJsonStorage(window.CONFIG.styleStorageKey,A.style);applyStyleToControls();A.refreshAll();});

  A.$("redrawIndexBtn").addEventListener("click",A.drawIndexPaths);
  A.$("indexDistStep").addEventListener("change",A.drawIndexHistogram);
  A.$("indexFinalBtn").addEventListener("click",()=>{if(A.state.steps.length){A.$("indexDistStep").value=A.state.steps.length-1;A.drawIndexHistogram();}});
  A.$("runPortfolioBtn").addEventListener("click",A.runPortfolio);
  A.$("redrawPortfolioBtn").addEventListener("click",A.drawPortfolioPaths);
  A.$("portfolioViewMode").addEventListener("change",A.drawPortfolioPaths);
  A.$("portfolioDistStep").addEventListener("change",A.drawPortfolioHistogram);
  A.$("portfolioFinalBtn").addEventListener("click",()=>{if(A.state.steps.length){A.$("portfolioDistStep").value=A.state.steps.length-1;A.drawPortfolioHistogram();}});
  A.$("refreshCheckpointBtn").addEventListener("click",A.refreshCheckpointTable);
  A.$("applyDisplaySettingsBtn").addEventListener("click",()=>{A.state.indexSummaryCache.clear();if(A.state.portfolio)A.state.portfolio.summaryCache.clear();A.refreshAll();});
  A.$("showMedian").addEventListener("change",A.refreshAll);A.$("showMean").addEventListener("change",A.refreshAll);

  A.$("indexHistCanvas").addEventListener("click",e=>A.handleHistogramClick(A.$("indexHistCanvas"),e));
  A.$("portfolioHistCanvas").addEventListener("click",e=>A.handleHistogramClick(A.$("portfolioHistCanvas"),e));

  let rt=null;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(A.refreshAll,120);});
  updateConfidenceLabels();applyStyleToControls();
})();
