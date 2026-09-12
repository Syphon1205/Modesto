import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => undefined,
}));

vi.mock("@effect/atom-react", () => ({
  useAtomValue: () => null,
}));

vi.mock("../../state/query", () => ({
  useEnvironmentQuery: () => ({ data: null, isPending: false, refresh: () => undefined }),
}));

vi.mock("../../state/use-atom-command", () => ({
  useAtomCommand: () => async () => ({ _tag: "Failure" }),
}));

vi.mock("../../env", () => ({
  isElectron: false,
}));

describe("AppSignInChooser", () => {
  it("offers GitHub and a local user without T3 Connect", async () => {
    const { AppSignInChooser } = await import("./AppSignInChooser");
    const markup = renderToStaticMarkup(<AppSignInChooser />);
    expect(markup).toContain("Sign in with GitHub");
    expect(markup).not.toContain("T3 Connect");
    expect(markup).toContain("Use a local user");
    expect(markup).toContain("Welcome back");
  });
});
