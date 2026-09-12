import { describe, expect, it } from "vite-plus/test";
import { buildInlineVisualPrompt, stripInlineVisualInstructions } from "./inlineVisualPrompt";
import { deriveDisplayedUserMessageState } from "../lib/terminalContext";

describe("visual request presentation", () => {
  it("sends rendering guidance to the model but shows and copies the user's request", () => {
    const request = "Create an interactive graph of revenue";
    const prompt = buildInlineVisualPrompt(request);
    expect(prompt).toContain("complete html code fence");
    expect(deriveDisplayedUserMessageState(prompt)).toMatchObject({
      visibleText: request,
      copyText: request,
    });
  });
  it("leaves ordinary messages and partial matches intact", () => {
    const prompt = "Modesto can display diagrams. User request: hello";
    expect(stripInlineVisualInstructions(prompt)).toBe(prompt);
  });
});
