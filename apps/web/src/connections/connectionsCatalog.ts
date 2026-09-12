// FILE: connectionsCatalog.ts
// Purpose: The connectable services - Gmail, Slack, Notion and the rest - and
//          how each one is installed as an MCP server.
// Layer: Connections model (pure data, no React)
//
// Adapted from OpenWork's MCP quick-connect catalog (MIT) by way of Modesto's
// own Work marketplace, so the entries stay in one vocabulary rather than
// being retyped per surface. See THIRD_PARTY_NOTICES.md.
//
// Data only. Nothing here performs an install: an entry describes what to
// write, and the caller decides where it goes (Codex config.toml today).

/**
 * Work Marketplace catalog — OpenWork MCP quick-connect (MIT) + Anthropic skills
 * marketplace shelf + extra local MCP entries.
 *
 * Sources:
 * - https://github.com/different-ai/openwork (MIT, outside /ee)
 * - https://github.com/anthropics/skills marketplace.json (Apache-2.0 examples)
 */

export type MarketplaceItemKind = "mcp" | "skill-pack" | "guide";

export type MarketplaceItem = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: MarketplaceItemKind;
  readonly filter: "mcp" | "email" | "docs" | "dev" | "skills";
  readonly iconLabel: string;
  readonly iconSrc?: string;
  readonly badge?: string;
} & (
  | {
      readonly install: "mcp-http";
      readonly serverName: string;
      readonly url: string;
      readonly oauth: boolean;
      readonly oauthClientIdRequired?: boolean;
    }
  | {
      readonly install: "mcp-stdio";
      readonly serverName: string;
      readonly command: string;
      readonly args: readonly string[];
      readonly oauth: boolean;
    }
  /**
   * A remote MCP server whose URL is minted per user and cannot be published
   * here.
   *
   * `mcp-http` covers a service with one well-known endpoint that every user
   * connects to and authorizes with OAuth. Some servers work the other way
   * round: the endpoint itself is the credential, issued to one account and
   * often carrying a session secret in the URL. There is nothing to hardcode
   * and no OAuth dance to run - the user pastes the URL their own tool gave
   * them, and it must be handled as a secret from that point on.
   */
  | {
      readonly install: "mcp-http-user-url";
      readonly serverName: string;
      /** Where the user obtains their URL, shown next to the field. */
      readonly urlSource: string;
      /** What the URL looks like, so a wrong paste is obvious before it is saved. */
      readonly urlPlaceholder: string;
      /**
       * Stated on the form. These servers commonly depend on something staying
       * open or running on the user's side, and a connection that silently
       * stops working is worse than one that says when it will.
       */
      readonly requirement?: string;
    }
  | {
      readonly install: "settings";
      readonly settingsSection: "providers" | "toolsMcps" | "skills" | "plugins" | "browserNetwork";
    }
  | {
      readonly install: "external";
      readonly href: string;
      readonly cta: string;
    }
);

export type MarketplaceServerDisplay = {
  readonly title: string;
  readonly iconLabel: string;
  readonly iconSrc?: string;
  readonly badge?: string;
};

