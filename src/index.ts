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
 *   1. OPENCODE_ROUTER_HEALTH_PORT env var (set when running inside the router process)
 *   2. Read from openwork-orchestrator-state.json (router port stored there)
 *   3. Scan the running opencode-router process's environment via `ps`
 *
 * Requires: OpenWork with Telegram connected (openwork.ai)
 */

import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { basename, join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

/** Discover the OpenWork router port via multiple strategies. */
function discoverRouterPort(): number {
  // 1. Env var — set when opencode itself is launched with the router
  const fromEnv = process.env["OPENCODE_ROUTER_HEALTH_PORT"];
  if (fromEnv) {
    const p = Number(fromEnv.trim());
    if (Number.isFinite(p) && p > 0) return p;
  }

  // 2. orchestrator state file — written by OpenWork daemon on startup
  try {
    const statePath = join(
      homedir(),
      ".openwork",
      "openwork-orchestrator",
      "openwork-orchestrator-state.json"
    );
    const raw = require("fs").readFileSync(statePath, "utf8");
    const state = JSON.parse(raw);
    // The router sidecar writes its port into the state under various keys.
    // Walk all values looking for { port: number } entries that aren't
    // the opencode or daemon ports we already know about.
    const knownPorts = new Set([
      state?.opencode?.port,
      state?.daemon?.port,
    ]);
    function findRouterPort(obj: any): number | undefined {
      if (!obj || typeof obj !== "object") return undefined;
      if (typeof obj.port === "number" && !knownPorts.has(obj.port)) {
        // Quick health-check to confirm it's the router
        return obj.port;
      }
      for (const v of Object.values(obj)) {
        const found = findRouterPort(v);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    const statePort = findRouterPort(state);
    if (statePort) return statePort;
  } catch {
    // ignore — file may not exist yet
  }

  // 3. Read port from the running opencode-router process environment via ps
  try {
    const output = execSync(
      "ps eww $(pgrep -f opencode-router 2>/dev/null | head -1) 2>/dev/null",
      { encoding: "utf8", timeout: 3000 }
    );
    const match = output.match(/OPENCODE_ROUTER_HEALTH_PORT=(\d+)/);
    if (match) {
      const p = Number(match[1]);
      if (Number.isFinite(p) && p > 0) return p;
    }
  } catch {
    // ignore
  }

  // 4. Fallback — default port used in development
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
