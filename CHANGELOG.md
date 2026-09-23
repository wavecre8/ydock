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

## [1.0.1] - 2026-08-24

### Fixed
- **String Parsing & Escaping**: Fixed HTML rendering and clipboard copy issues when handling strings containing regular expressions or special characters.
- **Watch Mode**: Fixed watch mode startup issues by unsuppressing initial build logs, properly resolving server base directories, and adding `excludeDir` to file watch paths.

### Changed
- **Skeleton Generation**: Improved exclude skeleton generation to skip appending child keys when an ancestor path is already set to `true`.

## [1.0.2] - 2026-09-13

### Added
- **Global Directory Configuration**: Added support for specifying `guideDir`, `aliasDir`, and `excludeDir` at the top level of `setting.config.yml`, removing the need for redundant per-page definitions while maintaining per-page overrides.

### Fixed
- Bug fixes.

## [1.1.0] - 2026-09-15

### Added
- **HTML Minification**: Minified generated HTML files to reduce file size.
- **Portal Site Enhancements**: Added page grouping functionality and adjusted the layout accordingly.

### Fixed
- Bug fixes.

## [1.1.1] - 2026-09-17

### Added
- **Sidebar Collapse**: Added sidebar collapse and expand toggle functionality, with the sidebar open by default on every page load.

### Changed
- **Portal Site UI**: Adjusted layout and added highlight display.

### Fixed
- Bug fixes.