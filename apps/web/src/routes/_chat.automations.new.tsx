import { createFileRoute } from "@tanstack/react-router";

import { AutomationEditorPage } from "~/automations/AutomationEditorPage";
import { AUTOMATION_TEMPLATES } from "~/automations/automationTemplates";

export interface NewAutomationSearch {
  readonly template?: string;
}

export const Route = createFileRoute("/_chat/automations/new")({
  validateSearch: (raw: Record<string, unknown>): NewAutomationSearch => {
    const template = typeof raw.template === "string" ? raw.template.trim() : "";
    if (!template) return {};
    const known = AUTOMATION_TEMPLATES.some((entry) => entry.id === template);
    return known ? { template } : {};
  },
  component: NewAutomationRouteView,
});

function NewAutomationRouteView() {
  const { template } = Route.useSearch();
  return (
    <AutomationEditorPage
      key={template ?? "blank"}
      {...(template ? { templateId: template } : {})}
    />
  );
}
