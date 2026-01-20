# YamlDocDock

> Turn YAML files into beautiful, interactive HTML documentation

Convert your YAML files (CloudFormation, configuration files, data definitions, etc.) into readable, interactive HTML documentation without modifying existing files.

## Quick Start

### 1. Initialize Project
```bash
npx yamldocdock init
```
This generates a `setting.config.yml` file.

### 2. Build Documentation
```bash
npx yamldocdock build
```

---

## Development & Architecture

For internal structure and development guidelines, please refer to:

- [**ARCHITECTURE.md**](./ARCHITECTURE.md) - System design, directory structure, class roles
- [**CONTRIBUTING.md**](./CONTRIBUTING.md) - Setup, testing, coding standards

## Key Features

### Core Features
- 🔒 **Secure** - Build process runs entirely locally. Your YAML data is never sent externally.
- ✨ **Non-Destructive** - Document existing source YAMLs without editing them.
- 📝 **Flexible** - Add descriptions and display names via Guide and Alias files.

> **Note:** Generated HTML uses Tailwind CSS via CDN. It requires internet access for styling.

### Additional Features
- 🧩 **Mode-Driven Architecture** - Switch parsing logic based on your use case. See [Supported Modes](#supported-modes).
- 🎨 **Display Modes** - Toggle between Inline and Tooltip modes in the browser.
- 🏷️ **Alias System** - Rename technical keys to human-readable labels.
- 📑 **Index Portal** - Automatically generate a portal page for multiple documents.
- 🛠️ **Deep Linking** - Link directly to deeply nested properties.
- 📏 **Resizable UI** - Adjust column widths and sidebar width.
- 🖨️ **Print Friendly** - Automatically hides sidebar for clean printing.

## Supported Modes

| Mode Name | Identifier | Description |
|---|---|---|
| **Generic** | `generic` | For standard YAML files (Default). Provides smart merging and alias support. |
| **CloudFormation** | `cfn` | Specialized for AWS CloudFormation. Handles intrinsic functions, section ordering, and custom tags. |

## Basic Usage

### Configuration

Create `setting.config.yml` to define build settings.

```yaml
lang: en

index:
  output: sample/output/index.html
  title: Documentation Portal

pages:
  - title: EC2 Architecture
    mode: cfn
    sources:
      - sample/sources/vpc.yml
      - sample/sources/ec2.yml
    guideDir: sample/guides
    aliasDir: sample/aliases
    output: sample/output/infrastructure.html
```

### Run Build

```bash
npx yamldocdock build -c setting.config.yml
```

## Command Reference

### Global Options

| Option | Short | Description |
|---|---|---|
| `--version` | `-V` | Output the version number |
| `--help` | `-h` | Display help for command |

### `init`

Generate a default `setting.config.yml` in the current directory.

```bash
npx yamldocdock init
```

### `build`

Generate documentation based on configuration.

```bash
npx yamldocdock build [options]
```

**Options:**

| Option | Short | Description |
|---|---|---|
| `--config <path>` | `-c` | Path to config file (default: `setting.config.yml` or `.yaml`) |
| `--watch` | `-w` | **Watch Mode**: Rebuilds automatically on file changes and reloads browser |
| `--no-open` | | Do not open browser automatically in watch mode |

### Watch Mode (Preview)

Use `--watch` for a real-time preview environment.

```bash
npx yamldocdock build -c setting.config.yml --watch
```

- **Hot Reload**: Browser reloads automatically when you save source or guide files.
- **Silent Build**: Suppresses console output after initial build.

## Guide & Alias Files

### Placement Rules

The tool automatically searches for guide/alias files based on the source filename.

| Source File | Guide File | Alias File |
|---|---|---|
| `sources/vpc.yml` | `guides/vpc_guide.yml` | `aliases/vpc_alias.yml` |
| `sources/ec2.yml` | `guides/ec2_guide.yml` | `aliases/ec2_alias.yml` |

*Requires `guideDir` and `aliasDir` in config.*

### Guide File Example

Write descriptions following the source structure. Use Markdown links `[Label](Key)` for internal references.

```yaml
Resources:
  MyVPC:
    Description: Main VPC for production environment
    Properties:
      CidrBlock: IPv4 address range for the VPC (e.g. 10.0.0.0/16)
```

### Alias File Example

Rename keys to friendly names.

```yaml
Resources:
  MyVPC:
    _alias: Main VPC
    Properties:
      CidrBlock: CIDR Block
      Tags:
        "*":
          Key: Tag Key
          Value: Tag Value
```

Use `*` wildcard to apply aliases to all array items.

## Configuration Reference

### Global Settings

| Key | Description | Default |
|---|---|---|
| `language` | HTML lang attribute | `ja` |
| `index` | Index page settings | None |

### Index Page Settings

| Key | Required | Description |
|---|---|---|
| `output` | ✓ | Output path |
| `title` |  | Page title (default: "Documentation Index") |

### Page Settings

| Key | Required | Description |
|---|---|---|
| `title` | ✓ | Document title |
| `sources` | ✓ | List of source YAML files |
| `output` | ✓ | Output HTML path |
| `mode` |  | Parsing mode (e.g., `generic`) |
| `guideDir` |  | Directory for guide files |
| `aliasDir` |  | Directory for alias files |

## Advanced Usage

### Importing Aliases

Import common alias definitions from other files.

```yaml
_imports:
  - ../common/global_aliases.yml

Resources:
  MyResource:
    _alias: Custom Resource
```

### Merging Multiple Files

Specify multiple files in `sources` to merge them into one document.

```yaml
pages:
  - title: Integrated Docs
    sources:
      - base.yml
      - network.yml
      - compute.yml
    output: merged.html
```
