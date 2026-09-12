import { describe, expect, it } from "vite-plus/test";

import {
  deriveAuthClientMetadata,
  isLoopbackAddress,
  isRemoteReachableHost,
  isSameOriginBrowserRequest,
  readRequestRemoteAddress,
  resolveSessionCookieName,
} from "./utils.ts";

describe("deriveAuthClientMetadata", () => {
  it("labels Electron user agents as Electron instead of Chrome", () => {
    const metadata = deriveAuthClientMetadata({
      request: {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) modesto/0.0.15 Chrome/136.0.7103.93 Electron/36.3.2 Safari/537.36",
        },
        source: {
          remoteAddress: "::ffff:127.0.0.1",
        },
      } as never,
    });

    expect(metadata).toMatchObject({
      browser: "Electron",
      deviceType: "desktop",
      ipAddress: "127.0.0.1",
      os: "macOS",
    });
  });

  it("applies client-presented display identity without replacing transport metadata", () => {
    const metadata = deriveAuthClientMetadata({
      request: {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136.0.7103.93 Electron/36.3.2 Safari/537.36",
        },
        source: {
          remoteAddress: "::ffff:192.168.213.72",
        },
      } as never,
      presented: {
        label: "Modesto Mobile",
        deviceType: "mobile",
        os: "iOS",
      },
    });

    expect(metadata).toMatchObject({
      label: "Modesto Mobile",
      browser: "Electron",
      deviceType: "mobile",
      ipAddress: "192.168.213.72",
      os: "iOS",
    });
    expect(metadata.userAgent).toContain("Electron/36.3.2");
  });
});

describe("session cookie isolation", () => {
  it("isolates loopback web servers by port and server state", () => {
    const first = resolveSessionCookieName({
      mode: "web",
      port: 5775,
      host: "127.0.0.1",
      instanceKey: "/tmp/t3-agent-one",
      development: true,
    });
    const second = resolveSessionCookieName({
      mode: "web",
      port: 5775,
      host: "127.0.0.1",
      instanceKey: "/tmp/t3-agent-two",
      development: true,
    });

    expect(first).toMatch(/^t3_session_5775_[a-f0-9]{12}$/);
    expect(second).toMatch(/^t3_session_5775_[a-f0-9]{12}$/);
    expect(first).not.toBe(second);
  });

  it("keeps the hosted web cookie stable across server instances", () => {
    expect(
      resolveSessionCookieName({
        mode: "web",
        port: 8080,
        host: "0.0.0.0",
        instanceKey: "/srv/release-a",
        development: false,
      }),
    ).toBe("t3_session");
    expect(
      resolveSessionCookieName({
        mode: "web",
        port: 9090,
        host: "app.example.com",
        instanceKey: "/srv/release-b",
        development: false,
      }),
    ).toBe("t3_session");
  });

  it("retains desktop port scoping", () => {
    expect(
      resolveSessionCookieName({
        mode: "desktop",
        port: 3773,
        host: "127.0.0.1",
        instanceKey: "/tmp/desktop",
        development: true,
      }),
    ).toBe("t3_session_3773");
  });

  it("isolates development servers even when they bind a wildcard host", () => {
    expect(
      resolveSessionCookieName({
        mode: "web",
        port: 5775,
        host: "0.0.0.0",
        instanceKey: "/tmp/t3-wildcard-dev",
        development: true,
      }),
    ).toMatch(/^t3_session_5775_[a-f0-9]{12}$/);
  });

  it("classifies loopback aliases separately from remotely reachable hosts", () => {
    expect(isRemoteReachableHost(undefined)).toBe(false);
    expect(isRemoteReachableHost("localhost")).toBe(false);
    expect(isRemoteReachableHost("127.12.0.1")).toBe(false);
    expect(isRemoteReachableHost("[::1]")).toBe(false);
    expect(isRemoteReachableHost("0.0.0.0")).toBe(true);
    expect(isRemoteReachableHost("192.168.1.50")).toBe(true);
  });
});

describe("loopback bootstrap guards", () => {
  const request = (headers: Record<string, string>, remoteAddress?: string) =>
    ({ headers, source: remoteAddress ? { remoteAddress } : {} }) as never;

  it("treats only same-machine peers as loopback", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("[::1]")).toBe(true);
    expect(isLoopbackAddress("192.168.1.50")).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
  });

  it("reads the peer address a dual-stack listener reports", () => {
    expect(readRequestRemoteAddress(request({}, "::ffff:127.0.0.1"))).toBe("127.0.0.1");
    expect(readRequestRemoteAddress(request({}))).toBeUndefined();
  });

  it("accepts the app's own page and refuses every other site", () => {
    expect(isSameOriginBrowserRequest(request({ "sec-fetch-site": "same-origin" }))).toBe(true);
    // A user-typed URL or bookmark: no initiating site at all.
    expect(isSameOriginBrowserRequest(request({ "sec-fetch-site": "none" }))).toBe(true);
    expect(isSameOriginBrowserRequest(request({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginBrowserRequest(request({ "sec-fetch-site": "same-site" }))).toBe(false);
  });

  it("falls back to Origin when a browser omits Sec-Fetch-Site", () => {
    expect(
      isSameOriginBrowserRequest(
        request({ origin: "http://localhost:5733", host: "localhost:5733" }),
      ),
    ).toBe(true);
    // DNS rebinding does not change the page's own origin, so this still fails.
    expect(
      isSameOriginBrowserRequest(
        request({ origin: "http://evil.example", host: "localhost:5733" }),
      ),
    ).toBe(false);
  });

  it("refuses a request that carries no browser provenance at all", () => {
    expect(isSameOriginBrowserRequest(request({ host: "localhost:5733" }))).toBe(false);
    expect(isSameOriginBrowserRequest(request({}))).toBe(false);
  });
});
