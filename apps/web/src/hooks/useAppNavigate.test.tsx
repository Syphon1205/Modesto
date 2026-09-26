import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useAppNavigate } from "./useAppNavigate";
import { useSettingsDialogStore } from "../settings/settingsDialogStore";

const state = vi.hoisted(() => ({ style: "github", navigate: vi.fn(() => Promise.resolve()) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => state.navigate }));
vi.mock("./useSettings", () => ({
  getClientSettings: () => ({ interfaceStyle: state.style }),
  resolveInterfaceStyle: (value: { interfaceStyle: string }) => value.interfaceStyle,
}));
function captureNavigate() {
  let navigate: ReturnType<typeof useAppNavigate>;
  function Capture() {
    navigate = useAppNavigate();
    return null;
  }
  renderToStaticMarkup(<Capture />);
  return navigate!;
}
beforeEach(() => {
  state.style = "github";
  state.navigate.mockClear();
  useSettingsDialogStore.getState().close();
});
describe("Copilot settings navigation", () => {
  it("opens settings without navigating or replacing the conversation", async () => {
    await captureNavigate()({ to: "/settings/appearance", hash: "theme" });
    expect(state.navigate).not.toHaveBeenCalled();
    expect(useSettingsDialogStore.getState()).toMatchObject({
      open: true,
      pathname: "/settings/appearance",
      hash: "theme",
    });
  });
  it("keeps page navigation for other interfaces", async () => {
    state.style = "opencode";
    await captureNavigate()({ to: "/settings/providers" });
    expect(state.navigate).toHaveBeenCalledWith({ to: "/settings/providers" });
    expect(useSettingsDialogStore.getState().open).toBe(false);
  });
  it("dismisses settings when leaving for Customize", async () => {
    useSettingsDialogStore.getState().show();
    await captureNavigate()({ to: "/plugins" });
    expect(state.navigate).toHaveBeenCalledWith({ to: "/plugins" });
    expect(useSettingsDialogStore.getState().open).toBe(false);
  });
});
