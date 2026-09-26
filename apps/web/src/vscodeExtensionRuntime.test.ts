import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  getInstalledVsCodeExtensions,
  installedVsCodeLanguageForPath,
  installVsCodeDeclarativeExtension,
} from "./vscodeExtensionRuntime";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("VS Code declarative extension runtime", () => {
  it("persists language and snippet contributions and resolves file extensions", () => {
    const localStorage = createStorage();
    vi.stubGlobal("window", {
      localStorage,
      dispatchEvent: vi.fn(),
    });

    installVsCodeDeclarativeExtension({
      id: "demo.language-pack",
      name: "Demo language pack",
      version: "1.0.0",
      languages: [{ id: "demo", aliases: ["Demo"], extensions: [".demo"] }],
      snippets: [
        {
          language: "demo",
          label: "Hello",
          prefix: "hello",
          body: "hello ${1:world}",
          description: "Greeting",
        },
      ],
    });

    expect(getInstalledVsCodeExtensions()).toEqual([
      expect.objectContaining({ id: "demo.language-pack", version: "1.0.0" }),
    ]);
    expect(installedVsCodeLanguageForPath("src/example.demo")).toBe("demo");
  });

  it("updates an installed extension without duplicating it", () => {
    const localStorage = createStorage();
    vi.stubGlobal("window", {
      localStorage,
      dispatchEvent: vi.fn(),
    });
    const base = {
      id: "demo.pack",
      name: "Demo pack",
      languages: [],
      snippets: [],
    };

    installVsCodeDeclarativeExtension({ ...base, version: "1.0.0" });
    installVsCodeDeclarativeExtension({ ...base, version: "2.0.0" });

    expect(getInstalledVsCodeExtensions()).toHaveLength(1);
    expect(getInstalledVsCodeExtensions()[0]?.version).toBe("2.0.0");
  });
});
