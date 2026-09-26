import { createFileRoute } from "@tanstack/react-router";

import { AutomationEditorPage } from "~/automations/AutomationEditorPage";
import { AUTOMATION_TEMPLATES } from "~/automations/automationTemplates";

export interface NewAutomationSearch {
  readonly template?: string;
  readonly skill?: string;
}

export const Route = createFileRoute("/_chat/automations/new")({
  validateSearch: (raw: Record<string, unknown>): NewAutomationSearch => {
    const template = typeof raw.template === "string" ? raw.template.trim() : "";
    const skill = typeof raw.skill === "string" ? raw.skill.trim().slice(0, 160) : "";
    const known = AUTOMATION_TEMPLATES.some((entry) => entry.id === template);
    return { ...(known ? { template } : {}), ...(skill ? { skill } : {}) };
  },
  component: NewAutomationRouteView,
});

function NewAutomationRouteView() {
  const { template, skill } = Route.useSearch();
  return (
    <AutomationEditorPage
      key={template ?? skill ?? "blank"}
      {...(template ? { templateId: template } : {})}
      {...(skill ? { skillName: skill } : {})}
    />
  );
}
