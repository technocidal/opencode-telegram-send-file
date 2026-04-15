/**
 * opencode-telegram-send-file
 *
 * OpenCode plugin that adds a `telegram_send_file` tool.
 * Sends any local file (PDF, image, etc.) to the current Telegram chat
 * via the OpenWork router's /send endpoint.
 *
 * Zero config — binding resolution, retry logic, and multi-identity fan-out
 * are all handled by the router. The plugin only needs to know the router's
 * health-server port (OPENCODE_ROUTER_HEALTH_PORT, default 3005).
 *
 * Requires: OpenWork with Telegram connected (openwork.ai)
 */

import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { basename } from "path";

export const TelegramSendFilePlugin: Plugin = async ({ directory }) => {
  return {
    tool: {
      telegram_send_file: tool({
        description:
          "Send a local file (PDF, image, etc.) to the current Telegram chat. " +
          "Delegates to the OpenWork router — binding resolution and delivery are handled automatically.",
        args: {
          filePath: tool.schema
            .string()
            .describe("Absolute path to the file to send"),
          caption: tool.schema
            .string()
            .optional()
            .describe("Optional caption to accompany the file"),
        },
        execute: async ({ filePath, caption }) => {
          const port = process.env["OPENCODE_ROUTER_HEALTH_PORT"] ?? "3005";
          const url = `http://127.0.0.1:${port}/send`;

          const fileName = basename(filePath);

          const part: Record<string, string> = {
            type: "file",
            filePath,
            filename: fileName,
          };
          if (caption) {
            part["caption"] = caption;
          }

          let response: Response;
          try {
            response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                channel: "telegram",
                directory,
                parts: [part],
              }),
            });
          } catch (err: any) {
            return (
              `❌ Could not reach the OpenWork router at ${url}: ${err.message}\n` +
              "Make sure OpenWork is running and the router is connected."
            );
          }

          if (!response.ok) {
            let detail = response.statusText;
            try {
              const body = (await response.json()) as any;
              detail = body?.error ?? body?.message ?? detail;
            } catch {
              // ignore parse error — use statusText
            }
            return `❌ Router returned ${response.status}: ${detail}`;
          }

          return `✅ "${fileName}" sent successfully via Telegram.`;
        },
      }),
    },
  };
};

export default TelegramSendFilePlugin;
