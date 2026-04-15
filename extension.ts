/**
 * opencode-telegram-send-file — OpenWork extension format
 *
 * Drop this file into:
 *   ~/.openwork/openwork-orchestrator/opencode-config/tools/send_file_via_telegram.ts
 *
 * The OpenWork orchestrator loads it automatically — no config.json entry needed.
 *
 * Uses the tool() export format required by the OpenWork extension system.
 * For the standard OpenCode Plugin format, use index.ts instead.
 *
 * Zero config — the bot token and chat ID are resolved automatically
 * from the OpenWork router's own config and database:
 *
 *   Token:   ~/.openwork/opencode-router/opencode-router.json
 *   Chat ID: ~/.openwork/opencode-router/opencode-router.db (bindings table)
 *
 * Requires: OpenWork with Telegram connected (openwork.ai)
 */

import { tool } from "@opencode-ai/plugin";
import { readFile } from "fs/promises";
import { basename, join } from "path";
import { homedir } from "os";

const ROUTER_CONFIG_PATH = join(
  homedir(),
  ".openwork",
  "opencode-router",
  "opencode-router.json"
);

const ROUTER_DB_PATH = join(
  homedir(),
  ".openwork",
  "opencode-router",
  "opencode-router.db"
);

async function getRouterBotToken(directory: string): Promise<string | null> {
  try {
    const raw = await readFile(ROUTER_CONFIG_PATH, "utf8");
    const config = JSON.parse(raw) as any;
    const bots: any[] = config?.channels?.telegram?.bots ?? [];
    const bot = bots.find((b) => b.directory === directory && b.enabled);
    return bot?.token ?? null;
  } catch {
    return null;
  }
}

async function getRouterChatId(directory: string): Promise<string | null> {
  try {
    const { Database } = await import("bun:sqlite");
    const db = new Database(ROUTER_DB_PATH, { readonly: true });
    const row = db
      .query<{ peer_id: string }, [string]>(
        "SELECT peer_id FROM bindings WHERE channel = 'telegram' AND directory = ? ORDER BY updated_at DESC LIMIT 1"
      )
      .get(directory);
    db.close();
    return row?.peer_id ?? null;
  } catch {
    return null;
  }
}

export default tool({
  description:
    "Send a local file (PDF, image, etc.) to the current Telegram chat. " +
    "The bot token and chat ID are resolved automatically from the OpenWork router.",
  args: {
    filePath: tool.schema.string().describe("Absolute path to the file to send"),
    caption: tool.schema
      .string()
      .optional()
      .describe("Optional caption to accompany the file"),
  },
  async execute(args, context) {
    const directory = context.directory ?? "";

    const token = await getRouterBotToken(directory);
    if (!token) {
      return (
        "❌ Could not find a Telegram bot token for this workspace in the OpenWork router config. " +
        "Make sure Telegram is connected in OpenWork settings."
      );
    }

    const chatId = await getRouterChatId(directory);
    if (!chatId) {
      return (
        "❌ No Telegram binding found for this workspace. " +
        "The recipient must message the bot first (e.g. with /start), then retry."
      );
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(args.filePath);
    } catch (err: any) {
      return `❌ Could not read file at "${args.filePath}": ${err.message}`;
    }

    const fileName = basename(args.filePath);

    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append(
      "document",
      new Blob([fileBuffer], { type: "application/octet-stream" }),
      fileName
    );
    if (args.caption) {
      formData.append("caption", args.caption);
    }

    let response: Response;
    try {
      response = await fetch(
        `https://api.telegram.org/bot${token}/sendDocument`,
        { method: "POST", body: formData }
      );
    } catch (err: any) {
      return `❌ Network error while contacting Telegram: ${err.message}`;
    }

    const body = (await response.json()) as any;

    if (!response.ok || !body.ok) {
      const errDesc: string = body?.description ?? response.statusText;
      if (errDesc.toLowerCase().includes("chat not found")) {
        return (
          "❌ Chat not found. The recipient must message the bot first " +
          "(e.g. with /start), then retry."
        );
      }
      return `❌ Telegram error: ${errDesc}`;
    }

    return `✅ "${fileName}" sent successfully via Telegram.`;
  },
});
