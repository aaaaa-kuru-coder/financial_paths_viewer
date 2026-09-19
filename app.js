"use strict";

const CONFIG = window.CONFIG;



/* ---------------- State ---------------- */
const state = {
  steps: [],
  paths: [],       // paths[pathIndex][stepIndex]
  headers: [],
  sourceName: "",
  portfolio: null, // { values, principalByStep }
};

const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat("ja-JP", {maximumFractionDigits: 2});
const fmt0 = new Intl.NumberFormat("ja-JP", {maximumFractionDigits: 0});

/* ---------------- CSV ingestion ---------------- */
function parseCSV(text){
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(x => x.trim().length);
  if(lines.length < 2) throw new Error("CSVにデータ行がありません。");

  const header = splitCsvLine(lines[0]).map(s => s.trim());
  if(header[0].toLowerCase() !== "step"){
    throw new Error("先頭列名が step ではありません。想定: step, path_0, path_1, ...");
  }
  if(header.length < 2) throw new Error("path列がありません。");

  const stepArr = [];
  const cols = Array.from({length: header.length - 1}, () => []);

  for(let i=1;i<lines.length;i++){
    const cells = splitCsvLine(lines[i]);
    if(cells.length < header.length) continue;
    const step = Number(cells[0]);
    if(!Number.isFinite(step)) continue;

    const vals = new Array(cols.length);
    let ok = true;
    for(let j=0;j<cols.length;j++){
      const v = Number(cells[j+1]);
      if(!Number.isFinite(v) || v <= 0){ ok=false; break; }
      vals[j] = v;
    }
    if(!ok) continue;

    stepArr.push(step);
    for(let j=0;j<cols.length;j++) cols[j].push(vals[j]);
  }

  if(stepArr.length < 2) throw new Error("有効なデータ行が2行未満です。");
  if(cols.length < 1) throw new Error("有効なpath列がありません。");

  return {steps:stepArr, paths:cols, headers:header.slice(1)};
}

function splitCsvLine(line){
  // 数値CSV向けの軽量CSV parser。引用符内のカンマにも対応。
  const out=[]; let cur=""; let quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch === '"'){
      if(quoted && line[i+1] === '"'){ cur+='"'; i++; }
      else quoted=!quoted;
    } else if(ch === ',' && !quoted){
      out.push(cur); cur="";
    } else cur+=ch;
  }
  out.push(cur);
  return out;
}

async function loadLocalFile(file){
  if(!file) return;
  setMessage("CSVを読み込んでいます…");
  try{
    const text = await file.text();
    applyDataset(parseCSV(text), file.name);
  }catch(err){
    setMessage(err.message, true);
  }
}

async function loadRemoteCsv(){
  if(!CONFIG.remoteCsvUrl){
    setMessage("CONFIG.remoteCsvUrl が未設定です。ローカル利用ではこのままで正常です。", true);
    return;
  }
  setMessage("GitHub上のCSVを読み込んでいます…");
  try{
    const res = await fetch(CONFIG.remoteCsvUrl, {cache:"no-store"});
    if(!res.ok) throw new Error(`CSV取得失敗: HTTP ${res.status}`);
    const text = await res.text();
    applyDataset(parseCSV(text), CONFIG.remoteCsvUrl);
  }catch(err){
    setMessage("リモートCSV読込エラー: " + err.message, true);
  }
}

function applyDataset(ds, sourceName){
  state.steps = ds.steps;
  state.paths = ds.paths;
  state.headers = ds.headers;
  state.sourceName = sourceName;
  state.portfolio = null;

  const last = ds.steps.length - 1;
  $("indexDistStep").max = last;
  $("indexDistStep").value = last;
  $("portfolioDistStep").max = last;
  $("portfolioDistStep").value = last;

  $("dataStatus").textContent = `${sourceName} / ${fmt0.format(ds.paths.length)} paths × ${fmt0.format(ds.steps.length)} steps`;
  setMessage(`読込完了。path値は「指数水準」として扱います。step列の実値は描画X軸に利用し、積立間隔は行インデックス上のstep間隔として扱います。`);

  drawIndexPaths();
  drawIndexHistogram();
  runPortfolio();
}

