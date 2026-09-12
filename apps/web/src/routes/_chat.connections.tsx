import { createFileRoute } from "@tanstack/react-router";

import { ConnectionsPage } from "~/connections/ConnectionsPage";

export const Route = createFileRoute("/_chat/connections")({
  component: ConnectionsPage,
});
