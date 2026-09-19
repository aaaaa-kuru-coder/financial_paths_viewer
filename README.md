# Financial Path & DCA Simulator

GitHub Pages向けの静的Webアプリです。

## ファイル構成

- `index.html` : ページ構造
- `style.css` : デザイン
- `config.js` : データ読込等の設定
- `app.js` : CSV読込、描画、積立計算などの処理本体

## GitHub Pages

リポジトリ直下に4ファイルを置き、Pagesの公開元を `main / (root)` にするとそのまま使えます。

## ローカルCSV利用

初期設定では `config.js` の `autoLoadRemote` が `false` です。
ページ上部にCSVをドラッグ&ドロップしてください。

CSV形式:

```csv
step,path_0,path_1,path_2
0,100,100,100
1,101,99,100.5
2,102,98,101
```

## GitHub上のCSV自動読込

例として `data/simulation_paths.csv` を置く場合、`config.js` を以下のように変更します。

```js
window.CONFIG = {
  autoLoadRemote: true,
  remoteCsvUrl: "./data/simulation_paths.csv",
  histogramBins: 40,
  maxPathsForRendering: 200,
  chartPadding: {left:72,right:18,top:16,bottom:42},
};
```

Pages公開領域に置いたCSVは公開データになります。
