import { ZenRows, type ZenRowsConfig } from "zenrows";
import type { ZenrowsToolsOptions } from "./types.js";

export const DEFAULT_MAX_CONTENT_LENGTH = 100_000;

export function createClient(options: ZenrowsToolsOptions): ZenRows {
  if (!options.apiKey) {
    throw new Error(
      "Zenrows tools need an API key. Pass { apiKey } to the factory, e.g. " +
        "createZenrowsTools({ apiKey: process.env.ZENROWS_API_KEY! }).",
    );
  }
  return new ZenRows(options.apiKey, {
    concurrency: options.concurrency,
    retries: options.retries,
  });
}

/**
 * Resolve Adaptive Stealth against the options a caller actually chose.
 *
 * Zenrows rejects `mode=auto` together with `js_render` or `premium_proxy`, and
 * several options imply a browser. A model picking those options should not
 * burn a turn on a rejected request, so this drops stealth and turns on what
 * the option needs instead of erroring.
 */
export function resolveTier(config: {
  adaptiveStealth: boolean;
  jsRender?: boolean;
  premiumProxy?: boolean;
  needsBrowser?: boolean;
}): Pick<ZenRowsConfig, "mode" | "js_render" | "premium_proxy"> {
  const jsRender = config.jsRender || config.needsBrowser || false;
  const premiumProxy = config.premiumProxy || false;

  if (config.adaptiveStealth && !jsRender && !premiumProxy) {
    return { mode: "auto" };
  }
  return {
    ...(jsRender ? { js_render: true } : {}),
    ...(premiumProxy ? { premium_proxy: true } : {}),
  };
}

/** Everything a failed Zenrows call should tell the model, and nothing more. */
export async function describeFailure(response: Response, url: string): Promise<string> {
  const status = response.status;
  let code = "";
  let detail = "";
  try {
    const body = (await response.clone().json()) as { code?: unknown; detail?: unknown };
    if (typeof body.code === "string") code = body.code;
    if (typeof body.detail === "string") detail = body.detail;
  } catch {
    detail = (
      await response
        .clone()
        .text()
        .catch(() => "")
    ).slice(0, 200);
  }
  const tag = code ? ` (${code})` : "";

  if (status === 401 || status === 403) {
    return `Zenrows rejected the request for ${url} — check the API key.${tag}`;
  }
  if (status === 402) {
    return `Zenrows account is out of credits, or this feature is not on the plan.${tag} ${detail}`.trim();
  }
  if (status === 422) {
    return `Zenrows could not scrape ${url}${tag}. ${detail}`.trim();
  }
  if (status === 429) {
    return `Rate limited by Zenrows — the account concurrency cap or the target site. Wait and retry.${tag}`;
  }
  return `Zenrows returned HTTP ${status} for ${url}.${tag} ${detail}`.trim();
}

export function truncate(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}
