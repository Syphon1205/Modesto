import { describe, expect, it } from "vitest";

import {
  decodeVercelProjects,
  decodeVercelUser,
  parseVercelCliAuthToken,
  preferVercelToken,
  vercelApiFailureDetail,
  vercelCliAuthFileCandidates,
} from "./vercelDecode.ts";

describe("preferVercelToken", () => {
  it("prefers a pasted token over env and CLI", () => {
    expect(
      preferVercelToken({
        token: "stored",
        env: "from-env",
        cli: "from-cli",
      }),
    ).toEqual({ token: "stored", source: "token" });
    expect(
      preferVercelToken({
        token: null,
        env: "from-env",
        cli: "from-cli",
      }),
    ).toEqual({ token: "from-env", source: "env" });
    expect(
      preferVercelToken({
        token: null,
        env: null,
        cli: "from-cli",
      }),
    ).toEqual({ token: "from-cli", source: "cli" });
    expect(preferVercelToken({ token: null, env: null, cli: null })).toBeNull();
  });
});

describe("parseVercelCliAuthToken", () => {
  it("reads the token field from Vercel CLI auth.json", () => {
    expect(parseVercelCliAuthToken('{"token":" abc "}')).toBe("abc");
    expect(parseVercelCliAuthToken("{")).toBeNull();
    expect(parseVercelCliAuthToken("{}")).toBeNull();
  });
});

describe("vercelCliAuthFileCandidates", () => {
  it("includes the macOS Application Support path and XDG fallback", () => {
    expect(vercelCliAuthFileCandidates("/Users/ada", "darwin", {})).toEqual([
      "/Users/ada/Library/Application Support/com.vercel.cli/auth.json",
      "/Users/ada/.config/com.vercel.cli/auth.json",
    ]);
  });

  it("honors APPDATA and XDG_CONFIG_HOME", () => {
    expect(
      vercelCliAuthFileCandidates("/home/ada", "win32", {
        APPDATA: "C:/Users/ada/AppData/Roaming",
        XDG_CONFIG_HOME: "/custom/config",
      }),
    ).toEqual([
      "C:/Users/ada/AppData/Roaming/com.vercel.cli/auth.json",
      "/custom/config/com.vercel.cli/auth.json",
    ]);
  });
});

describe("decodeVercelUser", () => {
  it("reads nested and flat user payloads", () => {
    expect(
      decodeVercelUser({
        user: { username: "ada", email: "ada@example.com" },
      }),
    ).toEqual({ username: "ada", email: "ada@example.com" });
    expect(decodeVercelUser({ name: "Ada", email: "ada@example.com" })).toEqual({
      username: "Ada",
      email: "ada@example.com",
    });
  });
});

describe("decodeVercelProjects", () => {
  it("keeps GitHub-linked projects and prefers a ready production deployment", () => {
    const projects = decodeVercelProjects({
      projects: [
        {
          id: "prj_1",
          name: "modesto",
          framework: "nextjs",
          link: { type: "github", org: "Syphon1205", repo: "modesto-source" },
          latestDeployments: [
            {
              id: "dpl_preview",
              url: "modesto-git-preview.vercel.app",
              readyState: "READY",
              target: "preview",
              createdAt: 2,
            },
            {
              id: "dpl_prod",
              url: "modesto.vercel.app",
              readyState: "READY",
              target: "production",
              createdAt: 1,
            },
          ],
        },
        { id: "skip" },
      ],
    });

    expect(projects).toEqual([
      {
        id: "prj_1",
        name: "modesto",
        framework: "nextjs",
        githubOwner: "Syphon1205",
        githubRepo: "modesto-source",
        latestDeployment: {
          id: "dpl_prod",
          url: "https://modesto.vercel.app",
          state: "READY",
          target: "production",
          createdAt: 1,
        },
      },
    ]);
  });
});

describe("vercelApiFailureDetail", () => {
  it("explains rejected tokens without echoing them", () => {
    expect(vercelApiFailureDetail(401)).toContain("rejected this token");
    expect(vercelApiFailureDetail(500)).toBe("Vercel API request failed (500).");
  });
});
