# opencode-telegram-send-file

An [OpenCode](https://opencode.ai) / [OpenWork](https://openwork.ai) plugin that adds a `telegram_send_file` tool — send any local file (PDF, image, etc.) directly to Telegram from your AI workspace.

**Zero configuration required.** The bot token and chat ID are resolved automatically from your OpenWork Telegram integration.

---

## What it does

Once installed, you can ask your AI assistant things like:

> *"Send me the Financing Plan PDF"*
> *"Send my photos from yesterday to Telegram"*
> *"Can you send the invoice to Telegram?"*

It will deliver the file straight to your Telegram chat — no manual token setup, no copy-pasting IDs.

**Images (JPEG, PNG, GIF, WEBP)** are sent via Telegram's `sendPhoto` API and appear as **inline photo previews** in the chat. All other files (PDFs, documents, etc.) are sent as standard file attachments via `sendDocument`.

---

## Requirements

- [OpenWork](https://openwork.ai) with **Telegram connected** (Settings → Messaging → Telegram)
- OpenCode `>= 1.2.0`

---

## Installation

### Global (recommended) — available in every workspace

Add the package to your global OpenCode plugin list:

```bash
cd ~/.config/opencode
npm install opencode-telegram-send-file
```

Then register it in `~/.config/opencode/config.json`:

```json
{
  "plugin": [
    "opencode-telegram-send-file"
  ]
}
```

Restart OpenWork — the `telegram_send_file` tool is now available in all your workspaces.

---

### Per-workspace — available in one project only

Add it to your workspace `config.json`:

```json
{
  "plugin": [
    "opencode-telegram-send-file"
  ]
}
```

Then install it in your workspace:

```bash
npm install opencode-telegram-send-file
```

---

## How it works

The plugin reads directly from OpenWork's own internal files — no extra config needed:

| What | Source |
|------|--------|
| Bot token | `~/.openwork/opencode-router/opencode-router.json` |
| Your Telegram chat ID | `~/.openwork/opencode-router/opencode-router.db` |

Sending logic:
- **Images** (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`) → `sendPhoto` → inline preview in Telegram
- **Everything else** (`.pdf`, `.docx`, etc.) → `sendDocument` → file attachment

---

## Usage

Once installed, just ask your assistant to send a file:

> *"Send me the Q1 report"*
> *"Can you send the invoice PDF to Telegram?"*
> *"Send my photos from yesterday"*

The assistant will call `telegram_send_file` with the file path and an optional caption.

---

## Contributing

PRs welcome! Built as part of the [OpenWork](https://openwork.ai) ecosystem.

## License

MIT
