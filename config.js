"use strict";

/*
  GitHub Pages で公開用CSVを自動読込したい場合:
    autoLoadRemote: true
    remoteCsvUrl: "./data/simulation_paths.csv"

  ローカルCSVをドラッグ&ドロップして使うだけなら:
    autoLoadRemote: false
    remoteCsvUrl: ""
*/
window.CONFIG = {
  autoLoadRemote: false,
  remoteCsvUrl: "",
  histogramBins: 40,
  maxPathsForRendering: 200,
  chartPadding: {left:72,right:18,top:16,bottom:42},
};
