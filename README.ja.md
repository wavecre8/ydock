# YamlDocDock

> YAMLファイルを、美しいインタラクティブなHTMLドキュメントに

YAMLファイル（CloudFormation、設定ファイル、データ定義など）を、既存ファイルに手を加えることなく、読みやすいHTMLドキュメントに変換します。

## Quick Start

### 1. プロジェクトの初期化
```bash
npx yamldocdock init
```
`setting.config.yml` が生成されます。

### 2. ビルドの実行
```bash
npx yamldocdock build
```

---

## 開発とアーキテクチャ

このツールの内部構造や、開発への参加方法については以下のドキュメントを参照してください。

- [**ARCHITECTURE.md**](./ARCHITECTURE.md) - システム設計、ディレクトリ構成、クラスの役割について
- [**CONTRIBUTING.md**](./CONTRIBUTING.md) - 開発環境のセットアップ、テスト、コーディング規約について

## 主な機能

### コア機能
- 🔒 **機密情報の保護** - ビルド処理は完全ローカルで実行され、YAMLファイルのデータが外部送信されることは一切ありません
- ✨ **既存ファイル非破壊** - ソースYAMLを編集せずにドキュメント化
- 📝 **柔軟なドキュメント化** - ガイドファイルとエイリアスで説明や表示名を追加

> **注意:** 生成されたHTMLはTailwind CSS CDNを使用します。オフライン環境では表示が崩れます。

### 追加機能
- 🧩 **モード駆動アーキテクチャ** - 用途に合わせて最適な解析ロジック（モード）を切り替え可能（[詳細はこちら](#対応モード)）
- 🎨 **表示モード切替** - Inline/Tooltipモードをブラウザで切り替え可能
- 🏷️ **エイリアス機能** - 難解なキー名に分かりやすい別名を設定
- 📑 **インデックスページ** - 複数ドキュメントへのポータルページを自動生成
- 🛠️ **ディープリンク** - 深い階層のプロパティに直接リンク可能
- 📏 **リサイズ機能** - テーブルのカラム境目やサイドバー右端をドラッグして幅を調整可能
- 🖨️ **印刷対応** - ブラウザの印刷機能で、自動的にサイドバーを隠してメインコンテンツのみを綺麗に出力

## 対応モード

| モード名 | 識別子 | 説明 |
|---|---|---|
| **Generic** | `generic` | 標準的なYAMLファイル用（デフォルト）。配列のマージやエイリアス適用など、基本的な機能を提供します。 |
| **CloudFormation** | `cfn` | AWS CloudFormationテンプレートに特化。組み込み関数の解決、セクションの自動整列、固有のタグ処理を行います。 |

## 基本的な使い方

### 設定ファイルの作成

`setting.config.yml` を作成し、ビルド設定を定義します。

```yaml
lang: ja

index:
  output: sample/output/index.html
  title: ドキュメントポータル

pages:
  - title: EC2インスタンス設計図
    mode: cfn
    sources:
      - sample/sources/vpc.yml
      - sample/sources/ec2.yml
    guideDir: sample/guides
    aliasDir: sample/aliases
    output: sample/output/infrastructure.html
```

### ビルドの実行

npx yamldocdock build -c setting.config.yml
```

## コマンドリファレンス

### グローバルオプション

| オプション | 短縮 | 説明 |
|---|---|---|
| `--version` | `-V` | バージョン番号を表示します |
| `--help` | `-h` | ヘルプを表示します |

### `init`

デフォルトの設定ファイル（`setting.config.yml`）をカレントディレクトリに生成します。

```bash
npx yamldocdock init
```

### `build`

設定ファイルに基づいてドキュメントを生成します。

```bash
npx yamldocdock build [options]
```

**オプション:**

| オプション | 短縮 | 説明 |
|---|---|---|
| `--config <path>` | `-c` | 設定ファイルのパス (デフォルト: `setting.config.yml` または `.yaml`) |
| `--watch` | `-w` | **Watchモード**: ファイルの変更を監視し、自動的に再ビルドとブラウザのリロードを行います |
| `--no-open` | | Watchモード開始時にブラウザを自動で開かないようにします |

### Watchモード (開発用)

`--watch` オプションを使用すると、リアルタイムなプレビュー環境が立ち上がります。

```bash
npx yamldocdock build -c setting.config.yml --watch
```

- **ホットリロード**: ソースYAMLやガイドファイルを編集して保存すると、ブラウザが自動的にリロードされます。
- **サイレントビルド**: 初回起動時以外はコンソール出力を抑制し、開発の邪魔をしません。

## ガイドファイルとエイリアスファイル

### 配置ルール

ソースファイル名に基づいて、対応するガイド/エイリアスファイルが自動的に探索されます。

| ソースファイル | ガイドファイル | エイリアスファイル |
|---|---|---|
| `sources/vpc.yml` | `guides/vpc_guide.yml` | `aliases/vpc_alias.yml` |
| `sources/ec2.yml` | `guides/ec2_guide.yml` | `aliases/ec2_alias.yml` |

※ `guideDir` と `aliasDir` を設定ファイルで指定する必要があります。

### ガイドファイルの例

ソースファイルの構造に沿って、説明文を記述します。
リンク記法 `[表示文](URL)` を使用して、内部参照や外部URLを含めることができます。

```yaml
Resources:
  MyVPC:
    Description: プロダクション環境用のVPCメインネットワーク
    Properties:
      CidrBlock: VPC全体のIPv4アドレス範囲 (e.g. 10.0.0.0/16)
      Tags:
        0:
          Value: コスト管理用のプロジェクトタグ
```

### エイリアスファイルの例

キー名をわかりやすい別名に置き換えます。

```yaml
Resources:
  MyVPC:
    _alias: メインVPC
    Properties:
      CidrBlock: CIDRブロック
      Tags:
        "*":
          Key: タグキー
          Value: タグ値
```

`*`（ワイルドカード）を使うと、配列の全要素に同じエイリアスを一括適用できます。

## 設定リファレンス

### グローバル設定

| キー | 説明 | デフォルト |
|---|---|---|
| `language` | 出力HTMLの言語属性 | `ja` |
| `index` | インデックスページの設定（後述） | なし |

### インデックスページ設定

| キー | 必須 | 説明 |
|---|---|---|
| `output` | ✓ | 出力先パス |
| `title` |  | ページタイトル（省略時: "Documentation Index"） |

### ページ設定

| キー | 必須 | 説明 |
|---|---|---|
| `title` | ✓ | ドキュメントのタイトル |
| `sources` | ✓ | ソースYAMLファイルのリスト |
| `output` | ✓ | 出力先HTMLパス |
| `mode` |  | 解析モードを指定（例: `generic`） |
| `guideDir` |  | ガイドファイルのディレクトリ |
| `aliasDir` |  | エイリアスファイルのディレクトリ |

## 高度な使い方

### エイリアスのインポート

共通のエイリアス定義を別ファイルから取り込めます。

```yaml
_imports:
  - ../common/global_aliases.yml

Resources:
  MyResource:
    _alias: カスタムリソース
```

### 複数ファイルのマージ

`sources` に複数ファイルを指定すると、マージされて1つのドキュメントになります。

```yaml
pages:
  - title: 統合ドキュメント
    sources:
      - base.yml
      - network.yml
      - compute.yml
    output: merged.html
```
