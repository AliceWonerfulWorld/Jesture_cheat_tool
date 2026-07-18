# Gesture-Controlled Display Product Blueprint

このドキュメントは、`Gesture Show!` と同じような仕組みのプロダクトを新しく作るための設計メモです。既存実装の構造をもとに、非接触ジェスチャー操作、回答表示ボード、複数端末同期、静的サイト配信を組み合わせたプロダクトの作り方をまとめています。

## 1. プロダクトの核

### 目的

カメラの前で手を動かすだけで、離れた場所から画面上のカードやボタンを操作できる Web アプリを作る。

想定例:

- ジェスチャーゲームの回答表示ボード
- イベント会場の非接触クイズ操作パネル
- 展示会や店舗のタッチレス案内画面
- 授業やワークショップ用の大画面インタラクション
- 演者用端末と観客用表示端末を同期する進行ツール

### 体験の中心

1. 手をカメラに映す。
2. 画面上に手の位置に連動したカーソルが出る。
3. カーソルをカードやボタンに重ねる。
4. グーなどの決定ジェスチャーで選択する。
5. 必要に応じて別端末へ状態を同期する。

このタイプのプロダクトでは、クリックできることよりも「離れた場所から迷わず操作できること」が重要です。画面は大きく、判定は寛容に、状態変化は一目でわかるようにします。

## 2. 推奨技術構成

### フロントエンド

- HTML5
- CSS
- JavaScript ES Modules
- ビルドなしの静的サイト構成

小規模なタッチレス表示アプリなら、React や Vue を入れなくても十分作れます。ビルドなしにすると、GitHub Pages などへそのまま配信しやすく、イベント当日の修正も軽くなります。

### 手検出

- MediaPipe Hands
- Web Camera API (`navigator.mediaDevices.getUserMedia`)
- `requestAnimationFrame` による描画・カーソル更新

MediaPipe Hands では、片手あたり21点のランドマークを取得できます。指先、関節、手首、手のひら中心に近い点を使って、カーソル位置やジェスチャーを判定します。

### 音

- Web Audio API

短い効果音なら外部音声ファイルを使わず、ブラウザ内でオシレーターから生成できます。読み込み失敗がなく、静的配信との相性も良いです。

### 複数端末同期

- PeerJS
- WebRTC DataChannel

操作端末を「送信機」、表示端末を「受信機」として扱います。送信機が状態を変更したら、受信機へ状態ペイロードを送ります。

本番利用では、固定 ID だけで同期先を決めると複数利用者が干渉しやすいため、ルーム ID や QR コード方式を用意するのが安全です。

## 3. 画面設計

### 基本画面

最低限の画面は2つです。

| 画面 | 役割 |
| --- | --- |
| HOME | カテゴリー、モード、コンテンツ群を選ぶ |
| GAME / DETAIL | 選択したカテゴリー内のカードや項目を表示する |

拡張する場合は以下を追加します。

| 画面 | 役割 |
| --- | --- |
| WAITING | カメラ、同期、接続待ち |
| ROOM | ルーム ID / QR コード表示 |
| SETTINGS | カメラ、音量、判定感度、同期方式 |
| RESULT | 結果、スコア、履歴表示 |

### UI の原則

- クリック対象は大きくする。
- 離れて見ても読める文字サイズにする。
- 選択済み、正解、現在位置などの状態を色と形で明確に出す。
- ホバー中は枠線、影、拡大などで反応を返す。
- 誤操作を避けたい操作には長押し、確認、クールダウンを入れる。

## 4. 推奨ファイル構成

```text
project/
  index.html
  style.css
  app.js
  src/
    state.js
    data.js
    ui.js
    gestures.js
    cursor.js
    audio.js
    sync.js
  README.md
```

### 各ファイルの責務

| ファイル | 責務 |
| --- | --- |
| `index.html` | DOM の土台、CDN 読み込み、画面コンテナ |
| `style.css` | レイアウト、カード、カーソル、カメラ表示、レスポンシブ |
| `app.js` | 初期化、イベント登録、各モジュール接続 |
| `src/state.js` | グローバル状態と DOM 参照 |
| `src/data.js` | カテゴリーや項目などの表示データ |
| `src/ui.js` | 画面描画、状態変更、ユーザー操作 |
| `src/gestures.js` | MediaPipe 初期化、手検出、ジェスチャー判定 |
| `src/cursor.js` | 手カーソルの追従、ホバー判定、決定発火 |
| `src/audio.js` | 効果音生成 |
| `src/sync.js` | P2P 同期、送信機・受信機の役割管理 |

