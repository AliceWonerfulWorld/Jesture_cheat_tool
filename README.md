# Jesture Show Control

`PRODUCT_BLUEPRINT.md` を元にした、カメラ前の手ジェスチャーで大きな表示ボードを操作するジェスチャーゲーム用の静的 Web アプリです。

## 機能

- 6ジャンルのカテゴリー選択
- ジャンルごとのお題カード選択
- マウス / タッチ操作
- MediaPipe Hands による手カーソル
- グーのホールドによる決定操作
- 両手を近づける戻る操作
- ホールド時間とカーソル追従の調整
- カメラプレビューの表示切り替え
- 全画面表示
- Web Audio API の短い効果音
- PeerJS + WebRTC DataChannel のルーム同期

## 起動

```bash
python3 -m http.server 8010
```

ブラウザで開きます。

```text
http://127.0.0.1:8010/
```

カメラ機能は `localhost` または HTTPS の URL で動きます。CDN から MediaPipe Hands と PeerJS を読み込むため、初回利用時はインターネット接続が必要です。

## 使い方

- `Start Camera`: カメラと手検出を開始
- `Sound ON`: 効果音を有効化
- `Sender`: 操作端末としてルームを開く
- `Viewer`: 表示端末として `?room=xxxxxx&role=viewer` に接続
- `Solo`: 同期なしで操作
- `Copy URL`: 表示端末用 URL をコピー
- `Hold`: グーを維持して決定するまでの時間
- `Smooth`: 手カーソルの追従速度
- `Camera preview`: カメラ映像と骨格表示の表示切り替え

カード上でグーを約 0.7 秒ホールドすると選択できます。クリック操作でも同じ画面遷移を確認できます。

## お題ジャンル

- 動物
- 職業
- スポーツ動作
- 日常動作
- 感情・状態
- 面白系
