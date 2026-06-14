# <img src="static/icons/icon.png" alt="containTAB" width="42" align="top"/> containTAB

Firefox extension that automatically opens websites in designated containers. containTAB is a private-use fork of [Containerise](https://github.com/kintesh/containerise), maintained by woolkingx and rewritten with one-tab-one-world isolation model.

## Features

- **Rule-based routing** — assign host patterns to containers (exact, glob `*.example.*`, fragment `@google`)
- **By-tab default containers** — unmatched URLs can auto-create isolated containers with short domain-prefixed sequence names (`github-01`, `youtube-01`)
- **Container lock** — once a tab enters a container, it stays there
- **Temporary containers** — lifetime `untilLastTab` auto-deletes the container when its last tab closes
- **Drill-down popup UI** — Rules / Containers / Settings with dedicated subpage flows for create, edit, import, and help
- **Dark mode** — follows system `prefers-color-scheme`

## Usage

### Rules

Three matching modes. No regex — just `*` and `@`.

**Exact** — no wildcard, matches one hostname only.

| Rule | Matches | Does not match |
|------|---------|----------------|
| `github.com` | `github.com` | `www.github.com` |

**Glob** — `*` means any string (zero or more characters).

| Rule | Matches | Does not match |
|------|---------|----------------|
| `*.github.com` | `www.github.com`, `docs.github.com` | `github.com` |
| `amazon.*` | `amazon.com`, `amazon.co.uk`, `amazon.jp` | `www.amazon.com` |
| `*.google.*` | `www.google.com`, `mail.google.co.jp` | `google.com` |

**Fragment** (`@`) — matches if hostname contains the text.

| Rule | Matches | Does not match |
|------|---------|----------------|
| `@google` | `google.com`, `www.google.com.tw`, `mygoogle.net` | `yahoo.com` |
| `@.google.` | `www.google.com`, `mail.google.co.jp` | `google.com` |
| `@amazon.co` | `amazon.com`, `amazon.co.uk` | `example.com` |

### Default Container

When enabled, URLs without a matching rule get their own container. The popup exposes named strategies such as `bytab`, grouping by domain, or grouping by host; raw naming templates are not part of the public UI.

### Container Lifetime

- **Forever** — container persists until manually deleted
- **Until last tab** — container auto-deletes when its last tab closes

### Recommended: ETP Standard Mode

Firefox's Enhanced Tracking Protection (ETP) defaults to Standard mode. Keep it there.

Each container has its own isolated cookie store — including third-party cookies. Trackers in container A cannot see cookies from container B. With one-tab-one-world, every tab gets its own cookie store, so third-party tracking is already isolated per-tab without needing Strict mode.

ETP Strict mode can break site logins and payment flows inside containers. Standard mode lets containTAB handle the isolation.

`Settings > Privacy & Security > Enhanced Tracking Protection > Standard`

## Development

```bash
npm ci                  # install dependencies
npm run webpack         # dev build with --watch
npm run web-ext         # launch Firefox with extension loaded
npm test                # run tests
npm run check:extension-identity # verify the canonical Firefox extension ID
npx vitest run --coverage  # with v8 coverage report
npm run build           # production build + lint + test
```

## Private install

Current private release: `0.3.0`.

Install the generated `web-ext-artifacts/containtab-0.3.0.zip` from file. The
manifest uses the private Firefox extension id `containtab@woolkingx.local` and
does not define `browser_specific_settings.gecko.update_url`, so this build does
not opt into self-hosted automatic updates or the original add-on update chain.

Storage is scoped by Firefox extension identity. Keep source, policy bundles,
and installed packages on `containtab@woolkingx.local`; changing IDs creates a
different `browser.storage.local` namespace.

Before upgrading or reinstalling from a differently signed build, export your
rules from `Settings > Import / Export rules > Export`. A signing or extension
ID change can move Firefox to a different storage namespace, so older rules may
not be visible to the newly installed build until they are imported again.

Known Lacuna caveat: same-ID install/update is the intended preservation path,
but formal signing, Firefox UUID assignment, and profile namespace behavior still
need future live-profile readback before being treated as fully proven.

## License

MIT — containTAB fork maintained by woolkingx; original [Containerise](https://github.com/kintesh/containerise) by Kintesh.