/* ---------------- Utilities ---------------- */
function ensureData(){
  if(!state.paths.length){
    setMessage("先にCSVを読み込んでください。", true);
    return false;
  }
  return true;
}
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function quantile(sorted, q){
  if(!sorted.length) return NaN;
  const pos=(sorted.length-1)*q;
  const base=Math.floor(pos), rest=pos-base;
  return sorted[base+1] !== undefined
    ? sorted[base] + rest*(sorted[base+1]-sorted[base])
    : sorted[base];
}
function summarize(arr){
  const a = arr.filter(Number.isFinite).slice().sort((x,y)=>x-y);
  const mean = a.reduce((s,x)=>s+x,0)/a.length;
  return {n:a.length,min:a[0],p5:quantile(a,.05),p25:quantile(a,.25),median:quantile(a,.5),
    mean,p75:quantile(a,.75),p95:quantile(a,.95),max:a[a.length-1]};
}
function sampleIndices(total, count){
  count = clamp(Math.floor(count)||1,1,Math.min(total,CONFIG.maxPathsForRendering));
  if(count === 1) return [0];
  const out=[];
  for(let i=0;i<count;i++) out.push(Math.round(i*(total-1)/(count-1)));
  return [...new Set(out)];
}
function stepIndexFromInput(id){
  const last=state.steps.length-1;
  return clamp(Math.round(Number($(id).value)||0),0,last);
}
function setMessage(msg,isErr=false){
  const el=$("message");
  el.textContent=msg;
  el.className=isErr ? "note error" : "note";
}
function resizeCanvas(canvas){
  const dpr=window.devicePixelRatio||1;
  const rect=canvas.getBoundingClientRect();
  const w=Math.max(320,Math.floor(rect.width));
  const h=Math.max(220,Math.floor(rect.height));
  const rw=Math.floor(w*dpr), rh=Math.floor(h*dpr);
  if(canvas.width!==rw || canvas.height!==rh){ canvas.width=rw; canvas.height=rh; }
  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w,h};
}
function niceTicks(min,max,count=5){
  if(!Number.isFinite(min)||!Number.isFinite(max)) return [];
  if(min===max){ min*=.95; max*=1.05; if(min===max){min-=1;max+=1;} }
  const raw=(max-min)/count;
  const pow=10**Math.floor(Math.log10(raw));
  const m=raw/pow;
  const nice=m<1.5?1:m<3?2:m<7?5:10;
  const step=nice*pow;
  const start=Math.floor(min/step)*step;
  const end=Math.ceil(max/step)*step;
  const ticks=[];
  for(let x=start;x<=end+step*.5;x+=step) ticks.push(x);
  return ticks;
}
function axisFormat(v){
  const av=Math.abs(v);
  if(av>=1e9) return (v/1e9).toFixed(1)+"B";
  if(av>=1e6) return (v/1e6).toFixed(1)+"M";
  if(av>=1e3) return (v/1e3).toFixed(1)+"k";
  if(av>=10) return fmt0.format(v);
  return fmt.format(v);
}