export const WORK_MARKETPLACE_ITEMS: readonly MarketplaceItem[] = [
  // OpenWork MCP_QUICK_CONNECT (MIT)
  {
    id: "notion",
    name: "Notion",
    description: "Search and update Notion pages and databases.",
    kind: "mcp",
    filter: "docs",
    install: "mcp-http",
    serverName: "notion",
    url: "https://mcp.notion.com/mcp",
    oauth: true,
    iconLabel: "No",
    iconSrc: "/work/ext-notion.svg",
    badge: "MCP",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Read and update Linear issues from Work tasks.",
    kind: "mcp",
    filter: "mcp",
    install: "mcp-http",
    serverName: "linear",
    url: "https://mcp.linear.app/mcp",
    oauth: true,
    iconLabel: "Li",
    iconSrc: "/work/ext-linear.svg",
    badge: "MCP",
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Pull error context and issue details from Sentry.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-http",
    serverName: "sentry",
    url: "https://mcp.sentry.dev/mcp",
    oauth: true,
    iconLabel: "Se",
    iconSrc: "/work/ext-sentry.svg",
    badge: "MCP",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Query Stripe customers, invoices, and payment state.",
    kind: "mcp",
    filter: "mcp",
    install: "mcp-http",
    serverName: "stripe",
    url: "https://mcp.stripe.com",
    oauth: true,
    iconLabel: "St",
    iconSrc: "/work/ext-stripe.svg",
    badge: "MCP",
  },
  {
    id: "context7",
    name: "Context7",
    description: "Up-to-date library docs for research and implementation.",
    kind: "mcp",
    filter: "docs",
    install: "mcp-http",
    serverName: "context7",
    url: "https://mcp.context7.com/mcp",
    oauth: false,
    iconLabel: "C7",
    iconSrc: "/work/ext-context7.svg",
    badge: "MCP",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM contacts, deals, and marketing data via HubSpot’s remote MCP.",
    kind: "mcp",
    filter: "mcp",
    install: "mcp-http",
    serverName: "hubspot",
    url: "https://mcp.hubspot.com",
    oauth: true,
    iconLabel: "Hs",
    badge: "MCP",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Accounts, opportunities, and reports via Salesforce’s remote MCP.",
    kind: "mcp",
    filter: "mcp",
    install: "mcp-http",
    serverName: "salesforce",
    url: "https://api.salesforce.com/platform/mcp/v1/",
    oauth: true,
    iconLabel: "Sf",
    badge: "MCP",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Files and folders through Google’s remote OAuth MCP.",
    kind: "mcp",
    filter: "docs",
    install: "mcp-http",
    serverName: "google-drive",
    url: "https://drivemcp.googleapis.com/mcp/v1",
    oauth: true,
    oauthClientIdRequired: true,
    iconLabel: "Dr",
    badge: "OAuth",
  },
  {
    id: "figma",
    name: "Figma",
    description: "Read design files, components, and tokens via Figma’s remote MCP.",
    kind: "mcp",
    filter: "docs",
    install: "mcp-http",
    serverName: "figma",
    url: "https://mcp.figma.com/mcp",
    oauth: true,
    iconLabel: "Fi",
    badge: "MCP",
  },
  {
    id: "higgsfield",
    name: "Higgsfield",
    description: "Generate images, video, characters, and audio via Higgsfield’s remote MCP.",
    kind: "mcp",
    filter: "docs",
    install: "mcp-http",
    serverName: "higgsfield",
    url: "https://mcp.higgsfield.ai/mcp",
    oauth: true,
    iconLabel: "Hf",
    badge: "MCP",
  },
  {
    id: "canva",
    name: "Canva",
    description: "Create and edit designs via Canva’s remote MCP.",
    kind: "mcp",
    filter: "docs",
    install: "mcp-http",
    serverName: "canva",
    url: "https://mcp.canva.com/mcp",
    oauth: true,
    iconLabel: "Cv",
    badge: "MCP",
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Projects, SQL, and auth through Supabase’s remote MCP.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-http",
    serverName: "supabase",
    url: "https://mcp.supabase.com/mcp",
    oauth: true,
    iconLabel: "Sb",
    badge: "MCP",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "Workers, DNS, and account APIs through Cloudflare’s remote MCP.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-http",
    serverName: "cloudflare",
    url: "https://mcp.cloudflare.com/mcp",
    oauth: true,
    iconLabel: "Cf",
    badge: "MCP",
  },
  {
    id: "neon",
    name: "Neon",
    description: "Postgres projects, branches, and SQL via Neon’s remote MCP.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-http",
    serverName: "neon",
    url: "https://mcp.neon.tech/mcp",
    oauth: true,
    iconLabel: "Ne",
    badge: "MCP",
  },
  {
    id: "clickup",
    name: "ClickUp",
    description: "Tasks, docs, and sprints through ClickUp’s remote MCP.",
    kind: "mcp",
    filter: "mcp",
    install: "mcp-http",
    serverName: "clickup",
    url: "https://mcp.clickup.com/mcp",
    oauth: true,
    iconLabel: "Cu",
    badge: "MCP",
  },
  {
    id: "posthog",
    name: "PostHog",
    description: "Analytics, flags, and error tracking via PostHog’s remote MCP.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-http",
    serverName: "posthog",
    url: "https://mcp.posthog.com/mcp",
    oauth: true,
    iconLabel: "Ph",
    badge: "MCP",
  },
  {
    id: "zoom",
    name: "Zoom",
    description: "Meetings, chat, and recordings through Zoom’s workspace MCP.",
    kind: "mcp",
    filter: "mcp",
    install: "mcp-http",
    serverName: "zoom",
    url: "https://mcp.zoom.us/mcp/zoom/streamable",
    oauth: true,
    iconLabel: "Zm",
    badge: "MCP",
  },
  // Framer publishes no first-party MCP server. The route that exists is a
  // marketplace plugin that mints a URL against the signed-in Framer account
  // and proxies calls to the plugin, so the endpoint is per-user, secret, and
  // only live while that plugin is open.
  {
    id: "framer",
    name: "Framer",
    description: "Read and edit a Framer project through the Framer MCP plugin.",
    kind: "mcp",
    filter: "docs",
    install: "mcp-http-user-url",
    serverName: "framer",
    urlSource: "Framer → Plugins → MCP → copy your server URL",
    urlPlaceholder: "https://…workers.dev/mcp?token=…",
    requirement:
      "The MCP plugin has to stay open in your Framer project for this connection to answer.",
    iconLabel: "Fr",
    badge: "MCP",
  },
  {
    id: "asana",
    name: "Asana",
    description: "Tasks and projects through Asana’s remote MCP.",
    kind: "mcp",
    filter: "mcp",
    install: "mcp-http",
    serverName: "asana",
    url: "https://mcp.asana.com/v2/mcp",
    oauth: true,
    oauthClientIdRequired: true,
    iconLabel: "As",
    badge: "OAuth",
  },
  {
    id: "atlassian",
    name: "Atlassian",
    description: "Jira, Confluence, and Compass through Atlassian’s remote MCP.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-http",
    serverName: "atlassian",
    url: "https://mcp.atlassian.com/v1/mcp",
    oauth: true,
    iconLabel: "At",
    badge: "MCP",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "OpenAI tools and assistants through a local OpenAI-compatible MCP bridge.",
    kind: "guide",
    filter: "mcp",
    install: "settings",
    settingsSection: "providers",
    iconLabel: "OA",
    iconSrc: "/work/ext-openai.svg",
    badge: "Providers",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Repos, issues, and PRs through GitHub’s remote MCP.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-http",
    serverName: "github",
    url: "https://api.githubcopilot.com/mcp/",
    oauth: true,
    iconLabel: "GH",
    iconSrc: "/work/ext-github.svg",
    badge: "MCP",
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Projects and deployments through Vercel’s remote MCP.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-http",
    serverName: "vercel",
    url: "https://mcp.vercel.com",
    oauth: true,
    iconLabel: "▲",
    badge: "MCP",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Search channels and DMs via Slack’s remote MCP.",
    kind: "mcp",
    filter: "mcp",
    install: "mcp-http",
    serverName: "slack",
    url: "https://mcp.slack.com/mcp",
    oauth: true,
    iconLabel: "Sl",
    iconSrc: "/work/ext-slack.svg",
    badge: "MCP",
  },
  {
    id: "exa",
    name: "Exa",
    description:
      "AI web search and research. Free tier works without a key; add an API key in Tools & MCPs for higher limits.",
    kind: "mcp",
    filter: "docs",
    install: "mcp-http",
    serverName: "exa",
    url: "https://mcp.exa.ai/mcp",
    oauth: false,
    iconLabel: "Ex",
    iconSrc: "/work/ext-exa.svg",
    badge: "MCP",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Search mail and create drafts through Google’s remote OAuth MCP.",
    kind: "mcp",
    filter: "email",
    install: "mcp-http",
    serverName: "gmail",
    url: "https://gmailmcp.googleapis.com/mcp/v1",
    oauth: true,
    oauthClientIdRequired: true,
    iconLabel: "Gm",
    iconSrc: "/work/ext-gmail.svg",
    badge: "OAuth",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Read and schedule events through Google’s remote OAuth MCP.",
    kind: "mcp",
    filter: "email",
    install: "mcp-http",
    serverName: "google-calendar",
    url: "https://calendarmcp.googleapis.com/mcp/v1",
    oauth: true,
    oauthClientIdRequired: true,
    iconLabel: "Ca",
    iconSrc: "/work/ext-google-calendar.svg",
    badge: "OAuth",
  },
  {
    id: "playwright",
    name: "Playwright",
    description:
      "External Chromium automation. Prefer Modesto Browser for agent browsing — use Playwright only when you need a separate automation browser.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-stdio",
    serverName: "playwright",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    oauth: false,
    iconLabel: "Pw",
    iconSrc: "/work/ext-playwright.svg",
    badge: "External",
  },
  {
    id: "chrome-devtools",
    name: "Chrome DevTools",
    description:
      "External Chrome via DevTools MCP. Prefer Modesto’s in-app browser for research and signed-in Work tasks.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-stdio",
    serverName: "chrome-devtools",
    command: "npx",
    args: ["-y", "chrome-devtools-mcp@latest"],
    oauth: false,
    iconLabel: "Ch",
    iconSrc: "/work/ext-chrome.svg",
    badge: "External",
  },
  {
    id: "memory",
    name: "Memory",
    description: "Persistent knowledge graph memory for agents across Work sessions.",
    kind: "mcp",
    filter: "docs",
    install: "mcp-stdio",
    serverName: "memory",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    oauth: false,
    iconLabel: "Me",
    iconSrc: "/work/ext-memory.svg",
    badge: "Local",
  },
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read/write files under the current workspace via a local MCP.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-stdio",
    serverName: "filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    oauth: false,
    iconLabel: "Fs",
    iconSrc: "/work/ext-filesystem.svg",
    badge: "Local",
  },
  // OpenWork built-in extension manifests (MIT)
  {
    id: "openwork-browser",
    name: "Modesto Browser",
    description:
      "Primary in-app browser for Work agents — signed-in panel beside the session. Prefer this over Playwright or external Chrome.",
    kind: "guide",
    filter: "dev",
    install: "settings",
    settingsSection: "browserNetwork",
    iconLabel: "Br",
    iconSrc: "/work/ext-chrome.svg",
    badge: "Built in",
  },
  {
    id: "computer-use",
    name: "Computer Use",
    description:
      "Codex-style computer control for Mac apps via accessibility MCP, with Picture in Picture in the desktop Environment panel.",
    kind: "mcp",
    filter: "dev",
    install: "mcp-stdio",
    serverName: "computer-use",
    command: "npx",
    args: ["-y", "@openwork/handsfree", "mcp"],
    oauth: false,
    iconLabel: "CU",
    iconSrc: "/work/ext-mcp.svg",
    badge: "macOS",
  },
  {
    id: "openwork-voice",
    name: "Voice Mode",
    description: "Dictate with local Whisper and hear replies with the best voice on this device.",
    kind: "guide",
    filter: "mcp",
    install: "settings",
    settingsSection: "providers",
    iconLabel: "Vo",
    iconSrc: "/work/ext-openai.svg",
    badge: "Built in",
  },
  // Anthropic skills marketplace shelf (Apache-2.0 examples; open in GitHub)
  {
    id: "anthropic-document-skills",
    name: "Document skills",
    description: "Excel, Word, PowerPoint, and PDF skills from Anthropic’s skills marketplace.",
    kind: "skill-pack",
    filter: "skills",
    install: "external",
    href: "https://github.com/anthropics/skills/tree/main/skills",
    cta: "Browse on GitHub",
    iconLabel: "Doc",
    iconSrc: "/work/ext-skills.svg",
    badge: "Skills",
  },
  {
    id: "anthropic-example-skills",
    name: "Example skills",
    description:
      "Skill creator, frontend design, MCP builder, web testing, and more from Anthropic.",
    kind: "skill-pack",
    filter: "skills",
    install: "external",
    href: "https://github.com/anthropics/skills",
    cta: "Open marketplace",
    iconLabel: "Ex",
    iconSrc: "/work/ext-skills.svg",
    badge: "Skills",
  },
  {
    id: "anthropic-claude-api",
    name: "Claude API skill",
    description: "Claude API and SDK documentation skill for building LLM apps.",
    kind: "skill-pack",
    filter: "skills",
    install: "external",
    href: "https://github.com/anthropics/skills/tree/main/skills/claude-api",
    cta: "View skill",
    iconLabel: "API",
    iconSrc: "/work/ext-skills.svg",
    badge: "Skills",
  },
  {
    id: "providers",
    name: "Coding providers",
    description: "Install and sign in Codex, Claude, Cursor, Gemini, and other CLIs.",
    kind: "guide",
    filter: "dev",
    install: "settings",
    settingsSection: "providers",
    iconLabel: "Pr",
    iconSrc: "/work/ext-openai.svg",
    badge: "Providers",
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Local models at localhost:11434 — add via Provider Tools when available.",
    kind: "guide",
    filter: "dev",
    install: "settings",
    settingsSection: "providers",
    iconLabel: "Ol",
    iconSrc: "/work/ext-ollama.svg",
    badge: "Local",
  },
  {
    id: "modesto-plugins",
    name: "Provider plugins",
    description: "Browse and install provider plugins discovered by Modesto.",
    kind: "guide",
    filter: "dev",
    install: "settings",
    settingsSection: "plugins",
    iconLabel: "Pl",
    iconSrc: "/work/ext-plugins.svg",
    badge: "Plugins",
  },
  {
    id: "modesto-skills",
    name: "Local skills",
    description: "Enable portable skills from ~/.modesto and provider skill folders.",
    kind: "guide",
    filter: "skills",
    install: "settings",
    settingsSection: "skills",
    iconLabel: "Sk",
    iconSrc: "/work/ext-skills.svg",
    badge: "Skills",
  },
  {
    id: "custom-mcp",
    name: "Custom MCP",
    description: "Add any stdio or remote MCP server in Tools & MCPs.",
    kind: "guide",
    filter: "mcp",
    install: "settings",
    settingsSection: "toolsMcps",
    iconLabel: "MCP",
    iconSrc: "/work/ext-mcp.svg",
    badge: "Custom",
  },
];