## 5. 状態設計

中心になる状態は次のようにまとめます。

```js
const state = {
  currentScreen: 'HOME',
  activeCategory: null,
  selectedItems: new Set(),
  syncRole: 'loading',
  hands: [
    {
      cursor: { x: 0, y: 0 },
      targetCursor: { x: 0, y: 0 },
      isDetected: false,
      hoveredElement: null,
      isGestureActive: false,
      isGestureTriggered: false
    }
  ],
  lastGlobalGestureTime: 0,
  audioContext: null
};
```

### 設計ポイント

- `currentScreen` は UI の現在地を表す。
- `activeCategory` は詳細画面で表示中のデータを表す。
- `selectedItems` は選択済みの項目を保持する。
- `hands` は手ごとにカーソル、検出状態、ホバー対象、ジェスチャー状態を持つ。
- `isGestureTriggered` は同じグーのまま連続発火するのを防ぐ。
- `lastGlobalGestureTime` は合掌や拍手など、全体操作のクールダウンに使う。

## 6. 手カーソルの作り方

### 入力

MediaPipe Hands のランドマークから、手のひら中心に近い点を使います。

よく使う点:

- `landmarks[0]`: 手首
- `landmarks[8]`: 人差し指の先
- `landmarks[9]`: 手のひら中心に近い中指付け根
- `landmarks[12]`: 中指の先

### 座標変換

MediaPipe の座標は `0.0` から `1.0` の正規化座標です。画面座標へ変換します。

```js
targetCursor.x = (1 - landmark.x) * window.innerWidth;
targetCursor.y = landmark.y * window.innerHeight;
```

カメラ映像は鏡のように見せたいことが多いため、X 座標は `1 - x` にします。

### スムージング

検出座標をそのまま使うとカーソルが震えます。線形補間で少し遅れて追従させます。

```js
cursor.x += (targetCursor.x - cursor.x) * 0.25;
cursor.y += (targetCursor.y - cursor.y) * 0.25;
```

値が大きいほど反応は速く、小さいほどなめらかです。イベント用途なら `0.2` から `0.35` くらいが扱いやすいです。

## 7. ジェスチャー判定

### グー判定

4本指の指先が各関節より下にあるかで、指が折りたたまれているかを判定します。

```js
const indexFolded = landmarks[8].y > landmarks[6].y;
const middleFolded = landmarks[12].y > landmarks[10].y;
const ringFolded = landmarks[16].y > landmarks[14].y;
const pinkyFolded = landmarks[20].y > landmarks[18].y;

const isFist = indexFolded && middleFolded && ringFolded && pinkyFolded;
```

シンプルで動作しやすい一方、手の角度によって誤判定する場合があります。精度を上げたい場合は、指先と手のひら中心の距離、親指の状態、手の向きも合わせて見ます。

### 決定操作

決定操作には2方式あります。

| 方式 | 特徴 |
| --- | --- |
| 即時発火 | テンポが良い。誤操作は増えやすい |
| ホールド発火 | 安定する。操作は少し遅くなる |

イベント進行ツールや子ども向けゲームでは、誤操作が目立つならホールド発火が向いています。ホールド発火にする場合は、開始時刻と進捗率を状態に持ちます。

```js
if (isFist) {
  if (!fistStartTime) fistStartTime = Date.now();
  const progress = Math.min((Date.now() - fistStartTime) / 1000, 1);
  if (progress >= 1 && !isTriggered) {
    triggerAction();
    isTriggered = true;
  }
} else {
  fistStartTime = null;
  isTriggered = false;
}
```

### 戻る操作

両手の中心点の距離が一定以下になったとき、合掌や拍手として扱います。

```js
const a = hands[0][9];
const b = hands[1][9];
const dx = a.x - b.x;
const dy = a.y - b.y;
const dz = a.z - b.z;
const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
```

`distance < 0.08` のようなしきい値で判定できます。連続発火を避けるため、1秒から2秒程度のクールダウンを入れます。

## 8. UI 操作の流れ

### ホバー判定

カーソルの座標から、画面上の要素を取得します。

```js
const target = document.elementFromPoint(cursor.x, cursor.y);
const interactiveEl = target?.closest('.category-card, .word-card, button');
```

対象が見つかったら `hovered` クラスを付けます。対象が変わったら前のホバーを解除します。

