# Changelog

## [0.2.2] - 2026-04-12

### Changed
- Build system: declare `"type": "module"` in package.json; rename `webpack.{common,dev,prod}.js` → `.cjs`
- Babel-loader: add `resolve: { fullySpecified: false }` to handle ESM bare specifiers
- Test count: 232 → 362 (fingerprint subsystem tests added)

### Added
- Vitest v8 coverage reporter (`npm run test -- --coverage`); output to `coverage/`
- `src/fingerprint/prng.js` — PRNG moved out of `src/core/` into fingerprint subsystem

### Fixed
- `MODULE_TYPELESS_PACKAGE_JSON` webpack warning eliminated
- `src/core/index.js`: removed `createPRNG` export (prng no longer a core concern)
- Fingerprint hooks in `ContextualIdentity/index.js` marked `DISABLED` explicitly

## [0.2.0] - 2026-04-09

### Changed
- Unified test runner: jest → vitest (232 tests)
- Rule input: container dropdown replaced with text input for container name
- Help: inline toggle replaced with dedicated sub-screen
- Rule list sorted by container name, then host
- Popup height: auto-grow with max-height = screen height / 3
- Matching terminology: "regex" corrected to "fragment" (zero regex, uses `hostname.includes`)
- Documentation reduced from 11,488 to 1,837 lines (-84%)

### Added
- Lifetime toggle button on each rule row (temp/keep)
- Filter dropdown moved to top of rules section
- Pure functions extracted to core: `isRedirectable()`, `canNavigateTo()`, `targetContainer()`, `hasRules()`
- 10 new tests for extracted functions
- 2 skills extracted: handle-debug, module-boundary

### Fixed
- Empty `cookieStoreId` silently skipped rule match — now creates container on match
- In-memory tab count lost on restart — replaced with live `browser.tabs.query`
- `33vh` popup height collapsed in Firefox — uses `window.screen.height / 3`
- Dead code removed: `ExtendedURL/`, `filterByKey`, `v2/`

## [0.1.2] - 2026-04-08

### Fixed
- Build pipeline: `npm run build` now passes lint + test + webpack + web-ext
- `.gitignore`: exclude `dist/` from eslint scan
- Core tests: removed `import from 'vitest'` (jest uses globals)
- HostStorage test: fixed API call to match rewritten `get()` signature
- Jest config: exclude `.cleanup/` from test discovery
- Icon scaled to fill canvas (no more oversized padding)

## [0.1.1] - 2026-04-08

### Changed
- New 3D isometric icon (2x2x2 cube grid, 4 container colors)
- Popup width now auto-adapts to content (removed fixed min-width)

### Fixed
- SCSS: all hardcoded colors migrated to CSS custom properties
- Dark mode: Firefox Proton palette via `prefers-color-scheme`
- System font stack replacing Helvetica Neue

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
