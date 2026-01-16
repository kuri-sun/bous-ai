# server/AGENTS.md

## 構成
- FastAPI アプリ本体: `app/`
- ルーター: `app/api/endpoints/**`
- サービス: `app/services/**`
- スキーマ: `app/schemas/**`
- 設定: `app/core/config.py`

## 開発手順
- 推奨 Python: 3.11+
- venv 作成: `python -m venv .venv && . .venv/bin/activate`
- 依存インストール: `python -m pip install -r requirements-dev.txt`（必要なら `--break-system-packages`）
- 実行: `uvicorn app.main:app --reload`
- Docs: `http://localhost:8000/docs`

## コマンド
- 整形: `black --line-length 88 app`
- Lint: `ruff check app`
- まとめ実行 (例): `.venv/bin/black --line-length 88 app && .venv/bin/ruff check app`
- Docker: `docker build -t bousai_api . && docker run --rm -p 8000:8000 bousai_api`

## Agent編集フロー
- エンドポイント: `/agentic/start`, `/agentic/respond`, `/agentic/decision`
- LLM コンテキスト: 住所情報、生成 HTML/プレーンテキスト、検索PDFのOCRテキスト
- 提案受諾で PDF を再生成し、入力 (step2) を更新して保存

## 環境変数（`app/core/config.py` 参照）
- GOOGLE_API_KEY, GOOGLE_SEARCH_CX
- GCP_PROJECT, GCS_BUCKET, GCS_OUTPUT_PREFIX
- LLM 用キー（`app/services/llm.py` に依存）

## 主要ファイル
- `app/services/search.py`: カスタム検索＋PDF ダウンロード/OCR
- `app/services/agentic.py`: プロンプト/ターン生成
- `app/services/generate.py`: HTML 生成と PDF 出力
- `app/api/endpoints/agentic.py`: Agentic API ルーティング
