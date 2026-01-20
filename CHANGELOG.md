# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-20

### Added
- Initial public release of YamlDocDock.
- **Core**: YAML parsing and HTML generation engine.
- **Modes**: Support for `generic` (standard YAML) and `cfn` (CloudFormation) parsing modes.
- **UI**: Interactive generic single-page HTML output.
  - Deep linking to properties.
  - Tooltip mode for descriptions.
  - Resizable sidebar and table columns.
- **CLI**: `init` and `build` commands for easy project setup.
- **Aliases**: Robust alias system for renaming keys and adding descriptions via guide files.
