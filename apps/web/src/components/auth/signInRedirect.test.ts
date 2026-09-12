import { describe, expect, it } from "vite-plus/test";

import { resolveSafeSignInRedirect } from "./signInRedirect";

describe("resolveSafeSignInRedirect", () => {
  it("keeps a same-origin continue URL and drops a foreign one", () => {
    expect(
      resolveSafeSignInRedirect("https://app.t3.codes/connect?state=1", "https://app.t3.codes"),
    ).toBe("https://app.t3.codes/connect?state=1");
    expect(resolveSafeSignInRedirect("https://evil.test/phish", "https://app.t3.codes")).toBe(
      undefined,
    );
    expect(resolveSafeSignInRedirect("/connect", "https://app.t3.codes")).toBe(
      "https://app.t3.codes/connect",
    );
  });
});
