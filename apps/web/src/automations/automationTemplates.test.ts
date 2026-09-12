import { describe, expect, it } from "vite-plus/test";

import {
  AUTOMATION_TEMPLATES,
  FEATURED_CAPABILITIES,
  templatesForCategory,
} from "./automationTemplates";

describe("automationTemplates", () => {
  it("keeps popular and category filters non-empty", () => {
    expect(templatesForCategory("popular").length).toBeGreaterThan(0);
    expect(templatesForCategory("review").every((template) => template.category === "review")).toBe(
      true,
    );
    expect(AUTOMATION_TEMPLATES.every((template) => template.instructions.trim().length > 40)).toBe(
      true,
    );
  });

  it("points featured capabilities at real templates", () => {
    const ids = new Set(AUTOMATION_TEMPLATES.map((template) => template.id));
    for (const capability of FEATURED_CAPABILITIES) {
      expect(ids.has(capability.templateId)).toBe(true);
    }
  });
});
