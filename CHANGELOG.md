# Changelog

## [0.1.0] - 2026-04-08

Fork of [Containerise 3.9.0](https://github.com/kintesh/containerise). Full rewrite.

### Added
- Pure function core modules: matcher, lock, naming, URL parsing (54 tests)
- Drill-down popup UI replacing tab-based layout and options page
- Container management: create, rename, delete (with rule cascade), lifetime control
- Rule management: add, delete, toggle, inline edit host patterns
- Settings panel: keepOldTabs, defaultContainer toggle with template and lifetime
- Dark mode via `prefers-color-scheme` and CSS custom properties
- System font stack, touch-target-safe controls

### Changed
- One-tab-one-world isolation: each unmatched URL gets its own container (`domain-001`)
- Container lock: tabs stay in their container, no escape
- Temporary container cleanup on last tab close and on startup
- Removed `options_ui` — all settings live in the popup
- Removed CSV editor, legacy RuleManager, TabNavigator

### Fixed
- `temporaryContainers.js` startup cleanup used wrong import (ReferenceError)
- Lifetime select race condition in ContainersSection
- Non-atomic rule rename (delete-then-create) reordered to safe create-then-delete
- Missing duplicate host validation when adding rules


## Pre-fork History

See [Containerise changelog](https://github.com/kintesh/containerise/blob/master/CHANGELOG.md) for versions 1.0.0 through 3.9.0.