### 選択発火

ジェスチャーが成立したら、対象要素の種類に応じて処理を分岐します。

```js
if (element.classList.contains('category-card')) {
  selectCategory(element.dataset.id);
} else if (element.classList.contains('word-card')) {
  toggleItem(element.dataset.index);
} else if (element.matches('[data-action="back"]')) {
  transitionTo('HOME');
}
```

DOM の見た目とアプリ状態を直接混ぜすぎないように、最終的な状態変更は `ui.js` の関数に寄せると保守しやすくなります。

## 9. 同期設計

### 役割

| 役割 | 説明 |
| --- | --- |
| sender | カメラとジェスチャー判定を行う操作端末 |
| viewer | 状態を受け取って表示だけする端末 |

送信機だけが MediaPipe とカメラを起動します。受信機はカメラを使わず、受け取った状態で UI を再描画します。

### 同期ペイロード

状態を丸ごと送るより、UI 再現に必要な最小データを送ります。

```js
const payload = {
  type: 'STATE_UPDATE',
  currentScreen: state.currentScreen,
  activeCategoryId: state.activeCategory?.id ?? null,
  selectedItems: Array.from(state.selectedItems)
};
```

受信側は `activeCategoryId` からローカルのデータを引き直し、`selectedItems` を `Set` に戻します。

### ルーム設計

実運用では、固定の Peer ID よりルーム ID 方式が向いています。

推奨:

1. 送信機がランダムなルーム ID を作る。
2. 画面にルーム ID と QR コードを表示する。
3. 受信機は URL パラメータからルーム ID を読む。
4. `gesture-room-${roomId}` のような Peer ID に接続する。

URL 例:

```text
https://example.com/?room=482913
```

これにより、同じ公開 URL を複数グループが同時に使いやすくなります。

## 10. 音設計

最低限あるとよい音:

| 音 | 用途 |
| --- | --- |
| hover | 操作対象に乗った |
| select | 選択が成立した |
| back | 戻る、合掌、画面遷移 |
| reset | リセットやキャンセル |

ブラウザは自動再生を制限するため、最初に「サウンド ON」ボタンを押して `AudioContext` を作る必要があります。

## 11. デザイン方針

### 離れて操作する画面

- カードは大きく、余白を広めにする。
- 視線誘導のためにホバー中の反応を強くする。
- 選択済み状態は背景色ごと変える。
- カメラ映像を背景に使う場合、UI の文字コントラストを十分に取る。
- 小さい操作ボタンはヘッダーや下部にまとめる。

### 大画面表示

- 16:9 のプロジェクターやテレビを前提に確認する。
- 文字が遠くから読めるかを優先する。
- スクロールが必要な画面は避ける。
- 項目数は1画面に収まる範囲にする。

### モバイル表示

受信機や確認用端末ではスマートフォン表示もありえます。操作端末としてスマートフォンを使う場合、手検出用のカメラ方向、画面の向き、端末スタンドの有無を考慮します。

## 12. 実装手順

### Step 1: 静的画面を作る

まずカメラやジェスチャーなしで、クリック操作だけで動く画面を作ります。

- カテゴリー一覧
- 詳細カード一覧
- 戻るボタン
- リセットボタン
- 選択済み表示

この段階でマウス操作だけで体験が成立していると、後からジェスチャーを載せやすくなります。

### Step 2: 状態管理を分ける

画面の表示状態を `state.js` に集約します。

- 現在画面
- 選択中カテゴリー
- 選択済み項目
- 音声状態

DOM 生成は `ui.js` に寄せます。

### Step 3: カメラと MediaPipe を入れる

MediaPipe Hands を CDN から読み込み、カメラ映像から手のランドマークを取得します。

確認すること:

- HTTPS または localhost で動いているか
- ブラウザのカメラ権限が許可されているか
- 手の検出数が画面に出るか
- 骨格線やデバッグ表示が期待通りか

### Step 4: 手カーソルを表示する

ランドマークの座標から DOM カーソルを動かします。

- X 座標の反転
- `requestAnimationFrame` のループ
- スムージング
- 手が消えたときの非表示

### Step 5: ホバーと決定をつなぐ

`document.elementFromPoint()` でカーソル下の要素を取得し、ジェスチャー成立時に既存の UI 関数を呼びます。

ここで「マウスクリックでも動く処理」と「ジェスチャーでも動く処理」を共通化できると、挙動のズレが少なくなります。

