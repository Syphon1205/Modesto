# modesto-appshot-helper

Long-running macOS helper for Modesto Appshots.

## Role

- Watches for **both Option keys** (left + right) via a `CGEventTap`
- Captures the frontmost on-screen window as PNG
- Reads available Accessibility text from that app (best-effort)
- Emits JSON lines to a Unix domain socket owned by the Electron main process

## Build

```bash
./build.sh
# or
./build.sh /path/to/output-dir
```

Produces `modesto-appshot-helper` in `./build` (or the given output directory).

## Runtime

Electron sets:

- `MODESTO_APPSHOT_SOCKET` — absolute path to the Unix domain socket

Optional stdin commands (one per line):

- `capture` — take an appshot immediately (used by `appshots.captureNow`)
- `quit` — exit cleanly

## Wire format

Each event is one JSON object followed by a newline:

```json
{
  "type": "appshot",
  "appName": "Safari",
  "windowTitle": "Example",
  "accessibilityText": "...",
  "pngBase64": "...",
  "capturedAt": "2026-09-09T19:00:00.000Z"
}
```

Error events use `"type": "error"` with an `"message"` string.
