# Changelog

## [0.3.0] - 2026-06-13

This release records the full private-development line from `0.2.2` through
`0.3.0`, including the intermediate `0.2.3` development builds.

### Added
- Handbook architecture atlas for data owners, object methods, runtime flow, proof gates, UI behavior, schemas, bug notes, decisions, and logic flow.
- Schema-owned runtime objects for global config, container extension metadata, default container strategy, assignment decisions, and tab/container state.
- `GlobalConfig` storage object with one-time migration from legacy `pref=*` settings into the `config` object.
- `ContainerExtension` storage object for containTAB-owned container lifetime and UI icon metadata.
- Default-container strategy support for by-tab, by-domain, and by-host creation.
- Default-container tests for short domain-prefixed by-tab sequence names.
- Manifest identity tests for the private Firefox extension ID.
- Fingerprint subsystem files and schemas for per-container fingerprint work, kept behind disabled/experimental gates.
- Theme mode setting with `system`, `light`, and `dark` choices.
- Dark theme SCSS palette and a three-tier cascade: explicit dark, explicit light, or system `prefers-color-scheme`.
- `applyTheme()` runtime helper for writing `document.documentElement.dataset.theme`.
- Native popup Settings runtime with save rollback and reset side-effect handling.
- Container edit UI for name, containTAB-owned icon, and lifetime.
- Multiline rule pattern inputs for semicolon-delimited host patterns.
- Rule import subpage with explicit paste/import feedback.
- In-popup confirmation for rule and container delete actions.
- Popup help content for hostname-only matching, semicolon OR rules, glob syntax, fragment syntax, and the no-regex rule model.
- Smoke parity gate for popup runtime/smoke DOM shape.
- Runtime UI design gate checks for smoke HTML/CSS/JS, style-guide CSS, runtime SCSS, and `ContainersSection.js` regression contracts.
- Extension identity gate verifies the canonical Firefox ID `containtab@woolkingx.local` across source, build, release zip, and bundled Lacuna policy packages.
- Lacuna storage identity known-issue documentation and proof-gate notes.
- Work plans for container edit UI, runtime-owner implementation, handbook topology cleanup, popup/lifecycle fixes, theme mode, schema-runtime convergence, UI token structure, settings-native runtime UI, Lacuna identity research, runtime UI projection SOP, and 0.3.0 release prep.

### Changed
- Public version moved from `0.2.2`/intermediate `0.2.3` to `0.3.0`.
- Popup runtime moved from ad hoc UI behavior toward handbook/smoke-driven projection.
- Popup UI rebuilt around the smoke-canonical subpage model.
- Rules is now the popup home tab.
- Rule add/edit/import, container create/edit, and Settings flows use dedicated subpages where applicable.
- Container edit is a subpage flow again, not a modal.
- Add rule container field starts empty; typed new container names create the Firefox contextual identity before writing the rule.
- Add rule and edit rule use a combobox-style container field: type a name or choose from dropdown.
- Runtime typography is normalized to a 15px base with larger tokens reserved for explicit titles.
- Settings rows use a fixed control column so select values and action buttons do not drift by content width.
- Default container strategy display uses `bytab`.
- Default container strategy moved from raw templates to named modes.
- Auto-created default containers use short domain-prefixed sequence names (`github-01`, `youtube-01`) instead of timestamp-like long names.
- Rule and container tables now project from data through filter/sort into rendered rows.
- Container list sorts by container name with `No Container` last.
- Rule rows resolve current container names from identity state, so renamed containers are reflected in the rule table.
- Row metrics, nav icon sizing, container/rule icon sizing, switch states, radius tokens, and reduced-motion handling were aligned with the smoke UI.
- Rule transfer stays user-activated through Settings and opens the import subpage rather than hidden backend behavior.
- Rule export CSV now uses portable `host,containerName,enabled` rows; import paste uses the same format and resolves names to the current profile's identities.
- Theme and container defaults were synced through handbook schema/docs surfaces.
- Private extension identity was pinned to `containtab@woolkingx.local`.
- Firebox/Lacuna policy and bundled XPI identities were aligned to the canonical private ID.
- `check-extension-identity` now reads the package version when finding the release zip.
- Runtime popup tests expanded around rule flow, container flow, settings flow, help, filters, import, delete confirmations, and smoke parity.
- Build/release docs now describe file-install packages rather than the original add-on update chain.

### Fixed
- Default container naming now uses `<domain>-01` style sequence numbers instead of long timestamp-like names.
- Default container lifetime creation uses the configured lifetime path.
- Settings writes now use await+rollback behavior on failure.
- Reset applies the active theme after preferences are restored.
- Bottom nav icon height is locked so image/SVG icons do not resize the nav.
- Container lifecycle cleanup is gated by owner preference and no longer relies on unsafe name regex cleanup.
- Tab lifecycle no longer cleans rules or container metadata through unsafe broad startup assumptions.
- Host input Enter now passes the correct lifetime toggle path when adding a rule.
- Rule import feedback and user activation were restored after runtime UI changes.
- Rule import remains backward-compatible with old `cookieStoreId` rows while preserving `No Container` round trips without exposing profile-local IDs in new exports.
- Rule deletion now uses in-popup confirmation.
- Rule lifetime controls, rule icons, and container icon metadata are aligned with the popup smoke model.
- Popup filters update on every input event, not only Enter.
- Container filter matches container name only; rule filter matches both container and rule pattern.
- Container rename no longer leaves stale names in the rule table.
- Create container and edit container behavior are separated; edit updates existing identity, create creates a new identity.
- `No Container` is no longer prefilled in add-rule container input.
- Settings select values no longer truncate due to content-width sizing.
- Dialog/action button typography was reduced back to the 15px base scale.
- Runtime/source/smoke drift that previously allowed modal/subpage and typography regressions is now blocked by gates.
- Lacuna packaging identity drift is documented as a known issue; source and bundled policy IDs are aligned to the canonical extension ID.
- `check-extension-identity` no longer hardcodes the old package zip version.
- Sass deprecation warnings and legacy JS API usage were cleaned up in the build path.

### Documentation
- Handbook now treats the smoke prototype as the UI behavior truth surface.
- UI popup docs, style docs, proof gates, schemas, logic flow, bug notes, decisions, and index navigation were updated for the runtime UI projection.
- Schema docs now cover container naming, global preferences, default container strategy, container extension metadata, assignment decisions, fingerprint config, tab state, and runtime architecture.
- Lacuna storage identity is documented as a known issue: same-ID installs should preserve storage, but formal signing / UUID / profile namespace behavior still needs future live-profile proof.
- CHANGELOG and README were refreshed for the 0.3.0 private release and the `0.2.2` to `0.3.0` change line.

### Verification
- `npm run check:ui-design`
- `npm test -- src/ui/__tests__/popup-smoke-parity.test.js src/ui/__tests__/popup-ui.test.js`
- `npm run lint`
- `npm run build`
- `npm run check:extension-identity`
- `web-ext-artifacts/containtab-0.3.0.zip` readback: manifest version `0.3.0`, extension ID `containtab@woolkingx.local`.

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
