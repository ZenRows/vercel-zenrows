import { describe, expect, it } from "vitest";
import { resolveTier, truncate } from "../src/client.js";

describe("resolveTier", () => {
  it("uses adaptive stealth when nothing forces a tier", () => {
    expect(resolveTier({ adaptiveStealth: true })).toEqual({ mode: "auto" });
  });

  it("sends nothing when stealth is off and nothing is forced", () => {
    expect(resolveTier({ adaptiveStealth: false })).toEqual({});
  });

  it("never sends adaptive stealth together with an explicit tier flag", () => {
    for (const forced of [
      { jsRender: true },
      { premiumProxy: true },
      { needsBrowser: true },
      { jsRender: true, premiumProxy: true },
    ]) {
      const out = resolveTier({ adaptiveStealth: true, ...forced });
      expect(out.mode).toBeUndefined();
      expect(out.js_render || out.premium_proxy).toBe(true);
    }
  });

  it("turns on js_render for an option that needs a browser", () => {
    expect(resolveTier({ adaptiveStealth: true, needsBrowser: true })).toEqual({
      js_render: true,
    });
  });

  it("keeps premium_proxy and js_render together when both are asked for", () => {
    expect(resolveTier({ adaptiveStealth: false, jsRender: true, premiumProxy: true })).toEqual({
      js_render: true,
      premium_proxy: true,
    });
  });
});

describe("truncate", () => {
  it("leaves short content alone", () => {
    expect(truncate("abc", 10)).toEqual({ text: "abc", truncated: false });
  });

  it("cuts and flags long content", () => {
    expect(truncate("abcdef", 3)).toEqual({ text: "abc", truncated: true });
  });
});
