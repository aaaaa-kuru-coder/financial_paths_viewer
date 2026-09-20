"use strict";

window.CONFIG = {
  preparedManifestUrl: "./simulation_data/manifest.json",
  histogramBins: 42,
  maxNeighborPathsPerSide: 100,
  symlogLinearThreshold: 10000,
  chartPadding: {left:86,right:24,top:18,bottom:72},
  styleStorageKey: "financialPathSimulator.style.v3",
  uiStorageKey: "financialPathSimulator.ui.v3"
};

window.DEFAULT_STYLE = {
  centerColor: "#d946ef",
  centerWidth: 3.2,
  beforeColor: "#ff5669",
  afterColor: "#489bff",
  neighborAlpha1: 0.72,
  neighborAlpha2: 0.16,
  neighborWidth: 1.15,
  medianColor: "#72e6b6",
  medianWidth: 2.1,
  meanColor: "#ffd166",
  meanWidth: 2.1,
  ciColor: "#9b7bff",
  ciAlpha: 0.16,
  portfolioYCapMultiplier: 1.2,
  gridColor: "#2a313d",
  axisColor: "#aab4c2",
  frameColor: "#465164"
};
