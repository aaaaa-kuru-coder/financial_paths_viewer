# Financial Path & DCA Simulator v3

## 追加機能

- `simulation_data/` のprepared CSVをUIから選択して読込
- パス・中央値・平均・信頼区間の色/太さ/透明度をUI設定
- 近接パス透明度1 → 遠端透明度2を線形補間
- グラフ設定をブラウザ `localStorage` に保存
- 対数補助目盛: 2, 4, 6, 8 × 10^n
- 積立グラフの表示上限を最終時点上側信頼限界 × 倍率で制限
- ヒストグラムのビンをクリックすると範囲・本数・累積本数/パーセンタイルを表示
- 前後パス本数を1つの設定欄へ統合
- 軸表示を `10.0k` ではなく `10,000` 形式へ変更
- 長いX軸ラベルは90度回転

## prepared data

GitHub Pagesの静的サイトは `simulation_data/` 内を自動列挙できません。
そのため `simulation_data/manifest.json` に公開CSV一覧を記載します。

例:

```json
{
  "files": [
    {
      "file": "gbm_mu7_sigma18.csv",
      "label": "GBM: μ=7%, σ=18%"
    },
    {
      "file": "synthetic_regime_model.csv",
      "label": "Synthetic regime model"
    }
  ]
}
```

リポジトリ例:

```text
repo/
├─ index.html
├─ style.css
├─ config.js
├─ utils.js
├─ data.js
├─ charts.js
├─ portfolio.js
├─ app.js
└─ simulation_data/
   ├─ manifest.json
   ├─ gbm_mu7_sigma18.csv
   └─ synthetic_regime_model.csv
```

CSV形式:

```csv
step,path_0,path_1,path_2
0,100,100,100
1,101,99,100.5
2,102,98,101
```

## 設定保存

グラフ表示設定は `localStorage` に保存されます。
これはGitHubリポジトリへ送信されず、そのブラウザ・そのGitHub Pages origin 内にだけ保存されます。

注意:
- 同じ端末・同じブラウザでも、サイトデータを消せば設定は消えます。
- 同じGitHub Pages origin 上の別JavaScriptからは同じlocalStorageへアクセスできるため、「暗号化された秘密領域」ではありません。機密情報は保存しないでください。

## 積立グラフのY軸

資産額/投資元本比の上限は、最終時点の上側信頼限界 × `portfolioYCapMultiplier`（初期1.2）を目安に制限します。
統計計算から外れ値を除外するわけではなく、表示だけをクリップします。

損益額は負値を含むためsymlogを使います。

## GitHub Pages

ファイル一式をリポジトリ直下に置いて `main / (root)` からPages公開できます。
