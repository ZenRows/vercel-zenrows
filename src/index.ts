export { createZenrowsTools } from "./toolset.js";
export type { ZenrowsTools } from "./toolset.js";

export { scrapeUrl } from "./tools/scrape-url.js";
export { extractData } from "./tools/extract-data.js";
export { takeScreenshot } from "./tools/take-screenshot.js";

export type { ScrapeUrlInput, ScrapeUrlOutput } from "./tools/scrape-url.js";
export type { ExtractDataInput, ExtractDataOutput } from "./tools/extract-data.js";
export type { TakeScreenshotInput, ScreenshotResult } from "./tools/take-screenshot.js";

export type {
  ResponseType,
  ZenrowsToolsOptions,
  ZenrowsScrapeOptions,
  ZenrowsExtractOptions,
  ZenrowsScreenshotOptions,
} from "./types.js";
