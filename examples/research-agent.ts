/**
 * Runnable end-to-end example.
 *
 *   ZENROWS_API_KEY=... OPENAI_API_KEY=... pnpm example
 *
 * Exercises all three tools against the live Zenrows API through a real model
 * tool-call loop, which is also how the package is verified before a release.
 */
import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs } from "ai";
import { createZenrowsTools } from "../src/index.js";

const apiKey = process.env.ZENROWS_API_KEY;
if (!apiKey) throw new Error("Set ZENROWS_API_KEY.");

const zenrows = createZenrowsTools({ apiKey });

async function run(label: string, prompt: string, model = "gpt-4o-mini") {
  console.log(`\n--- ${label} ---`);
  const { text, steps } = await generateText({
    model: openai(model),
    prompt,
    tools: zenrows,
    stopWhen: stepCountIs(4),
  });
  const calls = steps.flatMap((s) => s.toolCalls.map((c) => c.toolName));
  console.log(`tools called: ${calls.join(", ") || "none"}`);
  console.log(text.slice(0, 400));
}

await run("scrapeUrl", "Read https://www.scrapingcourse.com/ecommerce/ and name three products.");

await run(
  "extractData",
  'Extract the product titles and prices from https://www.scrapingcourse.com/ecommerce/ using the CSS selectors {"title":".product-name","price":".price"}. List the first three.',
);

await run(
  "takeScreenshot",
  "Take a screenshot of https://www.scrapingcourse.com/ecommerce/ and describe the layout in two sentences.",
  "gpt-4o",
);

console.log("\ndone");
