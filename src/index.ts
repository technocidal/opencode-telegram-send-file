/**
 * opencode-telegram-send-file
 *
 * OpenCode plugin that adds a `telegram_send_file` tool.
 * Sends any local file (PDF, image, etc.) directly to Telegram via the Bot API —
 * no router dependency, no port discovery needed.
 *
 * Config is read from:
 *   ~/.openwork/opencode-router/opencode-router.json  → bot token
 *   ~/.openwork/opencode-router/opencode-router.db    → chat ID (bindings table)
 */

import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { basename, join } from "path";
import { homedir } from "os";
import { readFileSync } from "fs";
import { Database } from "bun:sqlite";

const CONFIG_PATH = join(homedir(), ".openwork", "opencode-router", "opencode-router.json");
const DB_PATH = join(homedir(), ".openwork", "opencode-router", "opencode-router.db");

interface BotConfig {
  token: string;
  directory: string;
  enabled: boolean;
}

interface RouterConfig {
  channels: {
    telegram: {
      bots: BotConfig[];
    };
  };
}

/** Read the bot token for the given workspace directory. */
function getBotToken(directory: string): string {
  let config: RouterConfig;
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as RouterConfig;
  } catch (err: any) {
    throw new Error(`Could not read OpenWork router config at ${CONFIG_PATH}: ${err.message}`);
  }
  const bots = config?.channels?.telegram?.bots ?? [];
  const bot = bots.find((b) => b.enabled && b.directory === directory);
  if (!bot) {
    // Fall back to the first enabled bot if directory doesn't match exactly
    const fallback = bots.find((b) => b.enabled);
    if (!fallback) throw new Error("No enabled Telegram bot found in OpenWork router config.");
    return fallback.token;
  }
  return bot.token;
}

/** Read the Telegram chat ID (peer_id) for the given workspace directory. */
function getChatId(directory: string): string {
  let db: Database;
  try {
    db = new Database(DB_PATH, { readonly: true });
  } catch (err: any) {
    throw new Error(`Could not open OpenWork router database at ${DB_PATH}: ${err.message}`);
  }
  try {
    const row = db
      .query<{ peer_id: string }, [string]>(
        "SELECT peer_id FROM bindings WHERE channel='telegram' AND directory=? ORDER BY updated_at DESC LIMIT 1"
      )
      .get(directory);
    if (!row) {
      throw new Error(
        `No Telegram binding found for directory "${directory}". ` +
          "Make sure the recipient has messaged the bot (e.g. /start) and is linked to this workspace."
      );
    }
    return row.peer_id;
  } finally {
    db.close();
  }
}

// Plugin function — no destructuring at load time (matches opencode-scheduler pattern).
const TelegramSendFilePlugin: Plugin = async (ctx) => {
  return {
    tool: {
      telegram_send_file: tool({
        description:
          "Send a local file (PDF, image, etc.) to the current Telegram chat. " +
          "Delegates to the OpenWork router — binding resolution and delivery are handled automatically.",
        args: {
          filePath: tool.schema.string().describe("Absolute path to the file to send"),
          caption: tool.schema.string().optional().describe("Optional caption to accompany the file"),
        },
        execute: async ({ filePath, caption }) => {
          // Resolve directory lazily at call time
          const directory = ctx?.directory ?? "";

          let token: string;
          let chatId: string;
          try {
            token = getBotToken(directory);
            chatId = getChatId(directory);
          } catch (err: any) {
            return `❌ Setup error: ${err.message}`;
          }

          const fileName = basename(filePath);
          let fileBuffer: Buffer;
          try {
            fileBuffer = readFileSync(filePath);
          } catch (err: any) {
            return `❌ Could not read file at "${filePath}": ${err.message}`;
          }

          const form = new FormData();
          form.append("chat_id", chatId);
          form.append("document", new Blob([fileBuffer]), fileName);
          if (caption) {
            form.append("caption", caption);
          }

          let response: Response;
          try {
            response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
              method: "POST",
              body: form,
            });
          } catch (err: any) {
            return `❌ Network error sending to Telegram: ${err.message}`;
          }

          if (!response.ok) {
            let detail = response.statusText;
            try {
              const body = (await response.json()) as any;
              detail = body?.description ?? body?.error ?? detail;
            } catch {
              // ignore parse error — use statusText
            }
            return `❌ Telegram API returned ${response.status}: ${detail}`;
          }

          return `✅ "${fileName}" sent successfully via Telegram.`;
        },
      }),
    },
  };
};

export { TelegramSendFilePlugin };
export default TelegramSendFilePlugin;
