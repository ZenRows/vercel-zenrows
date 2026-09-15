/** Response formats Zenrows can return for a page fetch. */
export type ResponseType = "markdown" | "plaintext" | "html";

export interface ZenrowsToolsOptions {
  /** Zenrows API key. https://app.zenrows.com/account/settings */
  apiKey: string;
  /**
   * Let Zenrows pick the cheapest request configuration that works and escalate
   * to JavaScript rendering or premium proxies only when the target needs them.
   * On by default, matching the Zenrows SDK.
   *
   * Zenrows rejects adaptive stealth combined with an explicit tier flag, so a
   * call that needs a browser (a screenshot, a wait-for-selector) drops it for
   * that call rather than failing.
   */
  adaptiveStealth?: boolean;
  /** Format `scrapeUrl` returns when the model does not ask for one. Default: markdown. */
  defaultResponseType?: ResponseType;
  /**
   * Characters of page content passed back to the model before truncation.
   * Default 100_000 — roughly 25k tokens. Raise it deliberately: a raw HTML
   * page routinely exceeds this and the model pays for every character.
   */
  maxContentLength?: number;
  /** Concurrent in-flight requests to Zenrows. Default 5 (SDK default). */
  concurrency?: number;
  /** Retries on 422/503/504 and network errors. Default 0 (SDK default). */
  retries?: number;
}

export type ZenrowsScrapeOptions = ZenrowsToolsOptions;
export type ZenrowsExtractOptions = Omit<ZenrowsToolsOptions, "defaultResponseType">;
export type ZenrowsScreenshotOptions = Omit<
  ZenrowsToolsOptions,
  "defaultResponseType" | "maxContentLength"
>;
