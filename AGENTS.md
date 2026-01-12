# AGENTS.md

各パッケージの詳細は `server/AGENTS.md` と `client/AGENTS.md` を参照してください。  
人向けの全体ドキュメントは `README.md` を補助的に利用してください。

## 開発クイックスタート
- Backend (FastAPI): `cd server && python -m venv .venv && . .venv/bin/activate && python -m pip install -r requirements-dev.txt`。起動: `uvicorn app.main:app --reload` → `http://localhost:8000/docs`。
- Frontend (React Router + Vite): `cd client && npm ci && npm run dev` → `http://localhost:5173`（設定により変わる場合あり）。
- 環境変数: `server/.env` に Google API/検索/GCS/GENAI などの鍵を配置。`client/.env`（または `.env.local`）に API_BASE 等。秘密情報はコミットしないこと。

## スタイルとチェック
- Backend: Black 88 桁、Ruff (`black --line-length 88 app`, `ruff check app`)。
- Frontend: ESLint/Prettier (`npm run lint`, `npm run build` を目安)。
- コメントは必要最小限、日本語で。

## テスト/CI
- CI は `.github/workflows/ci.yml` を参照（フロントビルドとバックエンド依存同期）。
- 現状テストスイートは未整備。追加する場合はパッケージ内に配置し、CI 連携を検討。

## Agent編集メモ
- API: `/api/agentic/start`, `/respond`, `/decision`。
- コンテキスト: 住所情報 + OCR 抽出（アップロード/検索PDF）+ 生成 HTML/プレーンテキストを LLM へ渡し、足りない部分を質問→提案するフロー。

## PR ポリシー
- タイトル例: `[server] ...`, `[client] ...`, `[repo] ...`（横断変更）。
- マージ前に整形・Lint/Build を実行し、不要ファイルや秘密鍵を含めないこと。
