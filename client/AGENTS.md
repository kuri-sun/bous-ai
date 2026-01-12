# client/AGENTS.md

## 構成

- React 19 + React Router 7 + Vite。
- ルート: `client/app/routes/**`
- コンポーネント: `client/app/components/**`
- 型: `client/app/types/**`
- API ラッパー: `client/app/api/**`
- スタイル: `client/app/app.css` など。

## 開発手順

- Node/NPM: `npm ci` を推奨。
- 起動: `npm run dev`（デフォルトは `http://localhost:5173`、設定により変わる場合あり）。
- ビルド: `npm run build`（React Router ビルド）。
- Lint: `npm run lint`（ESLint/Prettier 設定に従う）。

## Agent編集 UI のポイント

- エージェント開始: 「Agent編集を開始」ボタンで会話開始。開始後はボタン非表示＋実行中ラベル。
- 会話表示: 参考検索結果、履歴、提案をスクロール領域に表示（質問/提案は折り返し表示）。
- メッセージ送信: 会話開始後は常にテキスト入力＋「メッセージを送信」ボタンが下部に固定的に表示（状態が question/proposal/accepted/rejected でも送信可能）。
- 提案受諾/拒否: 提案表示の Yes/No ボタンで PDF 再生成 or 却下。会話は継続可能。

## 環境変数

- `API_BASE`: バックエンド API のベース URL。
- その他必要な鍵がある場合は `.env` または `.env.local` に設定し、コミットしないこと。

## チェック/フォーマット

- `npm run lint`（ESLint）
- Prettier が入っている場合は `npm run format` などを追加するとよい（現状は lint/build を想定）。
