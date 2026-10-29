# タスク管理表

担当の5つのまとまりごとに、タスク、担当、着手日、完了日、状態をまとめた表です。

- **着手日**：そのタスクの最初のコミットの日。**完了日**：`main` に入った日（Pull Request のマージ、または `main` へのコミット）
- **状態**：完了 / 進行中 / 未着手 / 任意（余力があればやる）
- **PR・ブランチ**：そのタスクを入れた Pull Request の番号かブランチ。`main` に直接コミットしたタスクは空欄。

## 担当

| まとまり | 担当 | 役割 | モジュール |
|---|---|---|---|
| ① 通信と同期 | takawaka | Developer | WebSocket、別々の端末での対戦、3人以上のマルチプレイ |
| ② AI | amakino | Developer | AI対戦相手、LLM |
| ③ ゲームのルール | hyamaoka | Product Owner | Webゲーム、カスタマイズ |
| ④ 土台とユーザー | riyano | Technical Lead | フレームワーク、ユーザー管理、ORM、戦績 |
| ⑤ ソーシャルと言語 | raosmona | Project Manager | ユーザー同士のやりとり、3言語対応、規約・プライバシー、音楽 |

## 担当ファイル

各まとまりで、担当者が責任を持つファイル。`server/src/rooms.js` は takawaka と amakino で共有し、変更する前にチームのチャットで知らせる。

**① 通信と同期（takawaka）**

- `server/src/rooms.js`（Bot の発言部分を除く：部屋の作成・参加・切断と再接続、`publicState` / `privateState`、チャットの配信、キック、招待、開始とリセット、試合の保存）
- `server/src/presence.js`
- `client/src/pages/Room.jsx`
- `e2e/`

**② AI（amakino）**

- `server/src/bots.js`、`server/src/lines.js`、`server/src/llm.js`
- `server/src/rooms.js` の Bot の部分（`botPrompt`、`botSpeak`、発言キュー `say` / `drainSpeech`、`botReply`、`reactToClaim`、`hooks.phase` の Bot 処理、`game:action` の Bot の人狼の追従）
- `server/src/logic.test.js` の CO・疑い・Bot のテスト

**③ ゲームのルール（hyamaoka）**

- `server/src/game.js`、`server/src/roles.js`
- `client/src/components/RoleCard.jsx`、`RoleArt.jsx`、`RoomSettings.jsx`、`Announcement.jsx`、`Recap.jsx`、`WillEditor.jsx`、`RoomQr.jsx`
- `client/src/pages/Home.jsx`（遊び方の説明）
- `server/src/logic.test.js` のルールのテスト

**④ 土台とユーザー（riyano）**

- `Dockerfile`、`docker-compose.yml`、`Makefile`、`.env.example`
- `server/src/index.js`、`server/src/auth.js`、`server/src/db.js`、`server/src/validate.js`
- `server/prisma/schema.prisma`
- `server/src/users.js`、`server/src/stats.js`
- `client/src/pages/Auth.jsx`、`client/src/pages/Profile.jsx`、`client/src/pages/Leaderboard.jsx`、`client/src/components/Avatar.jsx`

**⑤ ソーシャルと言語（raosmona）**

- `client/src/components/Chat.jsx`、`client/src/components/InviteFriends.jsx`、`client/src/pages/Friends.jsx`
- `client/src/i18n.jsx`、`client/src/locales/`（`ja.js` は日本語話者に目を通してもらう）
- `client/src/legal.js`、`client/src/pages/Legal.jsx`、`client/src/music.js`
- `client/src/App.jsx` のフッター（言語の切り替え、規約へのリンク）と招待のカード

## マイルストーン

| # | 内容 | 期間 | 状態 |
|---|---|---|---|
| M1 | 課題の整理と土台（Docker、DB、サーバー、ログイン） | 08-21 〜 09-08 | 完了 |
| M2 | 主要な機能（画面の土台、プロフィール、ルール、部屋、Bot、チャット、フレンド、3言語、戦績） | 09-06 〜 09-25 | 完了 |
| M3 | 規約、単体テスト、解説ページ | 09-29 〜 10-04 | 完了 |
| M4 | 割り振りの見直し、追加の機能、ソース全体の見直し | 10-05 〜 10-06 | 完了 |
| M5 | 評価の準備（README、実演の練習、確認） | 10-06 〜 10-16 | 完了 |

## 共通