### Step 6: 音を追加する

選択、戻る、ホバーなどに短い効果音を付けます。音は楽しいだけでなく、離れた場所から操作できたかを確認するフィードバックになります。

### Step 7: 同期を追加する

必要なら PeerJS で送信機と受信機を分けます。

- 送信機だけカメラを起動する。
- 受信機はカメラ UI を隠す。
- 状態変更時にペイロードを送信する。
- 受信側はペイロードで画面を再描画する。

### Step 8: デプロイする

ビルドなしなら GitHub Pages で配信できます。

必要な条件:

- `index.html` がルートにある。
- CDN 依存が HTTPS で読み込める。
- カメラ利用のため公開 URL が HTTPS である。
- GitHub Pages の Source が GitHub Actions または branch deploy に設定されている。

## 13. よくある失敗と対策

### カメラが動かない

原因:

- `file://` で開いている
- HTTPS ではない
- ブラウザ権限が拒否されている
- CDN が読み込めていない

対策:

- ローカルでは `python -m http.server 8000` などで起動する。
- 本番は HTTPS の URL で配信する。
- DevTools の Console と Network を確認する。

### カーソルが左右逆

原因:

- カメラ映像の見た目とランドマーク座標の向きが合っていない

対策:

- カーソル用の X 座標を `1 - x` にする。
- カメラ映像にも `transform: scaleX(-1)` を付けるか検討する。

### グーが誤爆する

原因:

- 判定が即時発火
- 手の角度で折りたたみ判定が不安定
- ホバー対象が小さい

対策:

- 0.5秒から1秒のホールド発火にする。
- 発火後にクールダウンを入れる。
- 対象カードを大きくする。
- 指先と手のひら中心の距離も判定に加える。

### 複数端末同期が混ざる

原因:

- 全員が同じ固定 Peer ID を使っている

対策:

- ルーム ID を導入する。
- URL パラメータや QR コードで接続先を分ける。
- 送信機 ID にランダムな suffix を付ける。

### 受信側で画面が更新されない

原因:

- `Set` などがそのまま送信されている
- 受信後に再描画していない
- 接続開始直後の初期状態送信がない

対策:

- `Set` は配列に変換して送る。
- 受信側で `new Set(payload.selectedItems)` に戻す。
- 接続直後に現在状態を送る。

## 14. 拡張アイデア

### ルーム共有

- 送信機画面に QR コードを表示する。
- 受信機は QR コードから同じルームに参加する。
- URL に `?room=xxxxxx` を付ける。

### コンテンツ編集

- JSON ファイルでカテゴリーやカードを差し替えられるようにする。
- Google Sheets や CSV から読み込む。
- 管理画面で問題を編集する。

### 操作モード

- グーで選択
- パーでキャンセル
- 指差しでポインター
- 合掌で戻る
- 両手を広げてリセット

### 安全操作

- リセットは2秒ホールドにする。
- 戻る操作にクールダウンを入れる。
- 重要操作は画面端の大きな専用エリアに置く。

### 分析

- 選択履歴を保存する。
- 正解数や時間を表示する。
- CSV で結果を書き出す。

## 15. 最小実装チェックリスト

- [ ] クリック操作だけで全画面が動く
- [ ] カテゴリーや項目がデータから描画される
- [ ] カメラ権限を要求できる
- [ ] 手のランドマークを取得できる
- [ ] 手カーソルがなめらかに動く
- [ ] ホバー対象が視覚的にわかる
- [ ] 決定ジェスチャーで選択できる
- [ ] 同じジェスチャーで連続発火しない
- [ ] 戻るジェスチャーにクールダウンがある
- [ ] 音声をユーザー操作後に有効化できる
- [ ] 受信機へ状態を同期できる
- [ ] HTTPS 環境でカメラが動く
- [ ] 大画面とスマートフォンでレイアウトが崩れない

## 16. このリポジトリを参考にするときの注意

このリポジトリは、以下の特徴を持っています。

- グー判定は即時発火です。
- README にはホールド発火の説明が残っています。
- PeerJS の送信機 ID は固定です。
- `Set` は同期時に配列化しています。
- 受信機側ではカメラを非表示にしています。
- GitHub Pages にそのまま配信できる静的構成です。

同じ仕組みで別プロダクトを作るなら、まず「即時発火かホールド発火か」と「固定同期かルーム同期か」を決めるのが重要です。この2つが、現場での使いやすさを大きく左右します。

