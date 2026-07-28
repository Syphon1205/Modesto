import { describe, expect, it, vi } from "vitest";

import {
  GITHUB_DEVICE_SIGN_IN_URL,
  githubDeviceSignInDescription,
  startGitHubSignIn,
} from "./gitReactQuery";

describe("startGitHubSignIn", () => {
  it("opens GitHub's device page after the CLI starts", async () => {
    const githubSignIn = vi.fn().mockResolvedValue({ started: true, userCode: null });
    const openExternal = vi.fn().mockResolvedValue(undefined);

    await expect(
      startGitHubSignIn({ git: { githubSignIn }, shell: { openExternal } }),
    ).resolves.toEqual({ started: true, userCode: null });

    expect(githubSignIn).toHaveBeenCalledWith({});
    expect(openExternal).toHaveBeenCalledWith(GITHUB_DEVICE_SIGN_IN_URL);
    expect(githubSignIn.mock.invocationCallOrder[0]).toBeLessThan(
      openExternal.mock.invocationCallOrder[0]!,
    );
  });

  it("includes the captured one-time code in sign-in instructions", () => {
    expect(githubDeviceSignInDescription("AB12-CD34")).toContain("AB12-CD34");
  });

  it("does not open a browser when the CLI could not start", async () => {
    const githubSignIn = vi.fn().mockRejectedValue(new Error("gh unavailable"));
    const openExternal = vi.fn().mockResolvedValue(undefined);

    await expect(
      startGitHubSignIn({ git: { githubSignIn }, shell: { openExternal } }),
    ).rejects.toThrow("gh unavailable");
    expect(openExternal).not.toHaveBeenCalled();
  });
});
