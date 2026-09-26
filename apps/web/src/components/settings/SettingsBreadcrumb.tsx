import {
  WorkspaceBreadcrumb,
  WorkspaceBreadcrumbItem,
  WorkspaceBreadcrumbSeparator,
} from "../WorkspaceBreadcrumb";
import { SETTINGS_SECTION_LABELS } from "./settingsSearch";
import { useInterfaceStyle } from "../../hooks/useSettings";

const SETTINGS_BREADCRUMB_LABELS: Readonly<Record<string, string>> = {
  ...SETTINGS_SECTION_LABELS,
  "/settings/diagnostics": "Diagnostics",
};

function settingsBreadcrumbLabel(pathname: string): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  return SETTINGS_BREADCRUMB_LABELS[normalizedPathname] ?? null;
}

export function settingsSectionLabel(pathname: string, interfaceStyle: string): string {
  const defaultSectionLabel = settingsBreadcrumbLabel(pathname);
  const githubSectionLabels: Readonly<Record<string, string>> = {
    "/settings/appearance": "Themes",
    "/settings/archived": "Experimental",
    "/settings/connections": "Accounts",
    "/settings/integrations": "Customize",
    "/settings/keybindings": "Accessibility",
    "/settings/providers": "Model providers",
    "/settings/source-control": "Sessions",
  };
  return (
    (interfaceStyle === "github"
      ? (githubSectionLabels[pathname] ?? defaultSectionLabel)
      : defaultSectionLabel) ?? "Settings"
  );
}

export function SettingsBreadcrumb({ pathname }: { pathname: string }) {
  const interfaceStyle = useInterfaceStyle();
  const sectionLabel = settingsSectionLabel(pathname, interfaceStyle);

  if (interfaceStyle === "opencode" || interfaceStyle === "github") {
    return (
      <WorkspaceBreadcrumb ariaLabel="Settings section">
        <WorkspaceBreadcrumbItem current className="truncate">
          {sectionLabel ?? "Settings"}
        </WorkspaceBreadcrumbItem>
      </WorkspaceBreadcrumb>
    );
  }

  return (
    <WorkspaceBreadcrumb ariaLabel="Settings breadcrumb">
      {sectionLabel ? (
        <>
          <WorkspaceBreadcrumbItem>Settings</WorkspaceBreadcrumbItem>
          <WorkspaceBreadcrumbSeparator />
        </>
      ) : null}
      <WorkspaceBreadcrumbItem current className="truncate">
        {sectionLabel ?? "Settings"}
      </WorkspaceBreadcrumbItem>
    </WorkspaceBreadcrumb>
  );
}
