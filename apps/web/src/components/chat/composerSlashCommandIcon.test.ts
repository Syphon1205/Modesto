import {
  BugIcon,
  FileTextIcon,
  LayoutTemplateIcon,
  PresentationIcon,
  SparklesIcon,
} from "lucide-react";
import { describe, expect, it } from "vite-plus/test";

import {
  normalizeSlashCommandName,
  slashCommandHasBrandMark,
  slashCommandLucideIcon,
} from "./composerSlashCommandIcon";

describe("slash command icons", () => {
  it("normalizes leading slashes and case", () => {
    expect(normalizeSlashCommandName("/Figma")).toBe("figma");
    expect(normalizeSlashCommandName("  /SLIDES ")).toBe("slides");
    expect(normalizeSlashCommandName("docs")).toBe("docs");
  });

  it("maps built-in and common provider commands to distinct Lucide icons", () => {
    expect(slashCommandLucideIcon("/slides")).toBe(PresentationIcon);
    expect(slashCommandLucideIcon("slides")).toBe(PresentationIcon);
    expect(slashCommandLucideIcon("figma")).toBe(LayoutTemplateIcon);
    expect(slashCommandLucideIcon("docs")).toBe(FileTextIcon);
    expect(slashCommandLucideIcon("/debug")).toBe(BugIcon);
    expect(slashCommandLucideIcon("figma")).not.toBe(slashCommandLucideIcon("debug"));
    expect(slashCommandLucideIcon("docs")).not.toBe(slashCommandLucideIcon("slides"));
    expect(slashCommandLucideIcon("spreadsheets")).not.toBe(slashCommandLucideIcon("docs"));
  });

  it("falls unknown commands back to the same sparkles mark", () => {
    expect(slashCommandLucideIcon("unknown-command")).toBe(SparklesIcon);
    expect(slashCommandLucideIcon("totally-new")).toBe(SparklesIcon);
  });

  it("reserves brand marks for /figma and /framer", () => {
    expect(slashCommandHasBrandMark("/figma")).toBe(true);
    expect(slashCommandHasBrandMark("/framer")).toBe(true);
    expect(slashCommandHasBrandMark("slides")).toBe(false);
    expect(slashCommandHasBrandMark("docs")).toBe(false);
  });
});
