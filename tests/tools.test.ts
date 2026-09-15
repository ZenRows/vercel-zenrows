import { describe, expect, it } from "vitest";
import { createZenrowsTools } from "../src/index.js";

const tools = createZenrowsTools({ apiKey: "test-key" });

describe("createZenrowsTools", () => {
  it("returns the three tools", () => {
    expect(Object.keys(tools).sort()).toEqual(["extractData", "scrapeUrl", "takeScreenshot"]);
  });

  it("gives every tool a description and an input schema", () => {
    for (const t of Object.values(tools)) {
      expect(typeof t.description).toBe("string");
      expect(t.description?.length).toBeGreaterThan(40);
      expect(t.inputSchema).toBeDefined();
      expect(t.execute).toBeTypeOf("function");
    }
  });

  it("refuses to build without an API key", () => {
    // @ts-expect-error deliberately wrong at runtime
    expect(() => createZenrowsTools({})).toThrow(/API key/);
  });

  it("sends a screenshot to the model as an image, not a base64 string", () => {
    const out = tools.takeScreenshot.toModelOutput?.({
      toolCallId: "1",
      input: { url: "https://example.com" },
      output: { image: "AAAA", mediaType: "image/png", url: "https://example.com" },
    });
    expect(out).toMatchObject({
      type: "content",
      value: [{ type: "text" }, { type: "file", mediaType: "image/png" }],
    });
  });

  it("surfaces a screenshot failure as error text", () => {
    const out = tools.takeScreenshot.toModelOutput?.({
      toolCallId: "1",
      input: { url: "https://example.com" },
      output: { error: "nope" },
    });
    expect(out).toEqual({ type: "error-text", value: "nope" });
  });
});
