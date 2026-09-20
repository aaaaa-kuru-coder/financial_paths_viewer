"use strict";

(() => {
  const A=window.SimApp;

  function showMedian(){return A.$("showMedian").checked;}
  function showMean(){return A.$("showMean").checked;}

  function updateConfidenceLabels(){
    const c=A.getConfidence();
    const lower=A.percentLabel(c.lowerQ);
    const upper=A.percentLabel(c.upperQ);
    const text=`${c.level}%区間 (${lower}–${upper})`;
    A.$("indexCiLegend").textContent=text;
    A.$("portfolioCiLegend").textContent=text;
    A.$("indexHistCiLegend").textContent=`${lower} / ${upper}`;
    A.$("portfolioHistCiLegend").textContent=`${lower} / ${upper}`;
    A.$("checkpointLowerHead").textContent=lower;
    A.$("checkpointUpperHead").textContent=upper;
  }

  A.drawIndexPaths = () => {
    if(!A.ensureData()) return;
    const total=A.state.paths.length;
    const sel=A.makeSelectedPathIndices(
      Number(A.$("indexCenterPath").value),
      Number(A.$("indexBeforeCount").value),
      Number(A.$("indexAfterCount").value),
      total
    );
    A.$("indexCenterPath").value=sel.center+1;

    const series=sel.ids.map(i=>{
      const style=A.pathColor(i,sel.center,sel.lo,sel.hi);
      return {values:A.state.paths[i],...style};
    });

    const summary=A.computeIndexSummarySeries();
    A.drawPathChart(A.$("indexPathsCanvas"),series,{
      xValues:A.state.steps,
      scaleMode:"log",
      yLabel:"Index level (log scale)",
      band:{lower:summary.lower,upper:summary.upper},
      median:showMedian()?summary.median:null,
      mean:showMean()?summary.mean:null
    });

    A.$("indexPathSelectionNote").textContent=
      `path_${sel.lo} ～ path_${sel.hi} を表示。中心は path_${sel.center}（CSV上では ${sel.center+1} 本目）。`;
  };

  A.drawIndexHistogram = () => {
    if(!A.ensureData()) return;
    const t=A.stepIndexFromInput("indexDistStep");
    A.$("indexDistStep").value=t;
    const vals=A.getIndexDistributionAt(t);
    const s=A.drawLogHistogram(A.$("indexHistCanvas"),vals,{
      xLabel:`Index level @ step ${A.state.steps[t]}`,
      showMedian:showMedian(),
      showMean:showMean()
    });
    if(s) renderIndexStats(s);
  };

  function renderIndexStats(s){
    const c=A.getConfidence();
    const items=[
      [A.percentLabel(c.lowerQ),s.lower],
      ["P25",s.p25],
      ["Median",s.median],
      ["Mean",s.mean],
      ["P75",s.p75],
      [A.percentLabel(c.upperQ),s.upper]
    ];
    A.$("indexStats").innerHTML=items.map(([k,v])=>
      `<div class="stat"><div class="k">${k}</div><div class="v">${A.fmt.format(v)}</div></div>`
    ).join("");
  }

  A.drawPortfolioPaths = () => {
    if(!A.state.portfolio){ if(A.ensureData())A.runPortfolio(); return; }

    const total=A.state.paths.length;
    const sel=A.makeSelectedPathIndices(
      Number(A.$("portfolioCenterPath").value),
      Number(A.$("portfolioBeforeCount").value),
      Number(A.$("portfolioAfterCount").value),
      total
    );
    A.$("portfolioCenterPath").value=sel.center+1;

    const mode=A.$("portfolioViewMode").value;
    const series=sel.ids.map(i=>{
      const raw=A.portfolioPath(A.state.paths[i]);
      const vals=A.portfolioSeriesForMode(raw,mode);
      return {values:vals,...A.pathColor(i,sel.center,sel.lo,sel.hi)};
    });

    const summary=A.computePortfolioSummarySeries(mode);
    let reference=null;
    let scaleMode=mode==="profit"?"symlog":"log";
    let yLabel="Portfolio value (log scale)";
    if(mode==="value"){
      reference=Array.from(A.state.portfolio.principalByStep);
    }else if(mode==="profit"){
      reference=Array(A.state.steps.length).fill(0);
      yLabel="Profit / Loss (symlog)";
    }else{
      reference=Array(A.state.steps.length).fill(1);
      yLabel="Portfolio / Principal (log scale)";
    }

    A.drawPathChart(A.$("portfolioPathsCanvas"),series,{
      xValues:A.state.steps,
      scaleMode,
      yLabel,
      band:{lower:summary.lower,upper:summary.upper},
      median:showMedian()?summary.median:null,
      mean:showMean()?summary.mean:null,
      reference
    });

    A.$("portfolioPathSelectionNote").textContent=
      `path_${sel.lo} ～ path_${sel.hi} を表示。中心は path_${sel.center}（CSV上では ${sel.center+1} 本目）。`;
  };

  A.drawPortfolioHistogram = () => {
    if(!A.state.portfolio) return;
    const t=A.stepIndexFromInput("portfolioDistStep");
    A.$("portfolioDistStep").value=t;
    const vals=A.portfolioDistributionAt(t);
    const s=A.drawLogHistogram(A.$("portfolioHistCanvas"),vals,{
      xLabel:`Portfolio value @ step ${A.state.steps[t]}`,
      showMedian:showMedian(),
      showMean:showMean()
    });
    if(s) renderPortfolioStats(t,vals,s);
  };

  function renderPortfolioStats(t,vals,s){
    const c=A.getConfidence();
    const principal=A.state.portfolio.principalByStep[t];
    const medianReturn=principal>0?s.median/principal-1:NaN;
    const pLoss=vals.filter(v=>v<principal).length/vals.length;
    const items=[
      ["投資元本",principal,"money"],
      [A.percentLabel(c.lowerQ),s.lower,"money"],
      ["Median",s.median,"money"],
      ["Mean",s.mean,"money"],
      [A.percentLabel(c.upperQ),s.upper,"money"],
      ["中央値損益率",medianReturn,"pct"],
      ["元本割れ率",pLoss,"pct"]
    ];
    A.$("portfolioStats").innerHTML=items.map(([k,v,type])=>{
      const txt=type==="pct"
        ? (Number.isFinite(v)?(v*100).toFixed(1)+"%":"—")
        : A.fmt0.format(v);
      return `<div class="stat"><div class="k">${k}</div><div class="v">${txt}</div></div>`;
    }).join("");
  }

  A.refreshCheckpointTable = () => {
    if(!A.state.portfolio) return;
    const raw=A.$("checkpointSteps").value.split(",")
      .map(x=>Math.round(Number(x.trim()))).filter(Number.isFinite);
    const last=A.state.steps.length-1;
    const idxs=[...new Set(raw.map(x=>A.clamp(x,0,last)))].sort((a,b)=>a-b);
    const c=A.getConfidence();

    A.$("checkpointBody").innerHTML=idxs.map(t=>{
      const vals=A.portfolioDistributionAt(t);
      const s=A.summarize(vals,c.lowerQ,c.upperQ);
      const principal=A.state.portfolio.principalByStep[t];
      return `<tr>
        <td>${A.state.steps[t]}</td><td>${A.fmt0.format(principal)}</td>
        <td>${A.fmt0.format(s.lower)}</td><td>${A.fmt0.format(s.p25)}</td>
        <td>${A.fmt0.format(s.median)}</td><td>${A.fmt0.format(s.mean)}</td>
        <td>${A.fmt0.format(s.p75)}</td><td>${A.fmt0.format(s.upper)}</td>
      </tr>`;
    }).join("");
  };

  A.refreshAll = () => {
    updateConfidenceLabels();
    if(A.state.paths.length){
      A.drawIndexPaths();
      A.drawIndexHistogram();
    }
    if(A.state.portfolio){
      A.drawPortfolioPaths();
      A.drawPortfolioHistogram();
      A.refreshCheckpointTable();
    }
  };

  // File input / D&D
  const dz=A.$("dropZone");
  dz.addEventListener("click",()=>A.$("fileInput").click());
  dz.addEventListener("keydown",e=>{
    if(e.key==="Enter"||e.key===" "){e.preventDefault();A.$("fileInput").click();}
  });
  ["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{
    e.preventDefault();dz.classList.add("drag");
  }));
  ["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{
    e.preventDefault();dz.classList.remove("drag");
  }));
  dz.addEventListener("drop",e=>A.loadLocalFile(e.dataTransfer.files?.[0]));
  A.$("fileInput").addEventListener("change",e=>A.loadLocalFile(e.target.files?.[0]));

  A.$("reloadRemoteBtn").addEventListener("click",A.loadRemoteCsv);
  A.$("redrawIndexBtn").addEventListener("click",A.drawIndexPaths);
  A.$("indexDistStep").addEventListener("change",A.drawIndexHistogram);
  A.$("indexFinalBtn").addEventListener("click",()=>{
    if(!A.state.steps.length)return;
    A.$("indexDistStep").value=A.state.steps.length-1;
    A.drawIndexHistogram();
  });

  A.$("runPortfolioBtn").addEventListener("click",A.runPortfolio);
  A.$("redrawPortfolioBtn").addEventListener("click",A.drawPortfolioPaths);
  A.$("portfolioViewMode").addEventListener("change",A.drawPortfolioPaths);
  A.$("portfolioDistStep").addEventListener("change",A.drawPortfolioHistogram);
  A.$("portfolioFinalBtn").addEventListener("click",()=>{
    if(!A.state.steps.length)return;
    A.$("portfolioDistStep").value=A.state.steps.length-1;
    A.drawPortfolioHistogram();
  });
  A.$("refreshCheckpointBtn").addEventListener("click",A.refreshCheckpointTable);

  A.$("applyDisplaySettingsBtn").addEventListener("click",()=>{
    A.state.indexSummaryCache.clear();
    if(A.state.portfolio) A.state.portfolio.summaryCache.clear();
    A.refreshAll();
  });
  A.$("showMedian").addEventListener("change",A.refreshAll);
  A.$("showMean").addEventListener("change",A.refreshAll);

  let resizeTimer=null;
  window.addEventListener("resize",()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(A.refreshAll,120);
  });

  updateConfidenceLabels();
  if(window.CONFIG.autoLoadRemote&&window.CONFIG.remoteCsvUrl) A.loadRemoteCsv();
})();
