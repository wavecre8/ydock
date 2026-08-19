# ydock

> YAMLファイルを、美しいインタラクティブなHTMLドキュメントに

CloudFormation、各種設定ファイル、データ定義などのYAMLファイルを、既存ファイルに手を加えることなく読みやすいHTMLドキュメントに変換します。

## クイックスタート

### グローバルインストール

```bash
npm install -g @wavecre8/ydock
ydock init
ydock build
```

### npx 直接実行

```bash
npx @wavecre8/ydock init
npx @wavecre8/ydock build
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
- 🚫 **不要要素の非表示** - Excludeファイルを使って出力に不要なプロパティを柔軟に除外

> **注意:** 生成されたHTMLはTailwind CSS CDNを使用します。オフライン環境では表示が崩れます。

### 追加機能
- 🧩 **モード駆動アーキテクチャ** - 用途に合わせて最適な解析ロジックを切り替え可能。 [詳細はこちら](#対応モード)
- 🎨 **表示モード切替** - Inline/Tooltipモード、および画面を広く使えるコンパクトビューモードをブラウザで切り替え可能
- 🏷️ **エイリアス機能** - 難解なキー名に分かりやすい別名を設定
- 📑 **インデックスページ** - 複数ドキュメントへのポータルページを自動生成
- 🛠️ **ディープリンク** - 深い階層のプロパティに直接リンク可能
- 📏 **リサイズ機能** - テーブルのカラム境目やサイドバー右端をドラッグして幅を調整可能
- 🖨️ **印刷対応** - ブラウザの印刷機能で、自動的にサイドバーを隠してメインコンテンツのみを綺麗に出力

## 対応モード

| モード名 | 識別子 | 説明 |
|---|---|---|
| **Generic** | `generic` | 標準的なYAMLファイル用。デフォルトの動作モードです。配列のマージやエイリアス適用など、基本的な機能を提供します。 |
| **CloudFormation** | `cfn` | AWS CloudFormationテンプレートに特化。組み込み関数の解決、セクションの自動整列、固有のタグ処理を行います。 |

## 基本的な使い方

### 1. プロジェクトの初期化

`init` コマンドで設定ファイル `setting.config.yml` を生成します。

```bash
ydock init
# または npx @wavecre8/ydock init
```

### 2. 設定ファイルの編集

`setting.config.yml` を編集し、対象のYAMLファイルや出力先を定義します。

> [!NOTE]
> 設定ファイル内で指定する相対パス（`sources`, `output`, `guideDir`, `aliasDir` など）は、すべて**設定ファイルが配置されているディレクトリを基準**として解決されます。

```yaml
lang: ja

index:
  output: output/index.html
  title: ドキュメントポータル

pages:
  - title: EC2インスタンス設計図
    mode: cfn
    sources:
      - sources/vpc.yml
      - sources/ec2.yml
    guideDir: guides
    aliasDir: aliases
    excludeDir: excludes
    output: output/infrastructure.html
