# 弾幕シューティングゲーム

ブラウザで動作する弾幕シューティングゲームです。HTML5 Canvas APIとWeb Audio APIを使用した、東方Project風の弾幕STGエンジンです。

## 特徴

### ゲームシステム

- **5ステージ構成** - 各ステージに独自の敵配置とボス
- **難易度選択** - かんたん / ふつう / むずかしい
- **自機選択** - Aタイプ / Bタイプ
- **スペルカードシステム** - ボスの必殺技パターン
- **スペル練習モード** - 個別のスペルカードを練習可能
- **会話システム** - ボス戦前後の会話イベント（立ち絵対応）

### グラフィック・サウンド

- **60FPS描画**
- **フリーBGM** - タイトル/ステージ/ボス/エンディング別BGM
- **効果音** - Web Audio APIによる生成
- **エフェクト** - ボム発動時の視覚効果
- **スプライト描画** - 戦闘中のボスも画像で表示（会話立ち絵を自動流用）

### プレイ要素

- **パワーアップ** - アイテムで自機強化（最大4段階）
- **エクステンド** - スコアとかけらによる残機増加
- **グレイズ** - 被弾スレスレで避けるとボーナス点
- **ボム** - 緊急回避（自機タイプで効果が異なります）
- **デスボム** - 被弾時の緊急ボム発動

## 操作方法

| キー     | 動作                 |
| -------- | -------------------- |
| 矢印キー | 自機移動             |
| Z        | ショット             |
| X        | ボム                 |
| Shift    | 低速移動（精密操作） |
| P        | ポーズ               |
| Enter    | 決定 / 会話を進める  |
| Esc      | スキップ             |
| C        | ボイス停止（会話中） |
| V        | ボイスON/OFF切替     |

## ディレクトリ構造

```
danmaku-game/
├── index.html              # メインゲームファイル
├── stage/                  # ステージデータ
│   ├── stage1.json
│   ├── stage2.json
│   ├── stage3.json
│   ├── stage4.json
│   └── stage5.json
└── assets/                 # アセット
    ├── bgm/                # BGMファイル
    │   ├── title.mp3       # タイトル画面BGM
    │   ├── ending.mp3      # エンディングBGM
    │   ├── stage1.mp3      # ステージ1 BGM（任意）
    │   ├── stage2.mp3      # ステージ2 BGM（任意）
    │   ├── stage3.mp3      # ステージ3 BGM（任意）
    │   ├── stage4.mp3      # ステージ4 BGM（任意）
    │   ├── stage5.mp3      # ステージ5 BGM（任意）
    │   ├── boss1.mp3       # ボス1 BGM（任意）
    │   ├── boss2.mp3       # ボス2 BGM（任意）
    │   ├── boss3.mp3       # ボス3 BGM（任意）
    │   ├── boss4.mp3       # ボス4 BGM（任意）
    │   └── boss5.mp3       # ボス5 BGM（任意）
    ├── voice/              # ボイス音声（任意・無くても動作）
    │   ├── stage1/...
    │   ├── stage2/...
    │   └── common/...
    ├── common/             # 共通画像
    │   ├── player.png      # プレイヤー立ち絵
    │   └── player_icon.png # プレイヤーアイコン
    └── stage1-5/           # 各ステージの立ち絵
        ├── boss.png        # ボス通常立ち絵
        ├── boss_damaged.png # ボスダメージ立ち絵
        └── boss_icon.png   # ボスアイコン
```

## セットアップ

### 1. ファイルの配置

上記のディレクトリ構造に従ってファイルを配置します。

### 2. ローカルでの実行

CORS制限を回避するため、ローカルサーバーを起動：

```bash
# Python 3の場合
python -m http.server 8000

# Node.jsの場合
npx http-server

# PHPの場合
php -S localhost:8000
```

ブラウザで `http://localhost:8000` にアクセス

## ステージJSONの構造

### 基本構造

```json
{
  "scrollSpeed": 60,
  "bgm": "assets/bgm/stage1.mp3",
  "dialogue": { ... },
  "waves": [ ... ],
  "midBosses": [ ... ],
  "boss": { ... }
}
```

### 敵ウェーブの定義

```json
"waves": [
  {
    "time": 1.0,        // 出現時刻（秒）
    "count": 4,         // 敵の数
    "every": 0.7,       // 出現間隔（秒）
    "enemy": {
      "spawn": { "x": 60, "y": -20 },
      "path": { "type": "line", "vx": 40, "vy": 80 },
      "hp": 30,
      "duration": 7,
      "pattern": {
        "type": "spread",    // spread/spiral/target
        "every": 0.8,
        "count": 5,
        "angleCenter": 100,
        "angleWidth": 40,
        "speed": 170,
        "bullet": {
          "shape": "circle",  // circle/ring/diamond/arrow/star/heart
          "r": 3,
          "color": "#7dd3fc"
        }
      }
    }
  }
]
```

