import { createFileRoute } from "@tanstack/react-router";

import { AutomationsPage } from "~/automations/AutomationsPage";

export const Route = createFileRoute("/_chat/automations")({
  component: AutomationsPage,
});
