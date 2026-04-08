# <img src="static/icons/icon.png" alt="containTAB" width="42" align="top"/> containTAB

Firefox extension that automatically opens websites in designated containers. Fork of [Containerise](https://github.com/kintesh/containerise), rewritten with one-tab-one-world isolation model.

## Features

- **Rule-based routing** — assign host patterns to containers (exact, glob `*.example.com`, regex `@.+\.example\.com$`)
- **One-tab-one-world** — unmatched URLs auto-create isolated containers with sequential naming (`github.com-001`, `github.com-002`)
- **Container lock** — once a tab enters a container, it stays there
- **Temporary containers** — lifetime `untilLastTab` auto-deletes the container when its last tab closes
- **Drill-down popup UI** — main screen with 3 cards (Rules / Containers / Settings), each opens a dedicated sub-screen
- **Dark mode** — follows system `prefers-color-scheme`

## Usage

### Rules

| Pattern | Example | Match |
|---------|---------|-------|
| Exact | `github.com` | `github.com` only |
| Glob | `*.github.com` | all subdomains |
| Regex | `@.+\.github\.com$` | regex match |

### Default Container

When enabled, URLs without a matching rule get their own container. Configure the naming template with variables: `{domain}`, `{fqdn}`, `{tld}`, `{host}`, `{ms}`.

### Container Lifetime

- **Forever** — container persists until manually deleted
- **Until last tab** — container auto-deletes when its last tab closes

## Development

```bash
npm ci                  # install dependencies
npm run webpack         # dev build with --watch
npm run web-ext         # launch Firefox with extension loaded
npx vitest run          # run core tests (54 tests)
npm run build           # production build + lint + test
```

## License

MIT — see original [Containerise](https://github.com/kintesh/containerise) by Kintesh.
