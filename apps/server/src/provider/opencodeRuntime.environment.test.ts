import { describe, expect, it } from "vite-plus/test";

import {
  parseListenPortFromServerUrl,
  parseLsofPidList,
  resolveOpenCodeConfigContent,
  uniquePositivePids,
} from "./opencodeRuntime.ts";

describe("resolveOpenCodeConfigContent", () => {
  it("prefers the caller environment over the inherited environment", () => {
    expect(
      resolveOpenCodeConfigContent(
        { OPENCODE_CONFIG_CONTENT: '{"source":"caller"}' },
        { OPENCODE_CONFIG_CONTENT: '{"source":"process"}' },
      ),
    ).toBe('{"source":"caller"}');
  });

  it("falls back to the inherited environment and then an empty config", () => {
    expect(
      resolveOpenCodeConfigContent(undefined, {
        OPENCODE_CONFIG_CONTENT: '{"source":"process"}',
      }),
    ).toBe('{"source":"process"}');
    expect(resolveOpenCodeConfigContent(undefined, {})).toBe("{}");
  });
});

describe("OpenCode serve process tracking", () => {
  it("parses the listen port from an OpenCode or Kilo ready URL", () => {
    expect(parseListenPortFromServerUrl("http://127.0.0.1:4096")).toBe(4096);
    expect(parseListenPortFromServerUrl("http://[::1]:8080")).toBe(8080);
    expect(parseListenPortFromServerUrl("http://127.0.0.1")).toBe(80);
    expect(parseListenPortFromServerUrl("not a url")).toBeNull();
  });

  it("parses lsof -t pid lists", () => {
    expect(parseLsofPidList("73396\n73405\n")).toEqual([73396, 73405]);
    expect(parseLsofPidList("73396\n73396\n")).toEqual([73396]);
    expect(parseLsofPidList("")).toEqual([]);
  });

  it("deduplicates tracked pids and drops invalid values", () => {
    expect(uniquePositivePids([73406, 73406, 0, -1, Number.NaN, undefined, 73396])).toEqual([
      73406, 73396,
    ]);
  });
});
