# Contributing to YamlDocDock

## 開発環境のセットアップ

### 必要要件
- Node.js (v18 or later recommended)
- npm

### インストール
```bash
npm install
```

### 開発コマンド
```bash
# ビルド
npm run build

# 開発モード（Watchモード）
npm run dev -- -c sample/setting.config.yml --watch

# テスト
npm test

# Lint & Format
npm run lint
npm run format
```

## 技術スタック
- **TypeScript**: コアロジックの実装
- **EJS**: HTMLテンプレートエンジン
- **Tailwind CSS**: スタイリング（CDN経由でロード）
- **Vitest**: ユニットテストフレームワーク

## コーディング規約
- **Linting**: ESLint + Prettier を使用しています。コミット前に `npm run lint` をパスする必要があります。
- **Type Safety**: `any` の使用は極力避け、適切な型定義を行ってください。

## ディレクトリ構造
- `src/core/`: アプリケーションの中核ロジック
- `src/modes/`: CloudFormation等のモード別ロジック
- `src/templates/`: HTMLテンプレート (EJS) とクライアントサイドJS
- `sample/`: 動作確認用のサンプルファイル
