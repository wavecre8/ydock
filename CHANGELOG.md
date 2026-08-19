# Changelog
 
All notable changes to this project will be documented in this file.
 
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
## [1.0.0] - 2026-08-20
 
### Added
- Initial public release of ydock.
- **Core**: YAML parsing and HTML generation engine.
- **Modes**: Support for `generic` and `cfn` parsing modes.
- **UI**: Interactive single-page HTML documentation.
  - Deep linking to properties.
  - Inline and tooltip display modes.
  - Compact view mode for better space efficiency.
  - Resizable sidebar and table columns.
- **CLI**: `init`, `build`, and `skeleton` commands.
- **Customization**:
  - Guide files for documentation descriptions.
  - Alias files for renaming keys with flat path support.
  - Exclude files for flexibly hiding unnecessary properties.
