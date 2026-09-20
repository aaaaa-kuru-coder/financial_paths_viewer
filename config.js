"use strict";

window.CONFIG = {
  // GitHub Pages上の公開用CSVを自動読込する場合だけ true。
  autoLoadRemote: false,
  remoteCsvUrl: "",

  histogramBins: 42,
  maxNeighborPathsPerSide: 100,

  // symlog: 損益額など負値を含む系列だけに利用。
  symlogLinearThreshold: 10000,

  chartPadding: {left:76,right:22,top:18,bottom:46},

  colors: {
    center: "#d946ef",
    before: [255, 86, 105],
    after: [72, 155, 255],
    median: "#72e6b6",
    mean: "#ffd166",
    ciFill: "rgba(155,123,255,0.16)",
    ciEdge: "rgba(178,153,255,0.85)",
    grid: "#2a313d",
    axis: "#9aa4b2",
    frame: "#465164"
  }
};