### ボスの定義

```json
"boss": {
  "spawn": { "x": 240, "y": -40 },
  "path": { "type": "easeInOut", "to": { "x": 240, "y": 140 }, "t": 2.0 },
  "damagePerHit": 3,
  "patrol": {
    "ampX": 180,   // 左右の振れ幅（中心からのpx）。省略時はステージ番号に応じて自動拡大
    "speedX": 130, // 水平移動速度（px/s）
    "ampY": 10,    // 前後（上下）の振れ幅（px）
    "speedY": 1.4  // 前後（上下）の速度（rad/s）
  },
  "ambient": {
    "enabled": true,
    "type": "burst",
    "every": 0.55,
    "count": 16,
    "speed": 160,
    "shape": "orb",
    "color": "#93c5fd"
  },
  "spells": [
    {
      "name": "花符『スプリングブロッサム』",
      "hp": 1400,
      "time": 32,
      "bonus": 100000,
      "pattern": { ... }
    }
  ]
}
```

### 会話の定義

```json
"dialogue": {
  "portraits": {
    "boss": {
      "normal": "assets/stage1/boss.png",
      "damaged": "assets/stage1/boss_damaged.png",
      "icon": "assets/stage1/boss_icon.png"
    },
    "player": {
      "normal": "assets/common/player.png",
      "icon": "assets/common/player_icon.png"
    }
  },
  "preBoss": [
    { "speaker": "player", "name": "プレイヤー", "text": "hogehoge", "voice": "assets/voice/stage1/pre_001.mp3" },
    { "speaker": "boss",   "name": "ボス",       "text": "hogehoge", "voice": "assets/voice/stage1/pre_002.mp3" }
  ],
  "postBoss": [
    { "speaker": "boss",   "name": "ボス",       "text": "hogehoge", "voice": "assets/voice/stage1/post_001.mp3" }
  ]
}

### 戦闘中スプライト描画（ボス/中ボス）

- 会話用 `dialogue.portraits.boss.normal/damaged` を戦闘中スプライトにも自動流用します。
- 中ボス会話用 `dialogue.midBossPortraits.boss.normal/damaged` がある場合、中ボスの戦闘スプライトに流用されます。
- 既定の表示倍率は 0.4（`js/entities/boss.js` の `spriteScale`）。
- 戦闘中は damaged 画像は使わず、postBoss（会話）でのみ `damaged` を表示します。
```

## 弾幕パターンタイプ

| タイプ          | 説明                                   |
| --------------- | -------------------------------------- |
| `spread`        | 扇状に広がる弾幕                       |
| `spiral`        | 回転しながら発射する弾幕               |
| `reverseSpiral` | 背後方向へ反転スパイラル               |
| `target`        | 自機狙い弾                             |
| `wave`          | 角度/速度に波形のゆらぎを持つ連射       |
| `flower`        | 花びら状に層を成す美麗パターン         |
| `butterfly`     | 不規則に舞う挙動（可変軌道）           |
| `homing`        | ホーミング弾（一定時間プレイヤー追尾） |
| `burst`         | 円形に一斉噴出するバースト             |
| `laser`         | 予告→照射のレーザー                     |
| `crossLaser`    | 十字方向に走るレーザー                 |

### パターン共通オプション（任意）

- `backfire`: `true` で同一弾を180°反転方向にも同時発射（画面を満たす“裏側”の弾幕）
- `backfireSpeedMul`: 反転弾の速度倍率（デフォルト=1.0）

## 弾の形状

| 形状        | 説明         |
| ----------- | ------------ |
| `circle`    | 通常の円形弾 |
| `ring`      | リング状の弾 |
| `diamond`   | ダイヤ型の弾 |
| `arrow`     | 矢印型の弾   |
| `star`      | 星型の弾     |
| `heart`     | ハート型の弾 |
| `butterfly` | 蝶型の弾     |
| `orb`       | 発光球       |

## 🔧 カスタマイズ

### 難易度調整

`js/config.js` 内の `DIFF_PRESETS` オブジェクトを編集：

```javascript
const DIFF_PRESETS = {
  easy: {
    playerLives: 5,      // 初期残機
    playerBombs: 3,      // 初期ボム
    bulletSpeedMul: 0.95, // 弾速倍率
    enemyHpMul: 0.9,     // 敵HP倍率
    // ...
  }
}
```

