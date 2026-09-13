# ydock Architecture

## 1. Project Overview

**ydock** is a tool that parses YAML files and generates modern, interactive single-page HTML documentation.
It is designed to securely document infrastructure definitions (like CloudFormation) containing sensitive information locally, without sending data to external services.

### Core Concepts
*   **Overlay Integration**: Renders by integrating Source YAML, Guide YAML, Alias YAML, and Exclude definitions.
*   **Mode Driven**: Switches parsing and display logic between `generic` (General purpose) and `cfn` (CloudFormation) modes.
*   **Single Artifact**: Generates a single HTML file with inlined CSS/JS for easy distribution.

---

## 2. Architecture Components

### 2.1. Core Components (`src/core/`)

*   **Builder (`builder.ts`)**:
    *   **Orchestrator**: Called from CLI or other entry points. Controls the entire build process including config loading, source loading, guide application, and HTML generation.
    *   Core build logic. `cli.ts` acts as a thin wrapper around this.
*   **Loader (`loader.ts`)**:
    *   Wraps `js-yaml` and parses using the appropriate schema via `ModeStrategy`.
*   **AliasProcessor (`alias-processor.ts`)**:
    *   Handles loading and transformation of alias files. Provides wildcard expansion and import capabilities.
*   **ExcludeProcessor (`exclude-processor.ts`)**:
    *   Handles loading of exclude configuration files and transforming them into hierarchical tree structures.
*   **DocumentPreprocessor (`document-preprocessor.ts`)**:
    *   Preprocesses documents by pruning unnecessary properties and array items according to the exclude tree.
*   **Merger (`merger.ts`)**:
    *   Merges Source, Guide, and Alias data using `lodash.mergeWith`.
*   **Generator (`generator.ts`)**:
    *   Receives merged data and generates HTML using EJS templates.
*   **Renderer (`renderer.ts`)**:
    *   Encapsulates complex rendering logic (metadata extraction, tooltip generation, etc.).

### 2.2. Strategy Pattern (`src/modes/`)

Mode-specific logic is separated as implementations of the `ModeStrategy` interface.

| Feature | Generic Mode (`GenericStrategy`) | CFn Mode (`CfnStrategy`) |
| :--- | :--- | :--- |
| **Schema** | `DEFAULT_SCHEMA` | `CLOUDFORMATION_SCHEMA` (Custom Tags Support) |
| **Merge Logic** | **Smart Merge**: Concats arrays, lists scalar conflicts | Default (Overwrite) |
| **Section Sort** | Maintains source order | **Strict Order**: `Parameters`, `Resources`, `Outputs`, etc. |

---

## 3. Data Flow & Logic

### 3.1. Link System (Deep Linking)
HTML elements are assigned unique IDs in the format: `{SectionName}__{LogicalID}__{PropertyPath}`.
Path segments are sanitized (non-alphanumeric characters replaced with `_`).

### 3.2. Client-Side Behavior (`src/templates/script.js`)
*   **Display Mode**: Toggle between Inline Mode / Tooltip Mode.
*   **Tooltip**: Show on hover, pin on click.
*   **Resizing**: Table column and sidebar resizing (Size is NOT saved to `localStorage` by design).
