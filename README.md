# opencode-telegram-send-file

An [OpenCode](https://opencode.ai) / [OpenWork](https://openwork.ai) plugin that adds a `telegram_send_file` tool — send any local file (PDF, image, etc.) directly to Telegram from your AI workspace.

**Zero configuration required.** The bot token and chat ID are resolved automatically from your OpenWork Telegram integration.

---

## What it does

Once installed, you can ask your AI assistant things like:

> *"Send me the Financing Plan PDF"*
> *"Send the report to Telegram"*

And it will deliver the file straight to your Telegram chat. No manual token setup, no copy-pasting IDs.

## Requirements

- [OpenWork](https://openwork.ai) with **Telegram connected** (Settings → Messaging → Telegram)
- OpenCode `>= 1.2.0`

---

## Installation

### Option A — Local workspace plugin *(recommended for a single project)*

Installs the tool only in the current workspace.

1. Copy `index.ts` into your workspace's `.opencode/plugins/` folder:

```bash
mkdir -p .opencode/plugins
curl -o .opencode/plugins/telegram-send-file.ts \
  https://raw.githubusercontent.com/technocidal/opencode-telegram-send-file/main/index.ts
```

2. Register it in your workspace `config.json`:

```json
{
  "plugin": [
    ".opencode/plugins/telegram-send-file.ts"
  ]
}
```

3. Restart OpenWork — the tool is now live in this workspace.

---

### Option B — Global plugin *(available in every workspace on this machine)*

Installs the tool machine-wide so it's available in **all** your OpenCode/OpenWork workspaces without per-project config.

1. Copy `index.ts` into your global plugins folder:

```bash
mkdir -p ~/.config/opencode/plugins
curl -o ~/.config/opencode/plugins/telegram-send-file.ts \
  https://raw.githubusercontent.com/technocidal/opencode-telegram-send-file/main/index.ts
```

2. Register it in your global `~/.config/opencode/config.json`:

```json
{
  "plugin": [
    "~/.config/opencode/plugins/telegram-send-file.ts"
  ]
}
```

3. Restart OpenWork — the tool is available in every workspace.

---

### Option C — OpenWork extension *(loaded by the OpenWork orchestrator directly)*

OpenWork can load tool extensions from its own tools directory. Files placed there are automatically available to the OpenWork orchestrator, without needing a `config.json` entry.

> **Note:** This format uses the `tool()` export from `@opencode-ai/plugin`, which is slightly different from the full `Plugin` export. A separate `extension.ts` entry point is provided for this use case.

1. Copy `extension.ts` into the OpenWork tools folder:

```bash
mkdir -p ~/.openwork/openwork-orchestrator/opencode-config/tools
curl -o ~/.openwork/openwork-orchestrator/opencode-config/tools/telegram_send_file.ts \
  https://raw.githubusercontent.com/technocidal/opencode-telegram-send-file/main/extension.ts
```

2. Restart OpenWork — no `config.json` changes needed.

---

### Option D — npm *(coming soon)*

Once published to npm, you'll be able to install it by adding the package name to any `config.json`:

```json
{
  "plugin": [
    "opencode-telegram-send-file"
  ]
}
```

Bun will auto-install it on next startup.

---

## How it works

The plugin reads directly from OpenWork's own internal files — no extra config needed:

| What | Source |
|------|--------|
| Bot token | `~/.openwork/opencode-router/opencode-router.json` |
| Your Telegram chat ID | `~/.openwork/opencode-router/opencode-router.db` |

---

## Usage

Once installed, just ask your assistant to send a file:

> *"Send me the Q1 report"*
> *"Can you send the invoice PDF to Telegram?"*

The assistant will call `telegram_send_file` with the file path and an optional caption.

You can also invoke it explicitly in a prompt:

```
Send /path/to/file.pdf to Telegram with caption "Here's the document!"
```

---

## Contributing

PRs welcome! Built as part of the [OpenWork](https://openwork.ai) ecosystem.

## License

MIT
