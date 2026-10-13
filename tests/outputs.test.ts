import { describe, expect, it } from "vitest";
import { extractDataInput, OUTPUT_FILTERS } from "../src/tools/extract-data.js";

const url = "https://example.com";

describe("extractData outputs", () => {
  it("accepts every filter the API documents", () => {
    expect(OUTPUT_FILTERS).toHaveLength(12);
    expect(extractDataInput.safeParse({ url, outputs: [...OUTPUT_FILTERS] }).success).toBe(true);
  });

  it("accepts filters the tool used to reject", () => {
    for (const f of ["audios", "videos", "menus", "hashtags", "metadata", "favicon"]) {
      expect(extractDataInput.safeParse({ url, outputs: [f] }).success).toBe(true);
    }
  });

  it("rejects an unknown filter", () => {
    expect(extractDataInput.safeParse({ url, outputs: ["prices"] }).success).toBe(false);
  });
});
