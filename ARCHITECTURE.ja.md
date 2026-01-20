# YamlDocDock Architecture

## 1. プロジェクト概要

**YamlDocDock** は、YAMLファイルを解析し、モダンでインタラクティブなシングルページHTMLドキュメントを生成するツールです。
機密情報を含むインフラ定義書（CloudFormation等）を、外部サービスに送信することなくローカル環境で安全にドキュメント化することを目的としています。

### コアコンセプト
*   **3要素マージ**: 「ソースYAML（構造）」、「ガイドYAML（説明）」、「エイリアスYAML（表示名）」を統合してレンダリングします。
*   **モード駆動**: `generic`（汎用）と `cfn`（CloudFormation）のモードを持ち、パースや表示ロジックを切り替えます。
*   **シングルアーティファクト**: CSS/JSをインライン化し、配布容易な単一HTMLファイルを生成します。

---

## 2. アーキテクチャ構成

### 2.1. コアコンポーネント (`src/core/`)

*   **Builder (`builder.ts`)**:
    *   **オーケストレーター**: CLIや他のエントリーポイントから呼び出され、設定の読み込み、ソースのロード、ガイドの適用、HTML生成までの一連のビルドプロセスを制御します。
    *   ビルドロジックの中核であり、`cli.ts` はこのクラスの薄いラッパーとして機能します。
*   **Loader (`loader.ts`)**:
    *   `js-yaml` をラップし、`ModeStrategy` を使用して適切なスキーマでパースします。
*   **AliasProcessor (`alias-processor.ts`)**:
    *   エイリアスファイルの読み込みと変換を担当。ワイルドカード展開やインポート機能を提供します。
*   **Merger (`merger.ts`)**:
    *   `lodash.mergeWith` を使用し、ソース・ガイド・エイリアスを結合します。
*   **Generator (`generator.ts`)**:
    *   結合済みデータを受け取り、EJSテンプレートを使用してHTMLを生成します。
*   **Renderer (`renderer.ts`)**:
    *   複雑な描画ロジック（メタデータ抽出、ツールチップ生成など）をカプセル化したクラスです。

### 2.2. Strategyパターン (`src/modes/`)

各モードの固有ロジックは `ModeStrategy` インターフェースの実装として分離されています。

| 機能 | Generic Mode (`GenericStrategy`) | CFn Mode (`CfnStrategy`) |
| :--- | :--- | :--- |
| **Schema** | `DEFAULT_SCHEMA` | `CLOUDFORMATION_SCHEMA` (Custom Tags Support) |
| **Merge Logic** | **Smart Merge**: 配列は結合、競合はリスト化 | デフォルト (上書き) |
| **Section Sort** | ソースの記述順を維持 | **厳格な順序**: `Parameters`, `Resources`, `Outputs` 等 |

---

## 3. データフローとロジック

### 3.1. リンクシステム (Deep Linking)
生成されるHTML要素には、`{SectionName}__{LogicalID}__{PropertyPath}` という形式で一意なIDが付与されます。
パスセグメントはサニタイズ（英数字以外を `_` に置換）されます。

### 3.2. クライアントサイド動作 (`src/templates/script.js`)
*   **Display Mode**: Inline Mode / Tooltip Mode の切り替え
*   **Tooltip**: ホバーで表示、クリックでピン留め
*   **Resizing**: テーブルカラムとサイドバーのリサイズ機能（`localStorage`には保存しない仕様）