| # | タスク | 担当 | 着手 | 完了 | 状態 | PR・ブランチ |
|---|---|---|---|---|---|---|
| P01 | 課題の整理とモジュールの選定 | amakino | 08-21 | 08-21 | 完了 | |
| P02 | 担当の割り振りを5つのまとまりに決め直す | 全員 | 10-05 | 10-06 | 完了 | `sync/werewolf` |
| P03 | ソース全体を見直して42件を直す（内訳は下の[直したバグ](#直したバグ)） | 全員 | 10-05 | 10-06 | 完了 | `sync/werewolf` |
| P04 | README の更新と日本語訳 | hyamaoka | 10-16 | 10-16 | 完了 | |
| P05 | `make help` | amakino | 10-16 | 10-16 | 完了 | |
| P06 | タスク管理表（この表） | hyamaoka | 10-16 | 10-16 | 完了 | |
| P11 | `make` だけでトンネルまで起動する（接続を待ってから URL を出す。cloudflared は http2） | hyamaoka | 10-16 | 10-16 | 完了 | |
| P12 | README：`make` での起動手順、外部キーの表と試合1つの例、プロジェクト管理（ブランチの経緯と管理表） | hyamaoka | 10-16 | 10-16 | 完了 | |
| P07 | README の Individual Contributions に、困ったことと対処を英語で書く | 全員（取りまとめ raosmona） | 10-16 | 10-16 | 完了 | |
| P08 | README の Use of AI を書く | raosmona | 10-16 | 10-16 | 完了 | |
| P09 | 自分の担当の機能を1回通し、担当を入れ替えて変な入力・連打・切断を試す | 全員 | 10-06 | 10-16 | 完了 | |
| P10 | 最新の Chrome で DevTools を開いたまま評価の流れを通し、エラーと警告がないことを確かめる | 全員 | 10-06 | 10-16 | 完了 | |

## ① 通信と同期（takawaka）

| # | タスク | 担当 | 着手 | 完了 | 状態 | PR・ブランチ |
|---|---|---|---|---|---|---|
| C01 | リアルタイムの部屋（作成、参加、切断と再接続、離席、状態の配信） | takawaka | 09-15 | 09-22 | 完了 | #10 |
| C02 | オンライン状態 | takawaka | 09-16 | 09-22 | 完了 | #10 |
| C03 | ホーム画面と部屋の画面 | takawaka（協力 hyamaoka） | 09-15 | 09-23 | 完了 | `feat/room-page` |
| C04 | 単体テストの土台 | takawaka（協力 hyamaoka） | 09-29 | 09-29 | 完了 | #20 |
| C05 | 霊界チャットの届け方 | takawaka | | 10-06 | 完了 | `sync/werewolf` |
| C06 | ホストのキック | takawaka | | 10-06 | 完了 | `sync/werewolf` |
| C07 | 夜の漏れ対策（夜の選択は本人と仲間だけ、チャット id は乱数、夜の振動は全員） | takawaka | | 10-06 | 完了 | `sync/werewolf` |
| C08 | 招待の届け方 | takawaka | | 10-06 | 完了 | `sync/werewolf` |
| C09 | 通しテスト `make e2e` | takawaka | | 10-06 | 完了 | `sync/werewolf` |
| C12 | オフラインのフレンドへの招待を断る（`not_online`） | takawaka | 10-16 | 10-16 | 完了 | |
| C10 | 切断と再接続の手順を書いて、2台で一度通す | takawaka | 10-06 | 10-16 | 完了 | |
| C11 | フレンドのオンライン状態を WebSocket で届ける | takawaka（画面 raosmona） | | | 任意 | |

## ② AI（amakino）

| # | タスク | 担当 | 着手 | 完了 | 状態 | PR・ブランチ |
|---|---|---|---|---|---|---|
| A01 | Bot の AI（見えている情報だけで判断、CO、わざと間違える） | amakino | 09-18 | 09-23 | 完了 | `feat/bots` |
| A02 | Bot の決まったセリフ | amakino | 09-20 | 09-23 | 完了 | #12 |
| A03 | Gemini のチャット（ストリーミング、回数の制限、失敗したら決まったセリフ） | amakino | 09-20 | 09-23 | 完了 | #12 |
| A04 | 霊媒結果で嘘の CO を見抜く（霊媒師の Bot の部分） | amakino | | 10-06 | 完了 | `sync/werewolf` |
| A05 | チャットから CO・疑い・名前の呼びかけを読む仕組みの改善 | amakino | | 10-06 | 完了 | `sync/werewolf` |
| A06 | Bot の朝の発言が終わるまで昼を閉じない | amakino | | 10-06 | 完了 | `sync/werewolf` |
| A07 | Bot 同士の勝敗のテスト（5人と8人で各200戦） | amakino | | 10-06 | 完了 | `sync/werewolf` |
| A08 | 担当のコードの解説メモ | amakino | 10-06 | 10-16 | 完了 | |
| A11 | Gemini の既定のモデルを `gemini-3.5-flash-lite` にし、`thinkingLevel: 'minimal'` にする | amakino | 10-16 | 10-16 | 完了 | |
| A09 | 本物の Gemini のキーで試す | amakino | 10-06 | 10-16 | 完了 | |
| A10 | Bot のプロンプトを調整する | amakino | | | 任意 | |

## ③ ゲームのルール（hyamaoka）

| # | タスク | 担当 | 着手 | 完了 | 状態 | PR・ブランチ |
|---|---|---|---|---|---|---|
| G01 | ゲームのルールと役職（夜・昼・投票、勝ち負け、決選投票） | hyamaoka（協力 riyano） | 09-10 | 09-15 | 完了 | #9 |
| G02 | 役職カードと役職の絵 | hyamaoka（協力 riyano） | 09-11 | 09-11 | 完了 | `feat/role-cards` |
| G03 | 部屋の設定（人狼の数、役職、投票の公開、テーマ、Bot の言語）とお知らせの演出 | hyamaoka | 09-14 | 09-16 | 完了 | #11 |
| G04 | 霊媒師 | hyamaoka | | 10-06 | 完了 | `sync/werewolf` |
| G05 | 騎士の連続護衛禁止 | hyamaoka | | 10-06 | 完了 | `sync/werewolf` |
| G06 | 遺言 | hyamaoka | | 10-06 | 完了 | `sync/werewolf` |
| G07 | 試合後の振り返り | hyamaoka | | 10-06 | 完了 | `sync/werewolf` |
| G08 | 部屋の QR コード | hyamaoka | 10-16 | 10-16 | 完了 | |
| G09 | `game.js` のテスト（勝敗、同票、騎士の守り） | hyamaoka | | | 任意 | |

## ④ 土台とユーザー（riyano）

| # | タスク | 担当 | 着手 | 完了 | 状態 | PR・ブランチ |
|---|---|---|---|---|---|---|
| F01 | `.dockerignore` と `.gitignore` | riyano | 08-28 | 08-28 | 完了 | |
| F02 | Docker と Makefile | riyano | 08-30 | 09-01 | 完了 | #3 |
| F03 | パッケージと Vite の設定 | riyano | 09-01 | 09-03 | 完了 | #4 |
| F04 | データベースのスキーマと入力チェック | riyano（協力 hyamaoka） | 09-03 | 09-08 | 完了 | #6 |
| F05 | サーバー本体とログイン | riyano（協力 hyamaoka、raosmona） | 09-04 | 09-08 | 完了 | `feat/auth` |
| F06 | 画面の土台（ルーティング、ログイン画面、スタイル） | riyano | 09-06 | 09-13 | 完了 | `feat/client-shell` |
| F07 | プロフィールとアバター | riyano（協力 raosmona、hyamaoka） | 09-07 | 09-13 | 完了 | #8 |
| F08 | 戦績とランキング | riyano | 09-25 | 09-25 | 完了 | #18 |
| F09 | ログインの失敗回数制限 | riyano | | 10-06 | 完了 | `sync/werewolf` |
| F10 | DB を作り直した後の古いログインを通さない | riyano | | 10-06 | 完了 | `sync/werewolf` |
| F16 | 想定内の拒否（パスワード間違い、ロック、名前の重複、画像の不正など）を 200 と `{ error }` で返し、Chrome のコンソールにエラーを出さない | riyano | 10-16 | 10-16 | 完了 | |
| F17 | トンネル経由の `http://` を `https://` に転送し（Socket.IO も拒否）、HSTS を付ける | riyano | 10-16 | 10-16 | 完了 | |
| F18 | 新規登録の名前欄の `autoComplete` を `nickname` から `off` にする | riyano | 10-16 | 10-16 | 完了 | |
| F11 | `prisma db push` を `prisma migrate` に変える | riyano | | | 任意 | |
| F12 | アカウント削除 | riyano | | | 任意 | |
| F13 | アバターを保存前に縮小する | riyano | | | 任意 | |
| F14 | 戦績の集計を SQL にする | riyano | | | 任意 | |
| F15 | 表示名に日本語を使えるようにする | riyano | | | 任意 | |

## ⑤ ソーシャルと言語（raosmona）

| # | タスク | 担当 | 着手 | 完了 | 状態 | PR・ブランチ |
|---|---|---|---|---|---|---|
| S01 | フレンド | raosmona | 09-20 | 09-20 | 完了 | #14 |
| S02 | チャット | raosmona | 09-21 | 09-23 | 完了 | #13 |
| S03 | フェーズごとの音楽 | raosmona | 09-23 | 09-24 | 完了 | #17 |
| S04 | 3言語対応（英語・日本語・フランス語） | raosmona | 09-24 | 09-25 | 完了 | #15 |
| S05 | プライバシーポリシーと利用規約 | 最初の版 hyamaoka、更新 raosmona | 09-29 | 09-29 | 完了 | #19 |
| S06 | 解説ページ | raosmona（協力 hyamaoka） | 10-02 | 10-04 | 完了 | #21 |
| S07 | 招待の画面 | raosmona | | 10-06 | 完了 | `sync/werewolf` |
| S08 | 霊界チャットの画面 | raosmona | | 10-06 | 完了 | `sync/werewolf` |
| S11 | `not_online` の文言（3言語）、QR の案内を `make` に合わせる | raosmona | 10-16 | 10-16 | 完了 | |
| S09 | チャットの「入力中…」 | raosmona | | | 任意 | |
| S10 | プライバシーポリシーを、アカウント削除の手順と合わせる | raosmona | | | 任意 | |

## 直したバグ

- **riyano：同じメールアドレスや名前の同時登録を 409 にする。** Prisma の一意制約 `P2002` を `taken` に変換する（登録と名前の変更）
- **riyano：メールアドレスの形式。** スキーマの `format: 'email'` は Fastify 5 の Ajv が検査する（`foo` や `a@b` は 400）。`validate.js` の `invalidEmail` は同じ規則の二重の検査で、単体テストもこれを使う。画面のメール欄にも同じ規則の `pattern` がある
- **amakino：フランス語の疑い判定から、単語 `pas` だけの一致を外した**
- **hyamaoka：設定の数値が範囲外のとき、入力欄をサーバーの値に戻す**
- **raosmona：フレンド検索で、後から返った古い結果が新しい検索を上書きしない**
- **amakino：昼の Ready では、Bot の朝の発言が終わるまで昼を閉じない。** `game.talkLock`
- **hyamaoka：役職カードは指を離すまで開いたまま。** `pointerleave` では閉じない。押している指をキャプチャする。キーボードの長押しでも占い結果が出る
- **2026-10-05 にソース全体を見直して直した42件。** 担当ごとの主なもの：
  - takawaka：猶予中の人がいても別の人の猶予切れで部屋が閉じていた、人狼の選び直しで Bot の人狼が前の相手に戻っていた、外した Bot が話していた、設定キーに `constructor` などが通っていた、再読み込みで過去の演出が全部再生されていた、画面に触れる前の振動でコンソールにエラーが出ていた
  - amakino：質問や他人の話を CO と読んでいた、CO の対象が挨拶の名前になっていた、名前が単語の一部（believe の Eve など）にも当たっていた、全角の名前を読めなかった、「信じられません」を擁護と読んでいた、`votre` を投票の話と読んでいた、昼の「沈黙したら話を再開」がすぐ出ていた
  - hyamaoka：占い終わった占い師が夜の行動者に残り、Bot だけの夜が早く終わらなかった
  - riyano：`make fclean` 後に古いログインが別人として通っていた、72バイトを超えるパスワード、device Cookie が別アカウントで上書きされていた、大きすぎる id や NUL 文字で 500 になっていた、検索の `_` と `%` がワイルドカードになっていた、macOS で `make` が失敗していた（`sed -i`）、DB の起動確認、`make down` が10秒待たされていた、`make e2e` がアプリの起動を待たなかった
  - raosmona：登録画面の同意文が崩れていた、入力欄に `name` がなく DevTools の Issues に警告が出ていた、プライバシーポリシーの Gemini への送信内容が実際と違っていた、招待し直せなかった、プロフィールの長い文字列で横スクロールが出ていた

## 進め方

1. 各自が自分の担当を `main` に直接コミットして push する。作業の前に必ず `git pull`。`git add .` は使わず、自分の担当ファイルだけを `add` する
2. メッセージは英語で「どこを、何のために変えたか」を1行で（例：`friends: show an error until the next load succeeds`）。`server/src/rooms.js` を触るときは、先にチャットで一声かける。コンフリクトが出たら自分で直さず、hyamaoka か riyano を呼ぶ
3. 最初の土台を AI で作ったなら、コミットメッセージと README の「AIの使い方」にそのまま書く
4. 週に1回、各自が自分の担当をほかのメンバーに説明する

## 書き方

- タスクを始めたら、自分のまとまりの表に1行足すか、未着手の行の「着手」に日付を入れて「進行中」にする
- 終わったら「完了」に `main` に入った日を入れ、Pull Request かブランチを通したなら「PR・ブランチ」に書く
- 手伝ってもらったら「担当」に（協力 名前）と書き、コミットには `Co-authored-by:` を付ける
- 番号は、まとまりの記号と通し番号（例：C12、A11）
