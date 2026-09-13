# Contributing to ydock

## 開発環境のセットアップ

### 必要要件
- Node.js v18以上を推奨
- npm

### インストール
```bash
npm install
```

### 開発コマンド
```bash
# ビルド
npm run build

# 開発モード Watchモード
npm run dev -- build -c sample/setting.config.yml --watch

# テスト
npm test

# LintとFormat
npm run lint
npm run format
```

## 技術スタック
- **TypeScript**: コアロジックの実装
- **EJS**: HTMLテンプレートエンジン
- **Tailwind CSS**: CDN経由でロードするスタイリング
- **Vitest**: ユニットテストフレームワーク

## コーディング規約
- **Linting**: ESLintおよびPrettierを使用しています。コミット前に `npm run lint` をパスする必要があります。
- **Type Safety**: `any` の使用は極力避け、適切な型定義を行ってください。

## ディレクトリ構造
- `src/core/`: アプリケーションの中核ロジック
- `src/modes/`: CloudFormation等のモード別ロジック
- `src/templates/`: EJSテンプレート、スタイルシート、およびクライアントサイドスクリプト
- `src/types/`: 設定やドキュメントモデル等の型定義
- `sample/`: 動作確認用のサンプルファイル