```

### 3. ビルドの実行

```bash
ydock build -c setting.config.yml
# または npx @wavecre8/ydock build -c setting.config.yml
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
npx @wavecre8/ydock init
```

### `build`

設定ファイルに基づいてドキュメントを生成します。

```bash
npx @wavecre8/ydock build [options]
```

**オプション:**

| オプション | 短縮 | 説明 |
|---|---|---|
| `--config <path>` | `-c` | 設定ファイルのパス。デフォルトは `setting.config.yml` または `.yaml` です |
| `--watch` | `-w` | **Watchモード**: ファイルの変更を監視し、自動的に再ビルドとブラウザのリロードを行います |
| `--no-open` | | Watchモード開始時にブラウザを自動で開かないようにします |

### `skeleton`

設定ファイルで指定されたソースYAMLファイルを解析し、エイリアス、ガイド、除外ファイルの雛形を自動生成します。既存のファイルがある場合は、不足しているキーだけを末尾に安全に追記します。

```bash
ydock skeleton [options]
# または npx @wavecre8/ydock skeleton [options]
```

**オプション:**

| オプション | 短縮 | 説明 |
|---|---|---|
| `--config <path>` | `-c` | 設定ファイルのパス。デフォルトは `setting.config.yml` または `.yaml` です |
| `--type <type>` | `-t` | 生成するスケルトンの種類: `all`, `alias`, `guide`, `exclude`。デフォルトは `all` です |

### Watchモード

`--watch` オプションを使用すると、リアルタイムなプレビュー環境が立ち上がります。

```bash
npx @wavecre8/ydock build -c setting.config.yml --watch
```

- **ホットリロード**: ソースYAMLやガイドファイルを編集して保存すると、ブラウザが自動的にリロードされます。
- **サイレントビルド**: 初回起動時以外はコンソール出力を抑制し、開発の邪魔をしません。

## ガイド、エイリアス、Excludeファイル

### 配置ルール

ソースファイル名に基づいて、対応するガイド/エイリアスファイルが自動的に探索されます。

| ソースファイル | ガイドファイル | エイリアスファイル | Excludeファイル |
|---|---|---|---|
| `sources/vpc.yml` | `guides/vpc.guide.yml` | `aliases/vpc.alias.yml` | `excludes/vpc.exclude.yml` |
| `sources/ec2.yml` | `guides/ec2.guide.yml` | `aliases/ec2.alias.yml` | `excludes/ec2.exclude.yml` |

※ `guideDir`, `aliasDir`, `excludeDir` を設定ファイルで指定する必要があります。

### ガイドファイルの例

ソースファイルの構造に沿って、説明文を記述します。
リンク記法 `[表示文](URL)` を使用して、内部参照や外部URLを含めることができます。

```yaml
Resources:
  MyVPC:
    Description: プロダクション環境用のVPCメインネットワーク
    Properties:
      CidrBlock: VPC全体のIPv4アドレス範囲 (e.g. 10.0.0.0/16)。詳細は[サブネット設計](Resources.MySubnet)を参照してください。
      Tags:
        0:
          Value: コスト管理用のプロジェクトタグ
```

### エイリアスファイルの例

キー名をわかりやすい別名に置き換えます。エイリアスファイルはドット区切りのフラットな構造で定義します。

```yaml
"Resources.MyVPC": "メインVPC"
"Resources.MyVPC.Properties.CidrBlock": "CIDRブロック"
"Resources.MyVPC.Properties.Tags[]": "リソースタグ"
"Resources.MyVPC.Properties.Tags[].Key": "タグキー"
"Resources.MyVPC.Properties.Tags[].Value": "タグ値"
```

配列の全要素に対して同じエイリアスを一括適用する場合は、`[]` を使用します。

### Excludeファイルの例

不要なプロパティや配列要素を非表示にします。エイリアスファイルと同様にドット区切りのフラットな構造で指定します。

```yaml
# 基本的なプロパティの非表示
"tasks[].connectivityAt": true

# オブジェクト全体の非表示
"tasks[].overrides": true

# 配列要素の条件一致。特定のプロパティを持つ要素だけを隠します
"tasks[].attachments[].details[=name:subnetId]": true

# ワイルドカードと個別表示の組み合わせ
# containers以下のプロパティを全て隠し、nameとimageだけを表示させる
"tasks[].containers[].*": true
"tasks[].containers[].name": false
"tasks[].containers[].image": false
```

## 設定リファレンス

### グローバル設定

| キー | 説明 | デフォルト |
|---|---|---|
| `lang` | 出力HTMLの言語属性 | `ja` |
| `index` | インデックスページの設定。後述を参照 | なし |

### インデックスページ設定

| キー | 必須 | 説明 |
|---|---|---|
| `output` | ✓ | 出力先パス |
| `title` |  | ページタイトル。省略時は "Documentation Index" |

### ページ設定

> [!NOTE]
> パスを指定する項目は、設定ファイルが配置されているディレクトリを基準として解決されます。

| キー | 必須 | 説明 |
|---|---|---|
| `title` | ✓ | ドキュメントのタイトル |
| `sources` | ✓ | ソースYAMLファイルのリスト |
| `output` | ✓ | 出力先HTMLパス |
| `mode` |  | 解析モードを指定。例: `generic` |
| `guideDir` |  | ガイドファイルのディレクトリ |
| `aliasDir` |  | エイリアスファイルのディレクトリ |
| `excludeDir` |  | Excludeファイルのディレクトリ |

## 高度な使い方

### エイリアスのインポート

共通のエイリアス定義を別ファイルから取り込めます。

```yaml
_imports:
  - ../common/global_aliases.yml

"Resources.MyResource": "カスタムリソース"
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
