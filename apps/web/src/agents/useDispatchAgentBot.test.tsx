import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createAgentBot } from "./agentRoster";
import { avatarSpecForName } from "./avatar/agentAvatarRandom";
import { useDispatchAgentBot } from "./useDispatchAgentBot";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  toast: vi.fn(),
  prompt: vi.fn(),
  model: vi.fn(),
  link: vi.fn(),
}));
vi.mock("@effect/atom-react", () => ({ useAtomValue: () => [] }));
vi.mock("~/state/server", () => ({ primaryServerProvidersAtom: {} }));
vi.mock("~/state/entities", () => ({ useProjects: () => [] }));
vi.mock("~/providerInstances", () => ({ deriveProviderInstanceEntries: () => [] }));
vi.mock("~/components/ui/toast", () => ({ toastManager: { add: mocks.toast } }));
vi.mock("../hooks/useHandleNewThread", () => ({
  useHandleNewThread: () => ({
    handleNewThread: mocks.open,
    defaultProjectRef: { environmentId: "env", projectId: "project" },
  }),
}));
vi.mock("./agentThreadLinks", () => ({ linkThreadToBot: mocks.link }));
vi.mock("../composerDraftStore", () => ({
  useComposerDraftStore: {
    getState: () => ({ setPrompt: mocks.prompt, setModelSelection: mocks.model }),
  },
}));

const bot = createAgentBot({
  draft: {
    name: "Scout",
    tagline: "",
    persona: "Check the evidence.",
    avatar: avatarSpecForName("Scout"),
    homeProjectKey: null,
    model: null,
  },
  existing: [],
  now: 0,
});

function dispatch() {
  let result!: ReturnType<typeof useDispatchAgentBot>;
  function Probe() {
    result = useDispatchAgentBot();
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return result;
}

beforeEach(() => vi.resetAllMocks());

describe("agent task preparation", () => {
  it("does not silently move a task out of a missing home project", async () => {
    expect(await dispatch()({ ...bot, homeProjectKey: "missing:project" }, "Investigate")).toBe(
      false,
    );
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalled();
  });

  it("does not silently replace an unavailable model", async () => {
    expect(
      await dispatch()(
        { ...bot, model: { providerId: "missing", modelId: "model", variant: null } },
        "Investigate",
      ),
    ).toBe(false);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("reports an unsuccessful handoff so the caller can retain its draft", async () => {
    mocks.open.mockResolvedValue(undefined);
    expect(await dispatch()(bot, "Investigate")).toBe(false);
    expect(mocks.prompt).not.toHaveBeenCalled();
  });

  it("links and prepares the task only after a thread opens", async () => {
    mocks.open.mockResolvedValue({ threadId: "thread", draftId: "draft" });
    expect(await dispatch()(bot, "Investigate")).toBe(true);
    expect(mocks.link).toHaveBeenCalledWith("env", "thread", bot.id);
    expect(mocks.prompt).toHaveBeenCalledWith(
      "draft",
      expect.stringContaining("Check the evidence."),
    );
  });
});
