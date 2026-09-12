import { describe, expect, it } from "vite-plus/test";

import {
  GITHUB_DEVICE_LOGIN_URL,
  buildGitHubDeviceAuthUrl,
  parseGitHubDeviceCode,
  parseGitHubVerificationUri,
} from "./githubDeviceCode.ts";

describe("parseGitHubDeviceCode", () => {
  it("extracts the XXXX-XXXX code from gh auth login output", () => {
    expect(
      parseGitHubDeviceCode(
        "! First copy your one-time code: Ab12-Cd34\nOpen this URL to continue in your web browser: https://github.com/login/device\n",
      ),
    ).toBe("AB12-CD34");
  });
});

describe("parseGitHubVerificationUri", () => {
  it("extracts the device login URL printed by gh", () => {
    expect(
      parseGitHubVerificationUri(
        "Open this URL to continue in your web browser: https://github.com/login/device\n",
      ),
    ).toBe("https://github.com/login/device");
  });

  it("keeps a user_code already present on the printed URL", () => {
    expect(
      parseGitHubVerificationUri("https://github.com/login/device?user_code=ABCD-1234\n"),
    ).toBe("https://github.com/login/device?user_code=ABCD-1234");
  });

  it("rejects non-device github URLs", () => {
    expect(parseGitHubVerificationUri("https://github.com/login")).toBeNull();
  });
});

describe("buildGitHubDeviceAuthUrl", () => {
  it("falls back to the public device page", () => {
    expect(buildGitHubDeviceAuthUrl({ userCode: null })).toBe(GITHUB_DEVICE_LOGIN_URL);
  });

  it("attaches the user code when missing", () => {
    expect(
      buildGitHubDeviceAuthUrl({
        userCode: "ab12-cd34",
        verificationUri: "https://github.com/login/device",
      }),
    ).toBe("https://github.com/login/device?user_code=AB12-CD34");
  });

  it("does not duplicate an existing user_code", () => {
    expect(
      buildGitHubDeviceAuthUrl({
        userCode: "ZZZZ-ZZZZ",
        verificationUri: "https://github.com/login/device?user_code=ABCD-1234",
      }),
    ).toBe("https://github.com/login/device?user_code=ABCD-1234");
  });
});
