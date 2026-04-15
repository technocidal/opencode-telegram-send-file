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

## Installation

### Option A — Local plugin (recommended for your own workspace)

1. Copy `index.ts` into your workspace's `.opencode/plugins/` folder:

```bash
mkdir -p .opencode/plugins
curl -o .opencode/plugins/telegram-send-file.ts \
  https://raw.githubusercontent.com/technocidal/opencode-telegram-send-file/main/index.ts
```

2. Register it in your `config.json`:

```json
{
  "plugin": [
    ".opencode/plugins/telegram-send-file.ts"
  ]
}
```

3. Restart OpenWork — the tool is now live.

### Option B — npm (coming soon)

```json
{
  "plugin": [
    "opencode-telegram-send-file"
  ]
}
```

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
