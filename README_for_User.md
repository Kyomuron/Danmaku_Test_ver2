# プレースホルダー埋め込み 完全ガイド（ユーザー向け）

このガイドは、ゲームに同梱されている「プレースホルダー」（セリフ／オープニング／エンディング／立ち絵／BGM／ボイス）を、あなたの作品用に差し替える手順を丁寧に解説します。最短ルートのクイックスタートから、各種JSONの書き方、素材の推奨仕様、トラブルシューティングまで一冊化しました。

---

## 目次

1. はじめに（起動と基本の流れ）
2. どこに何を置くか（フォルダ構成）
3. まずは最短で差し替える（クイックスタート）
4. セリフの基本（自機別 A/B 分岐）
5. オープニング（タイトルから表示）
6. エンディング（最終面クリア後に表示）
7. 中ボス会話（既定OFF→JSONでON）
8. 立ち絵・アイコン（推奨サイズ／差し替え）
9. BGM（ステージ／ボス）
10. ボイス（任意／無音でも動作）
11. ステージJSONの全体像（ひな形）
12. テストとチェックリスト
13. よくある質問（FAQ）
14. 困ったときのトラブルシュート

---

## 1. はじめに（起動と基本の流れ）

- ローカルサーバーを起動
  - Python: `python3 -m http.server 8000`
  - Node: `npx http-server`
- ブラウザでアクセス: http://localhost:8000
- タイトルの右パネルから操作
  - 難易度／自機の選択
  - スペル練習（スペル選択→「☆ 練習開始」）
  - オープニングの表示（「▶ 表示」）
  - いつでも「🏠 タイトルへ」でメニューに戻れます
- ステージクリア
  - クリア演出（STAGE N CLEAR）
  - 最終面以外は約2.2秒後に自動で次ステージへ遷移

---

## 2. どこに何を置くか（フォルダ構成）

- ステージ定義: `stage/stageN.json`
- 画像
  - 立ち絵（各ステージ): `assets/stageN/`
  - 自機など共通: `assets/common/`
- BGM: `assets/bgm/`（例: `stage1.mp3`, `boss1.mp3`）
- ボイス: `assets/voice/stageN/`（例: `pre_001.mp3`）

推奨仕様（目安）
- 立ち絵: 240×360px（PNG推奨）
- アイコン: 36×36px（PNG推奨）
- BGM/ボイス: mp3 128kbps 程度

---

## 3. まずは最短で差し替える（クイックスタート）

1. ステージ1のオープニング文言を入れる
   - `stage/stage1.json` の `dialogue.opening` を編集
```json
"dialogue": {
  "opening": {
    "A": [ { "speaker": "player", "text": "オープニング" } ],
    "B": [ { "speaker": "player", "text": "オープニング" } ]
  }
}
```
2. ステージ5のエンディング文言を入れる
   - `stage/stage5.json` の `dialogue.ending` を編集
```json
"dialogue": {
  "ending": {
    "A": [ { "speaker": "player", "text": "エンディング_自機_A" } ],
    "B": [ { "speaker": "player", "text": "エンディング_自機_2" } ]
  }
}
```
3. タイトルで「オープニング ▶ 表示」を押して確認。ステージ5をクリアしてエンディングを確認。

ここまででオープニング/エンディングの流れが通ります。以降は細部を作り込んでいきます。

---

## 4. セリフの基本（自機別 A/B 分岐）

ボス前/後の会話は自機 A/B で出し分けできます。テキストはプレースホルダーのままでも動きます（あとで置換）。

