import { describe, expect, it } from "vite-plus/test";

import {
  describeConnectionStatus,
  isExpiringSoon,
  statusFromProbe,
  type WebAppConnectionStatus,
} from "./webAppConnections";

const NOW = 1_780_000_000;

describe("statusFromProbe", () => {
  it("treats any matched session cookie as connected", () => {
    expect(
      statusFromProbe({
        signedIn: true,
        matchedCookieNames: ["__Secure-1PSID"],
        expiresAt: NOW + 86_400 * 30,
      }),
    ).toEqual({ kind: "connected", expiresAt: NOW + 86_400 * 30 });
  });

  it("carries a null expiry through for session cookies", () => {
    expect(statusFromProbe({ signedIn: true, matchedCookieNames: ["d"], expiresAt: null })).toEqual(
      { kind: "connected", expiresAt: null },
    );
  });

  it("reports signed out when nothing matched", () => {
    expect(statusFromProbe({ signedIn: false, matchedCookieNames: [], expiresAt: null })).toEqual({
      kind: "signed-out",
    });
  });
});

describe("describeConnectionStatus", () => {
  it("distinguishes 'not signed in' from 'cannot tell'", () => {
    // The web build has no browser to ask. Reporting that as signed out would
    // be a claim about the user's account that Modesto cannot make.
    expect(describeConnectionStatus({ kind: "signed-out" })).toBe("Not signed in");
    expect(describeConnectionStatus({ kind: "unavailable" })).toBe("Desktop app only");
    expect(describeConnectionStatus({ kind: "checking" })).toBe("Checking…");
    expect(describeConnectionStatus({ kind: "connected", expiresAt: null })).toBe("Connected");
  });
});

const connected = (expiresAt: number | null): WebAppConnectionStatus => ({
  kind: "connected",
  expiresAt,
});

describe("isExpiringSoon", () => {
  it("warns only inside the last day of a session", () => {
    expect(isExpiringSoon(connected(NOW + 60 * 60), NOW)).toBe(true);
    expect(isExpiringSoon(connected(NOW + 86_400 * 2), NOW)).toBe(false);
  });

  it("never warns for a session cookie with no expiry", () => {
    expect(isExpiringSoon(connected(null), NOW)).toBe(false);
  });

  it("never warns for a state that is not connected", () => {
    expect(isExpiringSoon({ kind: "signed-out" }, NOW)).toBe(false);
    expect(isExpiringSoon({ kind: "unavailable" }, NOW)).toBe(false);
  });
});
