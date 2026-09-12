# Secret hygiene before publishing

Keep credentials, local agent state, databases, signing identities, and generated
installers out of Git. Root `.gitignore` covers common local files and preserves
`.env.example`, `.env.sample`, and `.env.template` variants. Templates must contain
placeholders only.

Never add these to a source snapshot:

- `.modesto/`, `.modesto-*/`, and any `userdata/` home (session DBs, provider logs, tokens)
- `.env`, `.env.local`, `.npmrc`, `.p8` Apple AuthKeys, `credentials.json`, `secrets.json`
- `CURSOR_HANDOFF.md`, root screenshot dumps, and editor logs
- `node_modules/`, `dist/`, `.turbo/`, `coverage/`, `*.dmg` / `*.AppImage` / `*.exe`

Current product source is **AGPL-3.0-only** (`LICENSE`, `package.json`). Do not
relabel it MIT. Historical 0.3.x / 0.4.x notes may still say MIT because those
releases were.

Ignore rules do not remove files that are already tracked and do not sanitize Git
history. Review the staged file list and scan the exact source tree being
published. Upload installers as GitHub Release assets, after checking their
packaged contents for runtime state and credentials.

## Source and history checks

Use Gitleaks 8.30 or newer with the repository's `.gitleaks.toml`:

```sh
git diff --cached --name-only
gitleaks git --staged --redact --no-banner
gitleaks git --log-opts="--all" --redact --no-banner
```

For a complete source snapshot, scan a temporary export of tracked and intended
new files with `gitleaks dir --redact --no-banner --config /absolute/path/to/.gitleaks.toml`.
A staged-diff scan alone does not inspect unchanged files. Store scan reports
outside the repository, and keep output redacted when sharing findings.

The scanner configuration has narrow exceptions for reviewed public test keys,
request identifiers, a WebSocket handshake nonce, and the pairing alphabet. It
does not exempt test directories or disable credential detection rules.

If a real credential is found, revoke or rotate it first. Remove it from the
source and decide whether history needs cleanup before publishing. Never push
unreviewed local branches or tags with `--all` or `--mirror`. A clean source
snapshot does not establish that unrelated historical refs are safe to publish.

CI and release preflight run `bash scripts/scan-release-source.sh` against
`git archive HEAD`, scanning only the exact source snapshot being published.
The script uses local Gitleaks when available, otherwise the pinned container.
