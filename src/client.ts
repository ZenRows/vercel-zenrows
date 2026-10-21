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

/** Extract's answer when it knows the page but none of the fields came back filled. */
export const NO_DATA_EXTRACTED = "no_data_extracted";

/**
 * The three situations a 403 REQS007 covers. They need different things from the
 * caller, and preparing the domain only resolves the first, so the message must not
 * name one of them for all three: https://docs.zenrows.com/api-error-codes#REQS007
 *
 * `reason` names the case directly but arrives with a later API release. Until then
 * the case is readable from `title`, which the API already sends.
 */
const REQS007_CASES: ReadonlyArray<{
  reason: string;
  titlePrefix: string;
  explain: string;
}> = [
  {
    reason: "domain_not_prepared",
    titlePrefix: "Extract is not prepared for the requested domain",
    explain:
      "Nothing is prepared for this domain yet. Preparing it and retrying will work, " +
      "or get the data now with cssSelectors, or read the page with scrapeUrl.",
  },
  {
    reason: "page_not_recognised",
    titlePrefix: "Extract did not recognise this page on",
    explain:
      "The domain is prepared, but Extract does not recognise this page, which is usual " +
      "for a home or index page. Preparing the domain again returns the same answer, so " +
      "try a product, article or listing page on this site, pass cssSelectors for this " +
      "page, or read it with scrapeUrl.",
  },
  {
    reason: "domain_not_enabled",
    titlePrefix: "Extract is not enabled for the requested domain",
    explain:
      "Extract is not enabled for this site, and preparing the domain does not change " +
      "that. Pass cssSelectors, read the page with scrapeUrl, or ask Zenrows support to " +
      "enable the site.",
  },
];

/** What to say when neither `reason` nor `title` identifies the case. */
const REQS007_UNKNOWN =
  "It can mean the domain is not prepared, that Extract did not recognise this page, or " +
  "that Extract is not enabled for the site. Call extractData again with cssSelectors or " +
  "outputs, or read the page with scrapeUrl.";

function numericHeader(response: Response, name: string): number | undefined {
  const raw = response.headers.get(name);
  if (raw == null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Credits the request spent, from `X-Request-Credits`. */
export function readCredits(response: Response): number | undefined {
  return numericHeader(response, "x-request-credits");
}

/** What the request cost in US dollars, from `X-Request-Cost`. */
export function readCostUsd(response: Response): number | undefined {
  return numericHeader(response, "x-request-cost");
}

/** Everything a failed Zenrows call should tell the model, and nothing more. */
export async function describeFailure(response: Response, url: string): Promise<string> {
  const status = response.status;
  let code = "";
  let detail = "";
  let title = "";
  let reason = "";
  try {
    const body = (await response.clone().json()) as {
      code?: unknown;
      detail?: unknown;
      title?: unknown;
      reason?: unknown;
    };
    if (typeof body.code === "string") code = body.code;
    if (typeof body.detail === "string") detail = body.detail;
    if (typeof body.title === "string") title = body.title;
    if (typeof body.reason === "string") reason = body.reason;
  } catch {
    detail = (
      await response
        .clone()
        .text()
        .catch(() => "")
    ).slice(0, 200);
  }
  const tag = code ? ` (${code})` : "";

  // Extract refused the page. Not an auth problem, so it must not read as "check the
  // API key", and not necessarily an unprepared domain either: say which of the three
  // it is, because preparing the domain fixes only one of them.
  if (status === 403 && code.toUpperCase() === "REQS007") {
    const matched =
      REQS007_CASES.find((c) => c.reason === reason) ??
      REQS007_CASES.find((c) => title.startsWith(c.titlePrefix));
    return [
      `Extract refused ${url}${tag}, and the request was not charged.`,
      matched?.explain ?? REQS007_UNKNOWN,
    ].join(" ");
  }
  if (status === 401 || status === 403) {
    return `Zenrows rejected the request for ${url} — check the API key.${tag}`;
  }
  if (status === 402) {
    return `Zenrows account is out of credits, or this feature is not on the plan.${tag} ${detail}`.trim();
  }
  // Extract applied its extraction but no field came back filled. The answer is
  // deterministic and not charged, so repeating the same request returns it again.
  if (status === 422 && code.toLowerCase() === NO_DATA_EXTRACTED) {
    return [
      `Extract found no data on ${url}${tag}, and the request was not charged.`,
      "The page may not have rendered or may be a block page: read it with scrapeUrl",
      "(pass waitForSelector for content that loads late) to see what came back.",
      "Do not repeat the same extractData call.",
    ].join(" ");
  }
  if (status === 422) {
    return `Zenrows could not scrape ${url}${tag}. ${detail}`.trim();
  }
  if (status === 429) {
    return `Rate limited by Zenrows — the account concurrency cap or the target site. Wait and retry.${tag}`;
  }
  return `Zenrows returned HTTP ${status} for ${url}.${tag} ${detail}`.trim();
}

/**
 * Did Extract actually find anything?
 *
 * A selector that matches nothing does not come back as `{}` — Zenrows returns
 * the key with an empty value, e.g. `{"price": ""}`. Counting keys therefore
 * reports a match that is not there, and the model goes on to reason about a
 * field it never got. Empty strings, empty arrays and empty nested objects all
 * count as nothing found; numbers, booleans and `false` are real values.
 */
export function isEmptyResult(data: unknown): boolean {
  if (data == null) return true;
  if (typeof data === "string") return data.trim() === "";
  if (Array.isArray(data)) return data.length === 0 || data.every(isEmptyResult);
  if (typeof data === "object") {
    const values = Object.values(data as Record<string, unknown>);
    return values.length === 0 || values.every(isEmptyResult);
  }
  return false;
}

export function truncate(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}
