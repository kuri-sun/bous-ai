# bous-ai - 防災マニュアル生成アプリ

![サムネイル](./docs/thumbnail.png)

## 全体構成

![システム構成図](./docs/system.png)

## 開発環境

Node.js と Python 3.11+ が必要です。

### 環境変数

初回起動時、フロントエンドとバックエンドで環境変数を設定してください。

- `server/.env` を作成し、 `GEMINI_API_KEY` などの鍵を配置。（`server/.env.example`を参照。）
- `client/.env` (または `.env.local`) を作成し、 `API_BASE` 等を配置。（`client/.env.example`を参照。）

### フロントエンド

```sh
cd client
npm ci
npm run dev
```

### バックエンド

```sh
cd server
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

### Docker

```sh
docker compose up --build
```

## 参照

- [Zenn記事]()
- [Youtube]()
