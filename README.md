# Financial Path & DCA Simulator v8

v5を基に、時間粒度切替・分布比較・設定UIを改善した版です。

## v8 主な変更

- 「1年あたりstep数」をグラフ表示設定から変更可能（既定値252）。
- CSVの有効データ行が1,000行以下なら月次粒度とみなし、自動で `12 step = 1年`、DCA積立間隔を `1 step` に設定。
- 1,000行超では `252 step = 1年`、DCA積立間隔を `21 step` に設定。
- 年換算設定を時系列X軸、時系列ツールチップ、チェックポイント比較へ共通反映。
- Checkpointの手入力欄を削除し、1年・5年・10年相当を年換算設定から自動作成。
- 指数・積立のヒストグラムで、選択stepを青、最終stepを薄い紫の塗り＋紫枠で常時重ね描き。
- ヒストグラム同士は同じ対数X軸・同じビン境界で比較。
- 指数・積立の評価stepを共通化し、左サイドバーの1つの入力欄から上下ヒストグラムを同時に変更。
- 時系列グラフの値ツールチップは、線以外の場所をクリックすると閉じる。
- Path display / DCA設定を横並び中心のコンパクトUIへ変更。
- 色・線・時間軸設定ボタンを左サイドバー最下部へ移動。
- favicon、Android/ホーム画面用192px・512pxアイコン、Web App Manifestを追加。
- JS/CSS URLを `?v=8` に更新してキャッシュ混在を軽減。

## prepared data

`simulation_data/manifest.json` に公開CSV一覧を記載します。

```json
{
  "files": [
    {"file": "gbm.csv", "label": "GBM μ=7%, σ=18%"}
  ]
}
```

GitHub Pagesへは本ZIP内のファイル一式をそのまま配置できます。


## v7 changes
- CSV initial-load performance: reuse selected/final histogram distributions, cache index/DCA distributions, and capture final/checkpoint DCA distributions during the existing summary sweep.
- Both index and DCA histogram step inputs now redraw live (debounced) and always show the selected step in blue over the final-step purple background.
- Enlarged sidebar input/label text and numeric text in the appearance settings panel.


## v8 performance changes
- Histogram evaluation step is shared by index and DCA; changing it redraws both histograms together.
- Initial step remains the final step after CSV load. Intermediate-step distributions are calculated only when the user selects another step.
- When selected step equals the final step, the purple background histogram reuses the same log values and bin counts as the blue histogram instead of aggregating them twice.
- Histogram summary statistics reuse the already-computed full-series summary instead of sorting the final distribution again.
- DCA checkpoint table (1/5/10 years) reuses P25/P75/median/mean/CI values produced during the existing DCA summary sweep, eliminating separate checkpoint distribution sorts on initial load.
- <=1,000-row monthly auto-detection behavior remains unchanged.