```json
"dialogue": {
  "preBoss": {
    "A": [
      { "speaker": "player", "name": "プレイヤー", "text": "自機_A" },
      { "speaker": "boss",   "name": "ボス",       "text": "ボス_1" }
    ],
    "B": [
      { "speaker": "player", "name": "プレイヤー", "text": "自機_B" },
      { "speaker": "boss",   "name": "ボス",       "text": "ボス_1" }
    ]
  },
  "postBoss": {
    "A": [ { "speaker": "boss", "name": "ボス", "text": "ボス_1" } ],
    "B": [ { "speaker": "boss", "name": "ボス", "text": "ボス_1" } ]
  }
}
```
フィールド説明
- `speaker`: `player` or `boss`
- `name`: 表示名（省略可能、未指定なら自動表示）
- `text`: セリフ本文（`\n`で改行可）
- `voice`: 音声パス（任意。無くてもOK）

---

## 5. オープニング（タイトルから表示）

- 置き場所: `stage/stage1.json` の `dialogue.opening`
- 自機別（A/B）で分けたい場合はオブジェクト形式、共通で良ければ配列のみでもOK

```json
"dialogue": {
  "opening": {
    "A": [ { "speaker": "player", "text": "オープニング" } ],
    "B": [ { "speaker": "player", "text": "オープニング" } ]
  }
}
```
表示手順: タイトル右パネル→「オープニング ▶ 表示」

---

## 6. エンディング（最終面クリア後に表示）

- 置き場所: `stage/stage5.json` の `dialogue.ending`
- 自機別に `{ "A": [...], "B": [...] }` で指定

```json
"dialogue": {
  "ending": {
    "A": [ { "speaker": "player", "text": "エンディング_自機_A" } ],
    "B": [ { "speaker": "player", "text": "エンディング_自機_2" } ]
  }
}
```
最終面クリアで自動表示。BGMはエンディング用が再生されます。

---

## 7. 中ボス会話（既定OFF→JSONでON）

既定では中ボス会話はOFFです。以下のどちらかでONにします。

1) midBoss個別でON
```json
"midBosses": [
  {
    "time": 9.5,
    "dialogue": {
      "enabled": true,
      "pre": [
        { "speaker": "boss", "name": "中ボス", "text": "ボス_1" },
        { "speaker": "player", "name": "プレイヤー", "text": "自機_A" }
      ]
    },
    "patterns": [ ... ]
  }
]
```
2) ステージ共通でON
```json
"dialogue": {
  "preMidEnabled": true,
  "preMid": [ { "speaker": "boss", "text": "ボス_1" } ]
}
```

中ボスの立ち絵は `dialogue.midBossPortraits` を設定すると `preMid` 時に優先表示されます。

---

## 8. 立ち絵・アイコン（推奨サイズ／差し替え）

- 通常ボス（例）
```json
"dialogue": {
  "portraits": {
    "boss": {
      "normal":  "assets/stage3/boss.png",
      "damaged": "assets/stage3/boss_damaged.png",
      "icon":    "assets/stage3/boss_icon.png"
    },
    "player": {
      "normal":  "assets/common/player.png",
      "icon":    "assets/common/player_icon.png"
    }
  }
}
```
- 中ボス（優先）
```json
"dialogue": {
  "midBossPortraits": {
    "boss": {
      "normal": "assets/stage1/boss.png",
      "icon":   "assets/stage1/boss_icon.png"
    }
  }
}
```
推奨: 立ち絵 240×360px / アイコン 36×36px（PNG）

---

## 9. BGM（ステージ／ボス）

- ステージとボスをまとめて指定
```json
"bgm": {
  "stage": "assets/bgm/stage1.mp3",
  "boss":  "assets/bgm/boss1.mp3"
}
```
- `boss.bgm` に直接書いてもOK

開発時は `?nobgm` / `?assets=none` で軽量化できます。

---

## 10. ボイス（任意／無音でも動作）

- 各セリフ行に `voice` を追加（mp3推奨）
- 無い場合はスキップされ、ゲームは問題なく進行
- 例: `"voice": "assets/voice/stage2/pre_001.mp3"`

---

## 11. 戦闘中スプライト（ボス/中ボス）

