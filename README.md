# Topos

Topos は、フォロワー数や声の大きさではなく、
「場への寄与」で投稿の可視性が決まる実験的 SNS です。

## 思想

Topos の中心にある思想は、次の 3 点です。

1. 人の評価ではなく、場の健全性を最適化する
2. 目立つことより、流れを良くする貢献を評価する
3. 放置された場は自然に凍結し、必要なら引き継ぐ

一般的な SNS は、個人アカウントの影響力を拡大する設計になりがちです。
その結果、短期的な刺激や対立が増幅され、コミュニティ全体の質が不安定になります。

Topos は逆に、場を主体として扱います。投稿は「誰が言ったか」よりも、
「その発言が場の探索・理解・対話にどれだけ寄与したか」を重視して扱われます。

この方針を実装するために、次のような設計を採用しています。

- 重力スコア: 反応・通報・管理操作をイベントとして蓄積し、表示順位に反映する
- 管理ライフサイクル: `active -> dormant -> succession -> archived` の段階遷移で放置を可視化する
- 立候補継承: 継承期間に候補者を募り、無人化した場を自然に引き継げるようにする
- アーカイブ凍結: 継承不成立の場は書き込み停止し、履歴を安全に保存する
- バケーション宣言: 管理者の一時不在を明示し、不必要な継承発火を抑える

このプロジェクトは、アルゴリズムの勝ち負けではなく、
コミュニティ運営の哲学をコードで検証することを目的にしています。

## 動作要件

- Node.js 20 以上
- npm 10 以上

## 開発起動

```bash
npm install
npm run dev
```

起動後に `http://localhost:3000` を開いてください。

## 本番起動

```bash
npm install
npm run build
npm run start
```

## テスト

```bash
npm run test:run
```

カバレッジ付き:

```bash
npm run test:coverage
```

GitHub Actions では [`.github/workflows/qa.yml`](.github/workflows/qa.yml) で
`npm run test:run` を push / pull_request 時に実行します。

## 環境変数

Neon など外部 PostgreSQL を使う場合は、次を設定してください。

- `DATABASE_URL`: PostgreSQL 接続文字列

`DATABASE_URL` が未設定の場合はローカル JSON 永続化を使用します。

任意:

- `PORT`: `npm run start` 実行時のポート番号

## データ永続化 (MVP)

`DATABASE_URL` が設定されている場合、実行時データは PostgreSQL に保存されます。

`DATABASE_URL` が未設定の場合、実行時データは `data/topos-db.json` に保存されます。

- 投稿/スレッド作成、リアクション、通報、モデレーション、プロフィール更新時に自動保存されます
- このファイルは運用データとして Git 管理対象外にしています

### Neon 利用時の最小手順

1. Neon でプロジェクトと DB を作成し、接続文字列を取得する
2. ローカルの `.env.local` に `DATABASE_URL=...` を設定する
3. Vercel の Environment Variables にも同じ `DATABASE_URL` を設定する
4. デプロイ後に投稿を作成し、再デプロイ後も残ることを確認する

## バックアップと復元

### バックアップ

```bash
npm run backup
```

`data/backups/topos-db-<timestamp>.json` にスナップショットを作成します。
既定では新しい世代を 20 件保持します (環境変数 `TOPOS_BACKUP_KEEP` で変更可能)。

### 復元

```bash
copy /Y data\backups/topos-db-<timestamp>.json data\topos-db.json
```

復元後はアプリを再起動してください。

## 補足

- 認証は MVP のため Cookie ベースの簡易方式です
- PostgreSQL/Auth.js への移行は今後のロードマップ項目です
