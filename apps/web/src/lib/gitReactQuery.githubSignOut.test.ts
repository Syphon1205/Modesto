import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { gitGithubSignOutMutationOptions, gitQueryKeys } from "./gitReactQuery";

describe("gitGithubSignOutMutationOptions", () => {
  it("invalidates identity and profile commits before reporting success", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const options = gitGithubSignOutMutationOptions({ queryClient, onSuccess });

    await (options.onSuccess as () => Promise<void>)();

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: gitQueryKeys.githubAuth() });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["server", "profileCommitActivity"],
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
