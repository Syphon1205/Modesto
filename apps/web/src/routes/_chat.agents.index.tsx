import { createFileRoute } from "@tanstack/react-router";

import { AgentsPage } from "~/agents/AgentsPage";

export const Route = createFileRoute("/_chat/agents/")({
  component: AgentsPage,
});