function isMcpInstall(item: MarketplaceItem): item is MarketplaceItem & {
  readonly install: "mcp-http" | "mcp-stdio";
  readonly serverName: string;
} {
  return item.install === "mcp-http" || item.install === "mcp-stdio";
}

function shellJoin(parts: readonly string[]): string {
  return parts
    .map((part) => (/[\s"]/.test(part) ? `"${part.replaceAll('"', '\\"')}"` : part))
    .join(" ");
}

/**
 * Paste this into chat so the coding agent can install the server. Claude and
 * Codex both get an explicit command; other providers get the same name/URL.
 */
export function marketplaceInstallClipboardText(item: MarketplaceItem): string | null {
  if (item.install === "mcp-http-user-url") {
    return `Install the ${item.name} MCP server for me. The URL is unique to my account — get it from ${item.urlSource}, then add an HTTP MCP named \`${item.serverName}\` with that URL.${item.requirement ? ` ${item.requirement}` : ""}`;
  }
  if (item.install === "mcp-http") {
    if (item.id === "higgsfield") {
      return `Set up Higgsfield so I can generate images and videos from this chat.

Add the remote HTTP MCP (OAuth):
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
codex mcp add higgsfield --url https://mcp.higgsfield.ai/mcp

If this provider prefers the Higgsfield CLI instead: run \`npm i -g @higgsfield/cli\`, then \`higgsfield auth login\`, then \`npx skills add higgsfield-ai/skills\`.

Complete the browser sign-in if asked, then confirm Higgsfield is ready.`;
    }
    const oauth = item.oauth ? " It uses OAuth — complete the sign-in if the provider asks." : "";
    return `Install the ${item.name} MCP server for me.${oauth}

claude mcp add --transport http --scope user ${item.serverName} ${item.url}
codex mcp add ${item.serverName} --url ${item.url}

This is a remote HTTP MCP named \`${item.serverName}\` at ${item.url}. Add it for the coding provider in this thread, then confirm it is listed.`;
  }
  if (item.install === "mcp-stdio") {
    const command = shellJoin([item.command, ...item.args]);
    return `Install the ${item.name} MCP server for me.

claude mcp add --scope user ${item.serverName} -- ${command}
codex mcp add ${item.serverName} -- ${command}

This is a local stdio MCP named \`${item.serverName}\`. Add it for the coding provider in this thread, then confirm it is listed.`;
  }
  return null;
}

/** Match an installed MCP server name to a marketplace catalog entry. */
export function findMarketplaceMcpItemByServerName(
  serverName: string,
): MarketplaceItem | undefined {
  const normalized = serverName.trim().toLowerCase();
  if (!normalized) return undefined;
  return WORK_MARKETPLACE_ITEMS.find(
    (item) => isMcpInstall(item) && item.serverName.toLowerCase() === normalized,
  );
}

export function findMarketplaceItemById(id: string): MarketplaceItem | undefined {
  return WORK_MARKETPLACE_ITEMS.find((item) => item.id === id);
}

/** Catalog title + logo for Connected-tab rows (falls back to raw server name). */
export function marketplaceDisplayForServer(serverName: string): MarketplaceServerDisplay {
  const item = findMarketplaceMcpItemByServerName(serverName);
  if (!item) {
    const label = serverName.trim();
    return {
      title: label || serverName,
      iconLabel: (label.slice(0, 2) || "?").toUpperCase(),
    };
  }
  return {
    title: item.name,
    iconLabel: item.iconLabel,
    ...(item.iconSrc ? { iconSrc: item.iconSrc } : {}),
    ...(item.badge ? { badge: item.badge } : {}),
  };
}

export type MarketplacePrimaryAction = {
  readonly label: string;
  /** When false, primary click must not install/remove — Disconnect is the only destructive path. */
  readonly installs: boolean;
};

/** Primary CTA labeling for marketplace cards (keeps Connected inert). */
export function marketplacePrimaryAction(input: {
  readonly install: MarketplaceItem["install"];
  readonly connected: boolean;
  readonly oauth?: boolean;
  readonly cta?: string;
}): MarketplacePrimaryAction {
  if (input.install === "external") {
    return { label: input.cta ?? "Open", installs: true };
  }
  if (input.install === "settings") {
    return { label: "Open", installs: true };
  }
  if (input.connected) {
    return { label: "Connected", installs: false };
  }
  if (input.install === "mcp-http" && input.oauth) {
    return { label: "Connect", installs: true };
  }
  return { label: "Enable", installs: true };
}