/* ---------------- Canvas charts ---------------- */
function drawLineChart(canvas, seriesList, opts={}){
  const {ctx,w,h}=resizeCanvas(canvas);
  ctx.clearRect(0,0,w,h);
  const p=CONFIG.chartPadding;
  const plot={x:p.left,y:p.top,w:w-p.left-p.right,h:h-p.top-p.bottom};

  let ymin=Infinity,ymax=-Infinity;
  for(const s of seriesList){
    for(const y of s.values){
      if(Number.isFinite(y)){ ymin=Math.min(ymin,y); ymax=Math.max(ymax,y); }
    }
  }
  if(!Number.isFinite(ymin)){ return; }
  if(opts.yMin !== undefined) ymin=opts.yMin;
  if(opts.yMax !== undefined) ymax=opts.yMax;
  if(ymin===ymax){ymin*=.95; ymax*=1.05;}

  const ypad=(ymax-ymin)*.05 || 1;
  ymin-=ypad; ymax+=ypad;

  ctx.strokeStyle="#2a313d"; ctx.lineWidth=1;
  ctx.fillStyle="#9aa4b2"; ctx.font="11px system-ui";
  const yt=niceTicks(ymin,ymax,5);
  for(const t of yt){
    if(t<ymin||t>ymax) continue;
    const yy=plot.y+plot.h*(1-(t-ymin)/(ymax-ymin));
    ctx.beginPath();ctx.moveTo(plot.x,yy);ctx.lineTo(plot.x+plot.w,yy);ctx.stroke();
    ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText(axisFormat(t),plot.x-8,yy);
  }

  const n=seriesList[0]?.values.length||0;
  const xLabels=opts.xValues || Array.from({length:n},(_,i)=>i);
  const xticks=5;
  ctx.textAlign="center"; ctx.textBaseline="top";
  for(let k=0;k<=xticks;k++){
    const idx=Math.round(k*(n-1)/xticks);
    const xx=plot.x+plot.w*(idx/Math.max(1,n-1));
    ctx.strokeStyle="#2a313d";
    ctx.beginPath();ctx.moveTo(xx,plot.y);ctx.lineTo(xx,plot.y+plot.h);ctx.stroke();
    ctx.fillStyle="#9aa4b2";
    ctx.fillText(String(xLabels[idx] ?? idx),xx,plot.y+plot.h+8);
  }

  ctx.save();
  ctx.beginPath();ctx.rect(plot.x,plot.y,plot.w,plot.h);ctx.clip();
  const palette=["#7aa2ff","#76d4b5","#e8a2ff","#f2c66d","#ff9f7a","#8dd4ff"];
  seriesList.forEach((s,si)=>{
    ctx.strokeStyle=s.color||palette[si%palette.length];
    ctx.globalAlpha=s.alpha ?? .42;
    ctx.lineWidth=s.width||1.15;
    ctx.beginPath();
    const vals=s.values;
    for(let i=0;i<vals.length;i++){
      const y=vals[i];
      if(!Number.isFinite(y)) continue;
      const xx=plot.x+plot.w*(i/Math.max(1,vals.length-1));
      const yy=plot.y+plot.h*(1-(y-ymin)/(ymax-ymin));
      if(i===0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy);
    }
    ctx.stroke();
  });
  ctx.restore(); ctx.globalAlpha=1;

  if(opts.referenceSeries){
    const s=opts.referenceSeries;
    ctx.strokeStyle=s.color||"#eef2f7";ctx.globalAlpha=.9;ctx.lineWidth=2;
    ctx.beginPath();
    for(let i=0;i<s.values.length;i++){
      const y=s.values[i];
      const xx=plot.x+plot.w*(i/Math.max(1,s.values.length-1));
      const yy=plot.y+plot.h*(1-(y-ymin)/(ymax-ymin));
      if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
    }
    ctx.stroke(); ctx.globalAlpha=1;
  }

  ctx.strokeStyle="#465164";
  ctx.strokeRect(plot.x,plot.y,plot.w,plot.h);
  if(opts.yLabel){
    ctx.save();ctx.translate(15,plot.y+plot.h/2);ctx.rotate(-Math.PI/2);
    ctx.fillStyle="#9aa4b2";ctx.textAlign="center";ctx.fillText(opts.yLabel,0,0);ctx.restore();
  }
}

