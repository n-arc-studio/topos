# Topos

![Commercial Use Prohibited](https://img.shields.io/badge/Commercial%20Use-Prohibited-red)

Topos は、フォロワー数ではなく「場への寄与」で投稿の見え方が変わる、実験的なコミュニティプラットフォームです。

## コンセプト

- 個人の拡散力より、場の対話品質を優先する
- 投稿を「バズ」ではなく「文脈への貢献」で扱う
- 放置された場を段階的に可視化し、最終的に凍結できるようにする

## 現在の主な機能

- 場 / スレッド / 投稿の作成
- 投稿の記名・匿名切り替え
- 投稿へのリアクション (`like`, `agree`, `useful`, `laugh`, `tsukkomi`)
- 投稿の通報、管理者による `pin` / `unpin` / `sink` / `unsink`
- 重力スコアによる並び替え
- スレッド表示モード切り替え
	- 時系列ツリー表示
	- 沈殿層表示 (`surface`, `shallow`, `deep`, `abyss`)
- 管理コンソール
	- 通報投稿の確認
	- 沈降投稿の確認
	- モデレーション履歴の確認
	- 場ごとの重力係数の上書き設定
- プロフィール編集

## アーキテクチャ概要

- フレームワーク: Next.js 16 (App Router)
- 言語: TypeScript
- UI: React 19
- テスト: Vitest
- 永続化:
	- `DATABASE_URL` 設定時: PostgreSQL (Neon ドライバ)
	- 未設定時: JSON ファイル (`data/topos-db.json`)

## セットアップ

要件:

- Node.js 20+
- npm 10+

インストール:

```bash
npm install
```

開発サーバ起動:

```bash
npm run dev
```

起動後に `http://localhost:3000` を開いてください。

本番ビルドと起動:

```bash
npm run build
npm run start
```

## 環境変数

必須ではありません。未設定でもローカル JSON 永続化で動作します。

- `DATABASE_URL`
	- 外部 PostgreSQL 接続文字列
	- 設定時は DB 永続化を使用
- `PORT`
	- `npm run start` の待受ポート
- `NEXT_PUBLIC_APP_VERSION`
	- フッター表示用バージョン文字列
- `TOPOS_BACKUP_KEEP`
	- バックアップ保持世代数 (既定: `20`)

## 永続化と運用上の注意

- ローカル開発で `DATABASE_URL` 未設定の場合、データは `data/topos-db.json` に保存されます。
- `data/` は Git 管理対象外です。
- Vercel 本番環境ではサーバレスファイルシステムに対する書き込み永続化は保証されません。
	- 本番運用では `DATABASE_URL` を設定し、外部 DB を使用してください。

### Neon を使う最小手順

1. Neon でプロジェクトと DB を作成し、接続文字列を取得する
2. `.env.local` に `DATABASE_URL=...` を設定する
3. Vercel の Environment Variables に同じ `DATABASE_URL` を設定する
4. 投稿作成後に再デプロイし、データが保持されることを確認する

## バックアップ / 復元

バックアップ:

```bash
npm run backup
```

- `data/backups/topos-db-<timestamp>.json` に保存されます
- 古い世代は `TOPOS_BACKUP_KEEP` に従って自動削除されます

復元 (Windows):

```bash
copy /Y data\backups/topos-db-<timestamp>.json data\topos-db.json
```

復元後はアプリを再起動してください。

## テスト

通常実行:

```bash
npm run test:run
```

カバレッジ付き:

```bash
npm run test:coverage
```

## CI/CD

- テスト: `.github/workflows/qa.yml`
	- `push` / `pull_request` で `npm run test:run` を実行
- 本番デプロイ: `.github/workflows/deploy-vercel.yml`
	- `main` への `push` 後、QA 成功時に Vercel へデプロイ
	- `package.json` の `version` と run 番号 / commit SHA から版番号を生成し、`NEXT_PUBLIC_APP_VERSION` として注入

必要な GitHub Secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## API エンドポイント (実装済み)

- `GET /api/me`
- `POST /api/profile`
- `POST /api/threads`
- `POST /api/posts`
- `POST /api/posts/:postId/reactions`
- `POST /api/posts/:postId/report`
- `POST /api/posts/:postId/moderate`
- `POST /api/spaces/:spaceId/config`

## 未実装 / 進行中

- `api/spaces/[spaceId]/candidates` と `api/spaces/[spaceId]/vacation` は現時点で API 実装ファイルが未配置です
- チケット管理は `tickets/` 配下で継続しています

## 利用条件

このリポジトリのコードおよび成果物は、現時点で商用利用不可です。

- 許可される利用: 個人学習、検証、研究、非商用での試用
- 禁止される利用: 販売、SaaS 提供、有償サポート付与、企業内業務への商用組み込み

商用利用を希望する場合は、事前に権利者へ確認してください。