### URLパラメータ

- `?stage=3` - ステージ3から開始
- `?diff=hard` - 難易度ハードで開始
- `?ship=B` - Bタイプ自機で開始

### JSON同期とバリデーション（任意）

エンジン側の変更（パターンタイプ名のリネーム、弾形状名の変更、デフォルト値の追加など）をステージJSONに反映したい場合、下記CLIで一括チェック・反映が可能です。分割後は `js/` 配下のモジュール（`js/game.js`, `js/entities/bullet.js`）から対応中のパターンと形状を抽出します。

- dry-run（差分のみ表示）

```
node tools/sync-stage-json.mjs
```

- 反映（`tools/sync-rules.json`に基づき変更を書き込み）

```
node tools/sync-stage-json.mjs --apply
```

- BGMフィールドをステージ番号に応じて自動付与（未設定のみ）

```
node tools/sync-stage-json.mjs --set-bgm --apply
```

カスタム変換ルールは `tools/sync-rules.json` を編集してください（初回実行時にサンプルが生成されます）。例えば、エンジン内で `reverseSpiral` を `spiral` に改名した場合は次のように記述します。

```json
{
  "typeRename": { "reverseSpiral": "spiral" },
  "shapeRename": { "rhombus": "diamond" },
  "setDefaults": {
    "every": null,
    "count": null,
    "speed": null,
    "bullet": { "shape": null, "r": null, "color": null }
  }
}
```

このCLIは `index.html`から対応中のパターンタイプと弾形状を抽出し、未知の値を検出して警告します。ルールにリネームを追加して `--apply` で反映してください。

## サンプル台詞/ボイス（プレースホルダー）

- 各ステージJSON（`stage/stage1.json`〜`stage/stage5.json`）には、`dialogue`配下に仮の台詞を同梱しています。
  - `preBoss`（ボス前）、`postBoss`（ボス後）
  - 各行に `voice` を付与済み（例: `assets/voice/stageN/pre_001.mp3`）。
- 音声ファイルは任意です。未配置でもゲームは動作し、再生失敗は無視されます。
- 差し替え方法:
  - 台詞テキストを修正し、`voice`に実際の音声ファイルパスを指定
  - 右パネルの「🎤 ON/OFF」でボイス有効/無効を切替、会話中は`C`で停止・`V`で切替

## 必要な素材

### BGM（MP3形式推奨）

- タイトル画面用BGM
- エンディング用BGM
- 各ステージ用BGM（任意）
- 各ボス用BGM（任意）

### 画像（PNG形式推奨）

- キャラクター立ち絵: 240×360px程度
- アイコン: 36×36px

## ブラウザ対応

- Chrome (推奨)
- Firefox
- Safari
- Edge

※ Internet Explorer非対応

## 謝辞

- 東方Projectにインスパイアされたゲームシステム
- Web Audio API
- HTML5 Canvas API

## お問い合わせ

Xアカウント ((at) kyomunon_dotcom) のDMもしくはメール (mero.mero.merod(at)gmail.com) にて、お気軽にご連絡ください。
### フルボイス対応（任意）

- 各会話行に `voice` プロパティ（音声ファイルのURL）を追加可能。
- 音声が無くても動作（再生失敗は無視）。
- 会話中は以下が可能：
  - C: 現在のボイスを停止（テキストはそのまま）
  - V: ボイスON/OFF切替（設定はローカルに保存）
  - Z/Enter/Space: 次の行へ進む（進む際に再生中のボイスは停止）
  - X/Esc: 会話スキップ（ボイスも停止）
  - 右パネル「⏭ スキップ」: 現在のセリフを飛ばして次へ（ボイスも停止）
### フィールド（画面外）攻撃の設定（任意）

`stage.edgeAttacks` で、敵がいなくても画面外から弾を流し込む“フィールド攻撃”を有効化できます。デフォルトはハードのみ有効化（`hardOnly: true`）。

```json
"edgeAttacks": {
  "enabled": true,
  "hardOnly": true,
  "period": 2.4,        // 発射間隔（秒） 省略時はステージ番号に応じて自動調整
  "types": ["rear", "sides", "topFan"]
}
```

- `rear`: 画面下から上方向（背面）にライン状に発射
- `sides`: 左右の画面外から交互に中央へ向けて射出
- `topFan`: 上部から扇状に流し込み

未指定時の既定値はステージ番号に応じて段階的に強化されます。`hardOnly: false` にすれば、他の難易度でも適用可能です。