function drawHistogram(canvas, values, opts={}){
  const clean=values.filter(Number.isFinite);
  if(!clean.length) return;
  const s=summarize(clean);
  let min=s.min,max=s.max;
  if(min===max){min-=1;max+=1}
  const bins=clamp(opts.bins||CONFIG.histogramBins,10,100);
  const counts=Array(bins).fill(0);
  const width=(max-min)/bins;
  for(const v of clean){
    let b=Math.floor((v-min)/width);
    if(b===bins)b=bins-1;
    counts[clamp(b,0,bins-1)]++;
  }

  const {ctx,w,h}=resizeCanvas(canvas);
  ctx.clearRect(0,0,w,h);
  const p=CONFIG.chartPadding;
  const plot={x:p.left,y:p.top,w:w-p.left-p.right,h:h-p.top-p.bottom};
  const ymax=Math.max(...counts)*1.08;

  ctx.strokeStyle="#2a313d";ctx.fillStyle="#9aa4b2";ctx.font="11px system-ui";
  const yt=niceTicks(0,ymax,5);
  for(const t of yt){
    if(t<0||t>ymax)continue;
    const yy=plot.y+plot.h*(1-t/ymax);
    ctx.beginPath();ctx.moveTo(plot.x,yy);ctx.lineTo(plot.x+plot.w,yy);ctx.stroke();
    ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText(axisFormat(t),plot.x-8,yy);
  }

  const bw=plot.w/bins;
  for(let i=0;i<bins;i++){
    const bh=plot.h*(counts[i]/ymax);
    ctx.fillStyle="#5077c8";
    ctx.fillRect(plot.x+i*bw+1,plot.y+plot.h-bh,Math.max(1,bw-2),bh);
  }

  ctx.fillStyle="#9aa4b2";ctx.textAlign="center";ctx.textBaseline="top";
  for(let k=0;k<=4;k++){
    const xval=min+(max-min)*k/4;
    const xx=plot.x+plot.w*k/4;
    ctx.fillText(axisFormat(xval),xx,plot.y+plot.h+8);
  }

  // median
  const mx=plot.x+plot.w*(s.median-min)/(max-min);
  ctx.strokeStyle="#76d4b5";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mx,plot.y);ctx.lineTo(mx,plot.y+plot.h);ctx.stroke();

  ctx.strokeStyle="#465164";ctx.lineWidth=1;ctx.strokeRect(plot.x,plot.y,plot.w,plot.h);
  if(opts.xLabel){ctx.fillStyle="#9aa4b2";ctx.textAlign="center";ctx.fillText(opts.xLabel,plot.x+plot.w/2,h-14);}
}

/* ---------------- Index views ---------------- */
function drawIndexPaths(){
  if(!ensureData()) return;
  const count=Number($("indexPathCount").value)||30;
  const ids=sampleIndices(state.paths.length,count);
  const series=ids.map(i=>({values:state.paths[i],alpha:.42}));
  // 表示対象パスだけから中央値線を作る（全path×全stepのソートを避ける）
  const med=[];
  for(let t=0;t<state.steps.length;t++){
    const vals=ids.map(i=>state.paths[i][t]).sort((a,b)=>a-b);
    med.push(quantile(vals,.5));
  }
  drawLineChart($("indexPathsCanvas"),series,{
    xValues:state.steps,yLabel:"Index level",
    referenceSeries:{values:med,color:"#eef2f7"}
  });
}
function drawIndexHistogram(){
  if(!ensureData()) return;
  const t=stepIndexFromInput("indexDistStep");
  $("indexDistStep").value=t;
  const vals=state.paths.map(p=>p[t]);
  drawHistogram($("indexHistCanvas"),vals,{xLabel:`Index level @ step ${state.steps[t]}`});
  renderStats($("indexStats"),summarize(vals),false);
}

