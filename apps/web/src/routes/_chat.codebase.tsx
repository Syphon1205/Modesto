import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_chat/codebase")({
  beforeLoad: () => {
    throw redirect({
      to: "/pull-requests",
      search: { involvement: "all", state: "open" },
      replace: true,
    });
  },
});