- 会話立ち絵を戦闘中にも自動流用（設定不要）
  - ボス: `dialogue.portraits.boss.normal` を使用（`damaged` は postBoss の会話のみ）
  - 中ボス: `dialogue.midBossPortraits.boss.normal`（なければ `portraits.boss.normal`）
- 表示倍率: 既定 0.4 倍
  - 変更したい場合は `js/entities/boss.js` の `spriteScale` を編集（ボス/中ボス共通）

---

## 12. ステージJSONの全体像（ひな形）

```json
{
  "scrollSpeed": 70,
  "dialogue": {
    "portraits": { ... },
    "opening": { "A": [ ... ], "B": [ ... ] },
    "preBoss": { "A": [ ... ], "B": [ ... ] },
    "postBoss": { "A": [ ... ], "B": [ ... ] },
    "preMidEnabled": false,
    "preMid": [ ... ],
    "midBossPortraits": { ... },
    "ending": { "A": [ ... ], "B": [ ... ] }
  },
  "waves": [ ... ],
  "midBosses": [ ... ],
  "boss": {
    "spawn": { "x": 240, "y": -40 },
    "path":  { "type": "easeInOut", "to": { "x": 240, "y": 130 }, "t": 2.2 },
    "damagePerHit": 3,
    "spells": [ ... ],
    "bgm": "assets/bgm/bossN.mp3"
  },
  "bgm": { "stage": "assets/bgm/stageN.mp3", "boss": "assets/bgm/bossN.mp3" }
}
```

---

## 13. テストとチェックリスト

- [ ] タイトルで難易度/自機/練習/オープニングが見える
- [ ] オープニングを表示できる（A/B切替でも表示）
- [ ] ステージ開始：右パネルの表示が選択内容に一致
- [ ] 中ボス会話（ONにした場合）で立ち絵/ボイスが出る
- [ ] ボス前/後の会話（A/B）で分岐できる
- [ ] CLEAR オーバーレイ→最終面以外は自動で次へ
- [ ] ステージ5クリアでエンディングが表示
- [ ] BGM/ボイスの音量・長さに違和感がない

---

## 14. よくある質問（FAQ）

**Q. 文字が表示されない／エラーが出る**
- JSONの構文エラーの可能性。Console（DevTools）で赤いログを確認し、行番号のファイルを修正してください。

**Q. 画像/音声が再生されない**
- Networkタブで 404（Not Found）が出ていないか確認。パスやファイル名の大文字小文字にも注意。

**Q. 中ボスが出ない／会話が始まらない**
- `midBosses[].time` が早すぎないか、`dialogue.enabled` を付けたか、`preMidEnabled` を設定したかを確認。

---

## 15. 困ったときのトラブルシュート

1. DevTools（Command+Option+I）を開く
2. Network: `Disable cache` にチェック→再読み込み
3. `stage/stageN.json` を直接開いて内容が見えるか確認（例: http://localhost:8000/stage/stage1.json）
4. Console: Uncaught エラーのファイル名/行番号を確認して修正
5. 軽量モードで検証: `?assets=none` / `?nobgm&novoice`

---

これでプレースホルダーから本番アセットへの差し替えがスムースに進むはずです。文言・絵・音が入ると、体験が一気に立ち上がります。つまずいた箇所や拡張のご希望（字幕スタイル、スキップ挙動、SE追加など）があれば、いつでもお知らせください。

---

## 16. 高度な調整（ボスの移動／弾幕の速度）

細かなゲーム性のチューニングは、主に「ステージJSON」と「`js/config.js`（難易度プリセット）」の2ヵ所で行います。代表的な調整ポイントをまとめます。

### 16.1 ボスの移動（到着パス→巡回）

- 出現〜到着（到着パス）
  - `boss.path.type: "easeInOut"` を使うと、`spawn` → `path.to` に向かって滑らかに移動します。
  - 例：
    ```json
    "boss": {
      "spawn": { "x": 240, "y": -40 },
      "path":  { "type": "easeInOut", "to": { "x": 240, "y": 140 }, "t": 2.0 }
      ...
    }
    ```