/* ---------------- Portfolio engine ---------------- */
function runPortfolio(){
  if(!ensureData()) return;
  const initial=Math.max(0,Number($("initialAmount").value)||0);
  const interval=Math.max(1,Math.round(Number($("intervalDays").value)||21));
  const recur=Math.max(0,Number($("recurringAmount").value)||0);
  const firstNow=$("firstRecurring").value==="now";

  const T=state.steps.length;
  const principalByStep=new Float64Array(T);

  let principal=initial;
  for(let t=0;t<T;t++){
    const recurringToday = firstNow ? (t % interval===0) : (t>0 && t % interval===0);
    if(recurringToday) principal += recur;
    principalByStep[t]=principal;
  }

  // 全path×全stepの資産額は保持しない。
  // 分布は指定時点だけ、折れ線は表示対象pathだけをオンデマンド計算する。
  state.portfolio={principalByStep,initial,interval,recur,firstNow};

  $("portfolioAssumption").textContent =
    `頭金 ${fmt0.format(initial)}、${interval} stepごとに ${fmt0.format(recur)} を積立。` +
    (firstNow ? "step 0にも積立額を追加。" : `最初の積立は step ${interval}。`) +
    " 指数そのものを1口=指数値で購入できる簡易モデルです。";

  drawPortfolioPaths();
  drawPortfolioHistogram();
  refreshCheckpointTable();
}

function portfolioValueAt(path, t, cfg=state.portfolio){
  let units = cfg.initial / path[0];
  if(cfg.firstNow) units += cfg.recur / path[0];

  // step 0 以降、購入日だけ走査
  const firstPurchase = cfg.firstNow ? cfg.interval : cfg.interval;
  for(let k=firstPurchase;k<=t;k+=cfg.interval){
    units += cfg.recur / path[k];
  }
  return units * path[t];
}

function portfolioPath(path, cfg=state.portfolio){
  const T=path.length;
  const out=new Float64Array(T);
  let units=cfg.initial/path[0];
  if(cfg.firstNow) units += cfg.recur/path[0];
  out[0]=units*path[0];

  for(let t=1;t<T;t++){
    if(t % cfg.interval===0) units += cfg.recur/path[t];
    out[t]=units*path[t];
  }
  return out;
}

function portfolioDistributionAt(t){
  const vals=new Array(state.paths.length);
  for(let p=0;p<state.paths.length;p++) vals[p]=portfolioValueAt(state.paths[p],t);
  return vals;
}

function portfolioSeriesForMode(pathValues,principalByStep,mode){
  if(mode==="profit") return Array.from(pathValues,(v,t)=>v-principalByStep[t]);
  if(mode==="ratio") return Array.from(pathValues,(v,t)=>principalByStep[t]>0?v/principalByStep[t]:NaN);
  return Array.from(pathValues);
}
function drawPortfolioPaths(){
  if(!state.portfolio){ if(ensureData()) runPortfolio(); return; }
  const count=Number($("portfolioPathCount").value)||30;
  const ids=sampleIndices(state.paths.length,count);
  const mode=$("portfolioViewMode").value;
  const series=ids.map(i=>{
    const vals=portfolioPath(state.paths[i]);
    return {values:portfolioSeriesForMode(vals,state.portfolio.principalByStep,mode),alpha:.42};
  });

  let ref=null;
  if(mode==="value"){
    ref={values:Array.from(state.portfolio.principalByStep),color:"#f2c66d"};
  } else if(mode==="profit"){
    ref={values:Array(state.steps.length).fill(0),color:"#f2c66d"};
  } else if(mode==="ratio"){
    ref={values:Array(state.steps.length).fill(1),color:"#f2c66d"};
  }

  drawLineChart($("portfolioPathsCanvas"),series,{
    xValues:state.steps,
    yLabel: mode==="ratio" ? "Portfolio / Principal" : (mode==="profit" ? "Profit / Loss" : "Portfolio value"),
    referenceSeries:ref
  });
}
function drawPortfolioHistogram(){
  if(!state.portfolio) return;
  const t=stepIndexFromInput("portfolioDistStep");
  $("portfolioDistStep").value=t;
  const vals=portfolioDistributionAt(t);
  drawHistogram($("portfolioHistCanvas"),vals,{xLabel:`Portfolio value @ step ${state.steps[t]}`});
  renderPortfolioStats(t,vals);
}

