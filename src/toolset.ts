import { extractData } from "./tools/extract-data.js";
import { scrapeUrl } from "./tools/scrape-url.js";
import { takeScreenshot } from "./tools/take-screenshot.js";
import type { ZenrowsToolsOptions } from "./types.js";

/**
 * All three Zenrows tools, configured with one API key.
 *
 * @example
 * const zenrows = createZenrowsTools({ apiKey: process.env.ZENROWS_API_KEY! });
 *
 * const { text } = await generateText({
 *   model: openai('gpt-4o'),
 *   prompt: 'Read https://example.com and summarise it.',
 *   tools: zenrows,
 *   stopWhen: isStepCount(5),
 * });
 */
export function createZenrowsTools(options: ZenrowsToolsOptions) {
  return {
    scrapeUrl: scrapeUrl(options),
    extractData: extractData(options),
    takeScreenshot: takeScreenshot(options),
  } as const;
}

export type ZenrowsTools = ReturnType<typeof createZenrowsTools>;