- 到着後の巡回（横移動＋上下ホバー）
  - `boss.patrol` を指定できます（省略可）。
  - フィールド：
    - `ampX` … 左右の振れ幅（px）
    - `speedX` … 水平移動速度（px/s）
    - `ampY` … 上下の振れ幅（px）
    - `speedY` … 上下の速度（rad/s）
  - 例：
    ```json
    "boss": {
      ...,
      "patrol": { "ampX": 180, "speedX": 130, "ampY": 10, "speedY": 1.4 }
    }
    ```

中ボス（`midBosses[]`）にも同様に `spawn` / `path` / `patrol` を設定できます。

### 16.2 弾幕の速度・テンポ（パターン）

各パターン共通の主要プロパティ：
- `type`: `spread` / `spiral` / `reverseSpiral` / `target` / `wave` / `flower` / `burst` / `butterfly` / `homing` / `laser` / `crossLaser`
- `every`: 発射間隔（秒）
- `count`: 同時発射数
- `speed`: 弾速（px/s）
- `angleCenter`: 中心角度（度）
- `angleWidth`: 扇の幅（度）
- `angVel`: 角速度（`spiral`/`reverseSpiral`）
- `bullet`: 形状・見た目
  - `shape`: `circle` / `ring` / `diamond` / `arrow` / `star` / `heart` / `butterfly` / `orb`
  - `r`: 半径
  - `color`: 色（テーマ有効時は内部でレトロパレットに量子化）

例（ボスのスペル）：
```json
"spells": [
  {
    "name": "スペルカード1",
    "time": 30,
    "pattern": {
      "type": "spiral",
      "every": 0.05,
      "speed": 180,
      "angVel": 280,
      "bullet": { "shape": "star", "r": 3.6, "color": "#fbbf24" }
    }
  }
]
```

`reverseSpiral` は `spiral` の反転（`angVel` の符号が逆）として扱われます。

### 16.3 難易度ごとの全体倍率（テンポ＆弾速＆弾数）

`js/config.js` の `DIFF_PRESETS` で難易度ごとの全体倍率を調整できます。

- `bulletSpeedMul`: 弾速の全体倍率
- `patternEveryMul`: 発射間隔の全体倍率（<1.0 で速く、>1.0 で遅く）
- `patternCountMul`: 発射弾数の全体倍率

例：
```js
normal: {
  label: 'ふつう',
  ...,
  bulletSpeedMul: 1.00,
  patternEveryMul: 1.00,
  patternCountMul: 1.0
}
```

ステージごとの微調整（例：ステージ1だけ少し易しめ）をしたい場合は `STAGE_DIFF_TWEAKS`（同ファイル）で上書きできます。

### 16.4 ボス出現のタイミング

`js/config.js` の `PRE_BOSS_SILENCE`（秒）を使って、雑魚終了後～ボス登場までの静寂を調整します。内部では「最後のイベント時刻＋静寂」が到達したら、フィールドが静かになったタイミングでボスが確実に登場します。

---

## 17. さらに一歩（見た目の調整）

見やすさのためのパラメータ（`js/config.js`）
- `ENEMY_BULLET_SIZE_MUL` … 敵弾の半径倍率（小弾の視認性アップ）
- `ENEMY_BULLET_MIN_R` … 敵弾の最小半径

自機の被弾表現（`js/entities/player.js`）
- 無敵時間中は点滅するようになっています。点滅の速さを変える場合は、`Math.sin(t*20)` の数値を調整します（例：16でゆっくり、24で速く）。

---

上記を組み合わせることで、ボスの立ち位置（激しい巡回 or 緩いホバー）、弾幕のテンポ（密度/角速度/発射間隔）まで柔軟にコントロールできます。値の大小が直感と逆になる箇所（`every` は小さいほど速い等）に気をつけながら、少しずつ調整してみてください。必要であれば、目的の遊び心地に合わせたパラメータ例もご提案します。