/* ---------------- Stats / checkpoints ---------------- */
function renderStats(el,s,isCurrency){
  const items=[
    ["P5",s.p5],["P25",s.p25],["Median",s.median],["Mean",s.mean],["P75",s.p75],["P95",s.p95]
  ];
  el.innerHTML=items.map(([k,v])=>`<div class="stat"><div class="k">${k}</div><div class="v">${isCurrency?fmt0.format(v):fmt.format(v)}</div></div>`).join("");
}
function renderPortfolioStats(t,vals){
  const s=summarize(vals);
  const principal=state.portfolio.principalByStep[t];
  const medianReturn=principal>0?s.median/principal-1:NaN;
  const pLoss=vals.filter(v=>v<principal).length/vals.length;
  const el=$("portfolioStats");
  const items=[
    ["投資元本",principal],
    ["P5",s.p5],["Median",s.median],["Mean",s.mean],["P95",s.p95],
    ["中央値損益率",medianReturn],
    ["元本割れ率",pLoss]
  ];
  el.innerHTML=items.map(([k,v])=>{
    let txt;
    if(k==="中央値損益率"||k==="元本割れ率") txt=Number.isFinite(v)?(v*100).toFixed(1)+"%":"—";
    else txt=fmt0.format(v);
    return `<div class="stat"><div class="k">${k}</div><div class="v">${txt}</div></div>`;
  }).join("");
}
function refreshCheckpointTable(){
  if(!state.portfolio) return;
  const raw=$("checkpointSteps").value.split(",").map(x=>Math.round(Number(x.trim()))).filter(Number.isFinite);
  const last=state.steps.length-1;
  const idxs=[...new Set(raw.map(x=>clamp(x,0,last)))].sort((a,b)=>a-b);
  const body=$("checkpointBody");
  body.innerHTML=idxs.map(t=>{
    const vals=portfolioDistributionAt(t);
    const s=summarize(vals);
    const principal=state.portfolio.principalByStep[t];
    return `<tr>
      <td>${state.steps[t]}</td><td>${fmt0.format(principal)}</td>
      <td>${fmt0.format(s.p5)}</td><td>${fmt0.format(s.p25)}</td>
      <td>${fmt0.format(s.median)}</td><td>${fmt0.format(s.mean)}</td>
      <td>${fmt0.format(s.p75)}</td><td>${fmt0.format(s.p95)}</td>
    </tr>`;
  }).join("");
}

/* ---------------- Events ---------------- */
const dz=$("dropZone");
dz.addEventListener("click",()=>$("fileInput").click());
dz.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" ") $("fileInput").click();});
["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("drag");}));
["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("drag");}));
dz.addEventListener("drop",e=>loadLocalFile(e.dataTransfer.files?.[0]));
$("fileInput").addEventListener("change",e=>loadLocalFile(e.target.files?.[0]));

$("reloadRemoteBtn").addEventListener("click",loadRemoteCsv);
$("redrawIndexBtn").addEventListener("click",drawIndexPaths);
$("indexDistStep").addEventListener("change",drawIndexHistogram);
$("indexFinalBtn").addEventListener("click",()=>{$("indexDistStep").value=state.steps.length-1;drawIndexHistogram();});

$("runPortfolioBtn").addEventListener("click",runPortfolio);
$("redrawPortfolioBtn").addEventListener("click",drawPortfolioPaths);
$("portfolioViewMode").addEventListener("change",drawPortfolioPaths);
$("portfolioDistStep").addEventListener("change",drawPortfolioHistogram);
$("portfolioFinalBtn").addEventListener("click",()=>{$("portfolioDistStep").value=state.steps.length-1;drawPortfolioHistogram();});
$("refreshCheckpointBtn").addEventListener("click",refreshCheckpointTable);

let resizeTimer=null;
window.addEventListener("resize",()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
    if(state.paths.length){drawIndexPaths();drawIndexHistogram();}
    if(state.portfolio){drawPortfolioPaths();drawPortfolioHistogram();}
  },120);
});

if(CONFIG.autoLoadRemote && CONFIG.remoteCsvUrl) loadRemoteCsv();
