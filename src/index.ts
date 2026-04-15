/**
 * opencode-telegram-send-file
 *
 * OpenCode plugin that adds a `telegram_send_file` tool.
 * Sends any local file (PDF, image, etc.) to the current Telegram chat
 * via the OpenWork router's /send endpoint.
 *
 * Zero config — binding resolution, retry logic, and multi-identity fan-out
 * are all handled by the router.
 *
 * Port discovery order:
 *   1. OPENCODE_ROUTER_HEALTH_PORT env var
 *   2. Read from running opencode-router process env via pgrep + ps (two steps,
 *      explicit shell to avoid subshell expansion issues in bundled context)
 *
 * Requires: OpenWork with Telegram connected (openwork.ai)
 */

import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { basename } from "path";
import { execSync } from "child_process";

/** Discover the OpenWork router port via multiple strategies. */
function discoverRouterPort(): number {
  // 1. Env var — set when opencode itself is launched with the router
  const fromEnv = process.env["OPENCODE_ROUTER_HEALTH_PORT"];
  if (fromEnv) {
    const p = Number(fromEnv.trim());
    if (Number.isFinite(p) && p > 0) return p;
  }

  // 2. Two-step ps approach: pgrep first (no subshell expansion needed),
  //    then ps on the PID directly. Explicit shell to ensure it works in
  //    Bun's bundled ESM context.
  try {
    const pid = execSync("pgrep -f opencode-router 2>/dev/null | head -1", {
      encoding: "utf8",
      timeout: 2000,
      shell: "/bin/sh",
    }).trim();
    if (pid) {
      const output = execSync(`ps eww ${pid}`, {
        encoding: "utf8",
        timeout: 2000,
        shell: "/bin/sh",
      });
      const match = output.match(/OPENCODE_ROUTER_HEALTH_PORT=(\d+)/);
      if (match) {
        const p = Number(match[1]);
        if (Number.isFinite(p) && p > 0) return p;
      }
    }
  } catch {
    // ignore — ps may not be available or router not running
  }

  // 3. Fallback — default port used in development
  return 3005;
}

// No argument destructuring at load time — matches opencode-scheduler's pattern.
// `directory` is captured lazily per-call via the ctx arg passed to the plugin.
const TelegramSendFilePlugin: Plugin = async (ctx) => {
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
          // Read directory lazily at call time, not at plugin load time
          const directory = ctx?.directory;
          const port = discoverRouterPort();
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
              `Port discovered: ${port} (set OPENCODE_ROUTER_HEALTH_PORT to override)\n` +
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

export { TelegramSendFilePlugin };
export default TelegramSendFilePlugin;
