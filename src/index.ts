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
 * Port discovery (in order):
 *   1. OPENCODE_ROUTER_HEALTH_PORT env var
 *   2. ~/.openwork/opencode-router/port file (written by router on startup)
 *   3. Pure-fetch probe: find orchestrator → read opencode port → scan ±50
 *   4. Fallback to 3005
 *
 * Requires: OpenWork with Telegram connected (openwork.ai)
 */

import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { basename, join } from "path";
import { homedir } from "os";
import { readFileSync } from "fs";

/** Quick HTTP health probe with a short timeout. Returns parsed JSON or null. */
async function probe(port: number, path = "/health", timeoutMs = 250): Promise<any> {
  try {
    const r = await Promise.race([
      fetch(`http://127.0.0.1:${port}${path}`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]) as Response;
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Discover the OpenWork router port. */
async function discoverRouterPort(): Promise<number> {
  // 1. Env var
  const fromEnv = process.env["OPENCODE_ROUTER_HEALTH_PORT"];
  if (fromEnv) {
    const p = Number(fromEnv.trim());
    if (Number.isFinite(p) && p > 0) return p;
  }

  // 2. Port file written by router on startup
  try {
    const portFile = join(homedir(), ".openwork", "opencode-router", "port");
    const contents = readFileSync(portFile, "utf8").trim();
    const p = Number(contents);
    if (Number.isFinite(p) && p > 0) return p;
  } catch {
    // file doesn't exist yet
  }

  // 3. Pure-fetch probe: find orchestrator → read opencode port → scan ±50
  try {
    const orchCandidates = [54065, 54064, 54066, 54063, 54067, 3006, 3007, 3008];
    const orchEnv = process.env["OPENWORK_DAEMON_PORT"];
    if (orchEnv) {
      const p = Number(orchEnv.trim());
      if (Number.isFinite(p)) orchCandidates.unshift(p);
    }

    let opencodePort: number | null = null;
    for (const p of orchCandidates) {
      const body = await probe(p);
      if (body?.daemon?.port === p && body?.opencode?.port) {
        opencodePort = body.opencode.port as number;
        break;
      }
    }

    if (opencodePort) {
      const probes: Array<Promise<{ port: number; body: any }>> = [];
      for (let i = -50; i <= 50; i++) {
        const port = opencodePort + i;
        probes.push(probe(port).then((body) => ({ port, body })));
      }
      const results = await Promise.all(probes);
      for (const { port, body } of results) {
        if (body?.ok === true && body?.channels && typeof body.channels === "object") {
          return port;
        }
      }
    }
  } catch { /* ignore */ }

  // 4. Fallback
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
          const port = await discoverRouterPort();
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
