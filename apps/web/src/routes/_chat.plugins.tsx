import { createFileRoute } from "@tanstack/react-router";

import { CopilotCustomizePage } from "~/components/CopilotCustomizePage";
import { useInterfaceStyle } from "~/hooks/useSettings";
import { PluginLibrary } from "~/components/PluginLibrary";

export const Route = createFileRoute("/_chat/plugins")({
  component: PluginsRoute,
});

function PluginsRoute() {
  return useInterfaceStyle() === "github" ? <CopilotCustomizePage /> : <PluginLibrary />;
}
