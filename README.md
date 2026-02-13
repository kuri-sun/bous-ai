# Bous AI (ボウサイ)

[![サムネイル](./docs/thumbnail.png)](https://www.youtube.com/watch?v=wToCMyk2sgI)
(クリックすると YouTube の紹介動画に飛びます)

## 全体構成

![システム構成図](./docs/system.png)

## 開発環境

Node.js と Python 3.11+ が必要。

### 環境変数

まずは、フロントエンドとバックエンドで環境変数を設定する。

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

Dockerを使用して、ローカルバックエンドをRunしたい場合:

```sh
docker compose up --build
```
