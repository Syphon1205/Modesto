import { createFileRoute } from "@tanstack/react-router";

import { AgentDetailPage } from "~/agents/AgentDetailPage";

export const Route = createFileRoute("/_chat/agents/$agentId")({
  component: function AgentDetailRoute() {
    const { agentId } = Route.useParams();
    return <AgentDetailPage agentId={agentId} />;
  },
});
