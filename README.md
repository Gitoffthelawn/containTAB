# <img src="static/icons/icon.png" alt="containTAB" width="42" align="top"/> containTAB

Firefox extension that automatically opens websites in designated containers. Fork of [Containerise](https://github.com/kintesh/containerise), rewritten with one-tab-one-world isolation model.

## Features

- **Rule-based routing** — assign host patterns to containers (exact, glob `*.example.*`, fragment `@google`)
- **One-tab-one-world** — unmatched URLs auto-create isolated containers with sequential naming (`github.com-001`, `github.com-002`)
- **Container lock** — once a tab enters a container, it stays there
- **Temporary containers** — lifetime `untilLastTab` auto-deletes the container when its last tab closes
- **Drill-down popup UI** — main screen with 3 cards (Rules / Containers / Settings), each opens a dedicated sub-screen
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

When enabled, URLs without a matching rule get their own container. Configure the naming template with variables: `{domain}`, `{fqdn}`, `{tld}`, `{host}`, `{ms}`.

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
npx vitest run          # run tests (232 tests)
npm run build           # production build + lint + test
```

## License

MIT — see original [Containerise](https://github.com/kintesh/containerise) by Kintesh.
