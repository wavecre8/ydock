# ydock

> Turn YAML files into beautiful, interactive HTML documentation

Convert your YAML files (CloudFormation, configuration files, data definitions, etc.) into readable, interactive HTML documentation without modifying existing files.

## Quick Start

### Global Installation

```bash
npm install -g @wavecre8/ydock
ydock init
ydock build
```

### Direct Execution via npx

```bash
npx @wavecre8/ydock init
npx @wavecre8/ydock build
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
- 🚫 **Exclude Elements** - Flexibly hide unnecessary properties from the output using Exclude files.

> **Note:** Generated HTML uses Tailwind CSS via CDN. It requires internet access for styling.

### Additional Features
- 🧩 **Mode-Driven Architecture** - Switch parsing logic based on your use case. See [Supported Modes](#supported-modes).
- 🎨 **Display Modes** - Toggle between Inline, Tooltip, and the space-saving Compact View mode in the browser.
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

### 1. Initialize Project

Run `init` to generate a `setting.config.yml` configuration file.

```bash
ydock init
# or npx @wavecre8/ydock init
```

### 2. Configure

Edit `setting.config.yml` to define your target YAML files and build settings.

> [!NOTE]
> Relative paths specified in the configuration file (`sources`, `output`, `guideDir`, `aliasDir`, etc.) are always resolved **relative to the directory where the configuration file is located**.

```yaml
lang: en

index:
  output: output/index.html
  title: Documentation Portal

pages:
  - title: EC2 Architecture
    mode: cfn
    sources:
      - sources/vpc.yml
      - sources/ec2.yml
    guideDir: guides
    aliasDir: aliases
    excludeDir: excludes
    output: output/infrastructure.html
```

### 3. Run Build

```bash
ydock build -c setting.config.yml
# or npx @wavecre8/ydock build -c setting.config.yml
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
npx @wavecre8/ydock init
```

### `build`

Generate documentation based on configuration.

```bash
npx @wavecre8/ydock build [options]
```

**Options:**

| Option | Short | Description |
|---|---|---|
| `--config <path>` | `-c` | Path to config file (default: `setting.config.yml` or `.yaml`) |
| `--watch` | `-w` | **Watch Mode**: Rebuilds automatically on file changes and reloads browser |
| `--no-open` | | Do not open browser automatically in watch mode |

### `skeleton`

Analyze source YAML files specified in the configuration file and generate or update skeleton files for aliases, guides, and excludes. It safely appends missing keys to existing files without modifying your custom configurations.

```bash
ydock skeleton [options]
# or npx @wavecre8/ydock skeleton [options]
```

**Options:**

| Option | Short | Description |
|---|---|---|
| `--config <path>` | `-c` | Path to config file (default: `setting.config.yml` or `.yaml`) |
| `--type <type>` | `-t` | Type of skeleton to generate: `all`, `alias`, `guide`, `exclude` (default: `all`) |

### Watch Mode (Preview)

Use `--watch` for a real-time preview environment.

```bash
npx @wavecre8/ydock build -c setting.config.yml --watch
```

- **Hot Reload**: Browser reloads automatically when you save source or guide files.
- **Silent Build**: Suppresses console output after initial build.

## Guide, Alias & Exclude Files

### Placement Rules

The tool automatically searches for guide/alias files based on the source filename.

| Source File | Guide File | Alias File | Exclude File |
|---|---|---|---|
| `sources/vpc.yml` | `guides/vpc.guide.yml` | `aliases/vpc.alias.yml` | `excludes/vpc.exclude.yml` |
| `sources/ec2.yml` | `guides/ec2.guide.yml` | `aliases/ec2.alias.yml` | `excludes/ec2.exclude.yml` |

*Requires `guideDir`, `aliasDir`, and `excludeDir` in config.*

### Guide File Example

Write descriptions following the source structure. Use Markdown links `[Label](Key)` for internal references.

```yaml
Resources:
  MyVPC:
    Description: Main VPC for production environment
    Properties:
      CidrBlock: IPv4 address range for the VPC (e.g. 10.0.0.0/16). See [Subnet Design](Resources.MySubnet) for details.
```

### Alias File Example

Rename keys to friendly names. The alias file is defined using a flat, dot-separated structure.

```yaml
"Resources.MyVPC": "Main VPC"
"Resources.MyVPC.Properties.CidrBlock": "CIDR Block"
"Resources.MyVPC.Properties.Tags[]": "Resource Tags"
"Resources.MyVPC.Properties.Tags[].Key": "Tag Key"
"Resources.MyVPC.Properties.Tags[].Value": "Tag Value"
```

Use `[]` to apply the same alias to all items in an array.

### Exclude File Example

Hide unnecessary properties and array items. Like alias files, it uses a flat, dot-separated structure.

```yaml
# Hide specific basic properties
"tasks[].connectivityAt": true

# Hide an entire object
"tasks[].overrides": true

# Hide specific array items matching a condition
"tasks[].attachments[].details[=name:subnetId]": true

# Combine wildcards and overrides
# Hide everything in containers, then only show name and image
"tasks[].containers[].*": true
"tasks[].containers[].name": false
"tasks[].containers[].image": false
```

## Configuration Reference

### Global Settings

| Key | Description | Default |
|---|---|---|
| `lang` | HTML lang attribute | `ja` |
| `index` | Index page settings | None |

### Index Page Settings

| Key | Required | Description |
|---|---|---|
| `output` | ✓ | Output path |
| `title` |  | Page title (default: "Documentation Index") |

### Page Settings

> [!NOTE]
> Fields specifying paths are resolved relative to the directory where the configuration file is located.

| Key | Required | Description |
|---|---|---|
| `title` | ✓ | Document title |
| `sources` | ✓ | List of source YAML files |
| `output` | ✓ | Output HTML path |
| `mode` |  | Parsing mode (e.g., `generic`) |
| `guideDir` |  | Directory for guide files |
| `aliasDir` |  | Directory for alias files |
| `excludeDir` |  | Directory for exclude files |

## Advanced Usage

### Importing Aliases

Import common alias definitions from other files.

```yaml
_imports:
  - ../common/global_aliases.yml

"Resources.MyResource": "Custom Resource"
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
