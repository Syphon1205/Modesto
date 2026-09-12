// FILE: webApps.ts
// Purpose: The web apps Modesto can work inside - Gmail, Outlook, Drive,
//          Sheets and the rest - and everything needed to reach them.
// Layer: Connections model (pure data, no React)
//
// This is deliberately NOT the MCP catalog in `connectionsCatalog.ts`. That
// one connects a service by installing an MCP server and running an OAuth
// flow, which means credentials, client ids, and a second copy of the user's
// account access. These entries connect the way a person does: you sign in to
// the app inside Modesto's own browser, and the session stays in the browser's
// partition - the same place a normal browser keeps it. Being "connected" is
// therefore not a stored token but an observable fact about that session.
//
// `sessionCookieNames` is what makes that fact checkable: these are the
// cookies each app sets once a real sign-in completes, scoped to
// `cookieDomain`. A probe over the browser partition's cookie jar answers
// "signed in?" without touching the account, storing anything, or reading
// page content.
//
// `mentionAliases` feeds composer mentions (`@gmail`), so a user who types the
// name they know lands on the same entry as the canonical id.

import { collectComposerInlineTokens } from "@modesto/shared/composerInlineTokens";
import { scoreQueryMatch } from "@modesto/shared/searchRanking";

export type WebAppCategory =
  | "email"
  | "docs"
  | "calendar"
  | "chat"
  | "storage"
  | "dev"
  | "crm"
  | "design"
  | "support"
  | "commerce";

export interface WebApp {
  readonly id: string;
  readonly name: string;
  /** One line, shown under the name on a card. */
  readonly description: string;
  readonly category: WebAppCategory;
  /** Where the app opens when there is nothing more specific to open. */
  readonly homeUrl: string;
  /** Where a signed-out user is sent to sign in. */
  readonly signInUrl: string;
  /** Cookie domain the session lives on. */
  readonly cookieDomain: string;
  /**
   * Cookies that only exist for a signed-in session. Any one of them present
   * is treated as signed in; requiring all of them would report false
   * negatives as providers rotate their cookie sets.
   */
  readonly sessionCookieNames: ReadonlyArray<string>;
  /** Extra names accepted by `@` mentions, beyond the id and the name. */
  readonly mentionAliases: ReadonlyArray<string>;
  /** What the agent is told it can do here, in one line. */
  readonly capabilityHint: string;
  /**
   * Marketplace MCP server name when this app also speaks Model Context
   * Protocol. Mentions still open the website; the name is how we match an
   * installed MCP server if the coding provider has one.
   */
  readonly mcpServerName?: string;
}

export const WEB_APPS: ReadonlyArray<WebApp> = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Read, draft, and send mail in your Google account.",
    category: "email",
    homeUrl: "https://mail.google.com/mail/u/0/",
    signInUrl: "https://accounts.google.com/ServiceLogin?service=mail",
    cookieDomain: ".google.com",
    // Google sets SID/SSID on sign-in and __Secure-1PSID on modern sessions.
    sessionCookieNames: ["SID", "__Secure-1PSID", "SSID"],
    mentionAliases: ["mail", "email", "inbox", "google-mail"],
    capabilityHint:
      "search and read mail, draft and send replies, follow up on a thread, set a reminder",
    mcpServerName: "gmail",
  },
  {
    id: "outlook",
    name: "Outlook",
    description: "Read, draft, and send mail in your Microsoft account.",
    category: "email",
    homeUrl: "https://outlook.office.com/mail/",
    signInUrl: "https://login.microsoftonline.com/",
    cookieDomain: ".office.com",
    sessionCookieNames: ["ESTSAUTH", "ESTSAUTHPERSISTENT", "OhpAuth"],
    mentionAliases: ["office", "microsoft-mail", "hotmail"],
    capabilityHint:
      "search and read mail, draft and send replies, follow up on a thread, set a reminder",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Browse, upload, and share files in Drive.",
    category: "storage",
    homeUrl: "https://drive.google.com/drive/my-drive",
    signInUrl: "https://accounts.google.com/ServiceLogin?service=wise",
    cookieDomain: ".google.com",
    sessionCookieNames: ["SID", "__Secure-1PSID", "SSID"],
    mentionAliases: ["drive"],
    capabilityHint: "open a folder, upload a file, share a document, pull a spreadsheet or deck",
    mcpServerName: "google-drive",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Open a spreadsheet, or import a CSV Modesto produced.",
    category: "docs",
    homeUrl: "https://docs.google.com/spreadsheets/u/0/",
    signInUrl: "https://accounts.google.com/ServiceLogin?service=wise",
    cookieDomain: ".google.com",
    sessionCookieNames: ["SID", "__Secure-1PSID", "SSID"],
    mentionAliases: ["sheets", "spreadsheet"],
    capabilityHint: "create a spreadsheet, import a CSV, edit cells",
  },
  {
    id: "google-docs",
    name: "Google Docs",
    description: "Open or create a document.",
    category: "docs",
    homeUrl: "https://docs.google.com/document/u/0/",
    signInUrl: "https://accounts.google.com/ServiceLogin?service=writely",
    cookieDomain: ".google.com",
    sessionCookieNames: ["SID", "__Secure-1PSID", "SSID"],
    mentionAliases: ["docs", "gdocs"],
    capabilityHint: "create a document, paste in content, share it",
  },
  {
    id: "google-slides",
    name: "Google Slides",
    description: "Decks and presentations in Google Slides.",
    category: "docs",
    homeUrl: "https://docs.google.com/presentation/u/0/",
    signInUrl: "https://accounts.google.com/ServiceLogin?service=wise",
    cookieDomain: ".google.com",
    sessionCookieNames: ["SID", "__Secure-1PSID", "SSID"],
    mentionAliases: ["gslides", "presentations"],
    capabilityHint: "open a deck, add a slide, export a PDF",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Check availability and create events.",
    category: "calendar",
    homeUrl: "https://calendar.google.com/calendar/u/0/r",
    signInUrl: "https://accounts.google.com/ServiceLogin?service=cl",
    cookieDomain: ".google.com",
    sessionCookieNames: ["SID", "__Secure-1PSID", "SSID"],
    mentionAliases: ["calendar", "gcal"],
    capabilityHint: "check a day, create an event, invite people, set a reminder",
    mcpServerName: "google-calendar",
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Scheduling links and bookings in Calendly.",
    category: "calendar",
    homeUrl: "https://calendly.com/app/scheduled_events/user/me",
    signInUrl: "https://calendly.com/login",
    cookieDomain: ".calendly.com",
    sessionCookieNames: ["_calendly_session", "remember_user_token"],
    mentionAliases: ["scheduling"],
    capabilityHint: "open upcoming events, share a booking link, check availability",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Read and post in your Slack workspaces.",
    category: "chat",
    homeUrl: "https://app.slack.com/client",
    signInUrl: "https://slack.com/signin",
    cookieDomain: ".slack.com",
    sessionCookieNames: ["d", "d-s"],
    mentionAliases: ["slack-chat"],
    capabilityHint: "read and send messages, open DMs, search history, set a Slack reminder",
    mcpServerName: "slack",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Chat, channels, and meetings in your Microsoft tenant.",
    category: "chat",
    homeUrl: "https://teams.microsoft.com/",
    signInUrl: "https://login.microsoftonline.com/",
    cookieDomain: ".microsoft.com",
    sessionCookieNames: ["ESTSAUTH", "ESTSAUTHPERSISTENT", "TSAUTHCOOKIE"],
    mentionAliases: ["microsoft-teams", "msteams", "ms-teams"],
    capabilityHint: "read and send chats, post in a channel, join a meeting, check mentions",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Open and edit Notion pages.",
    category: "docs",
    homeUrl: "https://www.notion.so/",
    signInUrl: "https://www.notion.so/login",
    cookieDomain: ".notion.so",
    sessionCookieNames: ["token_v2"],
    mentionAliases: [],
    capabilityHint: "open a page, add content, search the workspace",
    mcpServerName: "notion",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Read and update issues in your Linear workspace.",
    category: "dev",
    homeUrl: "https://linear.app/",
    signInUrl: "https://linear.app/login",
    cookieDomain: ".linear.app",
    // Linear has rotated through NextAuth and Auth.js cookie names.
    sessionCookieNames: [
      "__Secure-next-auth.session-token",
      "__Secure-authjs.session-token",
      "linear_session",
    ],
    mentionAliases: [],
    capabilityHint: "open an issue, update status, search the backlog",
    mcpServerName: "linear",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Browse and update Jira issues in Atlassian Cloud.",
    category: "dev",
    homeUrl: "https://start.atlassian.com/",
    signInUrl: "https://id.atlassian.com/login",
    cookieDomain: ".atlassian.com",
    sessionCookieNames: ["cloud.session.token", "tenant.session.token"],
    mentionAliases: ["atlassian"],
    capabilityHint: "open an issue, update status, search projects",
    mcpServerName: "atlassian",
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Inspect errors and issue details in Sentry.",
    category: "dev",
    homeUrl: "https://sentry.io/",
    signInUrl: "https://sentry.io/auth/login/",
    cookieDomain: ".sentry.io",
    sessionCookieNames: ["sentrysid", "session"],
    mentionAliases: [],
    capabilityHint: "open an issue, inspect a stack trace, check recent errors",
    mcpServerName: "sentry",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Browse repos, PRs, and issues on GitHub.",
    category: "dev",
    homeUrl: "https://github.com/",
    signInUrl: "https://github.com/login",
    cookieDomain: ".github.com",
    sessionCookieNames: ["user_session", "logged_in", "__Host-user_session_same_site"],
    mentionAliases: ["gh"],
    capabilityHint: "open a PR, review a diff, search issues",
    mcpServerName: "github",
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Inspect deployments and project settings on Vercel.",
    category: "dev",
    homeUrl: "https://vercel.com/",
    signInUrl: "https://vercel.com/login",
    cookieDomain: ".vercel.com",
    sessionCookieNames: ["_vercel_jwt"],
    mentionAliases: ["now"],
    capabilityHint: "inspect a deployment, open a preview, check build status",
    mcpServerName: "vercel",
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Projects, tables, and auth in Supabase.",
    category: "dev",
    homeUrl: "https://supabase.com/dashboard",
    signInUrl: "https://supabase.com/dashboard/sign-in",
    cookieDomain: ".supabase.com",
    sessionCookieNames: ["__session", "sb-access-token", "sb-refresh-token"],
    mentionAliases: [],
    capabilityHint: "open a project, inspect a table, check auth users",
    mcpServerName: "supabase",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "Workers, DNS, and dashboards in Cloudflare.",
    category: "dev",
    homeUrl: "https://dash.cloudflare.com/",
    signInUrl: "https://dash.cloudflare.com/login",
    cookieDomain: ".cloudflare.com",
    sessionCookieNames: ["CF_Authorization", "dash_session"],
    mentionAliases: ["cf"],
    capabilityHint: "open a zone, check a Worker, inspect DNS",
    mcpServerName: "cloudflare",
  },
  {
    id: "neon",
    name: "Neon",
    description: "Serverless Postgres projects and branches in Neon.",
    category: "dev",
    homeUrl: "https://console.neon.tech/",
    signInUrl: "https://console.neon.tech/login",
    cookieDomain: ".neon.tech",
    sessionCookieNames: ["__session", "neon-session"],
    mentionAliases: ["neon-postgres"],
    capabilityHint: "open a project, inspect a branch, run a query",
    mcpServerName: "neon",
  },
  {
    id: "posthog",
    name: "PostHog",
    description: "Product analytics, flags, and session replay in PostHog.",
    category: "dev",
    homeUrl: "https://us.posthog.com/",
    signInUrl: "https://us.posthog.com/login",
    cookieDomain: ".posthog.com",
    sessionCookieNames: ["ph_s", "sessionid", "csrftoken"],
    mentionAliases: ["ph"],
    capabilityHint: "check a trend, inspect a flag, pull a session replay",
    mcpServerName: "posthog",
  },
  {
    id: "google-tasks",
    name: "Reminders",
    description: "Google Tasks — reminders and follow-ups.",
    category: "calendar",
    homeUrl: "https://tasks.google.com/",
    signInUrl: "https://accounts.google.com/ServiceLogin?service=wise",
    cookieDomain: ".google.com",
    sessionCookieNames: ["SID", "__Secure-1PSID", "SSID"],
    mentionAliases: ["tasks", "reminders", "google-tasks", "todo"],
    capabilityHint: "list reminders, add a task, mark one done, set a due time",
  },
  {
    id: "google-messages",
    name: "Messages",
    description: "Google Messages — texts on the web.",
    category: "chat",
    homeUrl: "https://messages.google.com/web",
    signInUrl: "https://messages.google.com/web",
    cookieDomain: ".google.com",
    sessionCookieNames: ["SID", "__Secure-1PSID", "SSID"],
    mentionAliases: ["sms", "texts", "messages", "google-messages"],
    capabilityHint: "read and send texts, open a conversation, search messages",
  },
  {
    id: "google-chat",
    name: "Google Chat",
    description: "Spaces and DMs in Google Chat.",
    category: "chat",
    homeUrl: "https://chat.google.com/",
    signInUrl: "https://accounts.google.com/ServiceLogin?service=talk",
    cookieDomain: ".google.com",
    sessionCookieNames: ["SID", "__Secure-1PSID", "SSID"],
    mentionAliases: ["gchat", "hangouts"],
    capabilityHint: "read and send messages, open a space, search Chat",
  },
  {
    id: "discord",
    name: "Discord",
    description: "Servers, DMs, and voice in Discord.",
    category: "chat",
    homeUrl: "https://discord.com/channels/@me",
    signInUrl: "https://discord.com/login",
    cookieDomain: ".discord.com",
    sessionCookieNames: ["__dcfduid", "__sdcfduid", "__cfruid"],
    mentionAliases: ["dsc"],
    capabilityHint: "read and send messages, open a server, search DMs",
  },
  {
    id: "zoom",
    name: "Zoom",
    description: "Meetings, recordings, and chat in Zoom.",
    category: "calendar",
    homeUrl: "https://zoom.us/meeting",
    signInUrl: "https://zoom.us/signin",
    cookieDomain: ".zoom.us",
    sessionCookieNames: ["_zm_ssid", "zm_aid", "_zm_page_auth"],
    mentionAliases: ["zoom-meetings"],
    capabilityHint: "find a meeting, join a call, pull a recording",
    mcpServerName: "zoom",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM contacts, deals, and marketing in HubSpot.",
    category: "crm",
    homeUrl: "https://app.hubspot.com/",
    signInUrl: "https://app.hubspot.com/login",
    cookieDomain: ".hubspot.com",
    sessionCookieNames: ["hubspotapi", "__Host-hs_sid", "hubspotapi-csrf"],
    mentionAliases: ["hs", "hub-spot"],
    capabilityHint: "pull contacts and deals, update a pipeline, draft a sequence",
    mcpServerName: "hubspot",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Accounts, opportunities, and reports in Salesforce.",
    category: "crm",
    homeUrl: "https://login.salesforce.com/",
    signInUrl: "https://login.salesforce.com/",
    cookieDomain: ".salesforce.com",
    sessionCookieNames: ["sid", "sid_Client", "authtoken"],
    mentionAliases: ["sfdc", "sforce"],
    capabilityHint: "pull accounts and opportunities, update a deal, run a report",
    mcpServerName: "salesforce",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Pipeline, deals, and activities in Pipedrive.",
    category: "crm",
    homeUrl: "https://app.pipedrive.com/",
    signInUrl: "https://app.pipedrive.com/auth/login",
    cookieDomain: ".pipedrive.com",
    sessionCookieNames: ["pipe-session", "sid"],
    mentionAliases: ["pipe"],
    capabilityHint: "open the pipeline, update a deal, log an activity",
  },
  {
    id: "figma",
    name: "Figma",
    description: "Open design files and inspect components in Figma.",
    category: "design",
    homeUrl: "https://www.figma.com/files",
    signInUrl: "https://www.figma.com/login",
    cookieDomain: ".figma.com",
    sessionCookieNames: ["__Host-figma.identity", "figma.st"],
    mentionAliases: ["fig"],
    capabilityHint: "open a file, inspect a frame, copy design context",
    mcpServerName: "figma",
  },
  {
    id: "higgsfield",
    name: "Higgsfield",
    description: "Generate images, video, characters, and audio in Higgsfield.",
    category: "design",
    homeUrl: "https://higgsfield.ai/",
    signInUrl: "https://higgsfield.ai/",
    cookieDomain: ".higgsfield.ai",
    sessionCookieNames: ["__session", "__client", "__clerk_db_jwt", "session"],
    mentionAliases: ["higgs", "higgsfield-ai", "hf"],
    capabilityHint: "generate an image or video, check credit balance, list recent generations",
    mcpServerName: "higgsfield",
  },
  {
    id: "canva",
    name: "Canva",
    description: "Designs, brand kits, and exports in Canva.",
    category: "design",
    homeUrl: "https://www.canva.com/",
    signInUrl: "https://www.canva.com/login",
    cookieDomain: ".canva.com",
    sessionCookieNames: ["C_AUTH", "CAU", "_canva_ses"],
    mentionAliases: [],
    capabilityHint: "open a design, edit a page, export a file",
    mcpServerName: "canva",
  },
  {
    id: "loom",
    name: "Loom",
    description: "Async video recordings and transcripts in Loom.",
    category: "design",
    homeUrl: "https://www.loom.com/looms/videos",
    signInUrl: "https://www.loom.com/login",
    cookieDomain: ".loom.com",
    sessionCookieNames: ["loom_session", "__session", "connect.sid"],
    mentionAliases: [],
    capabilityHint: "find a recording, pull a transcript, share a video",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Watch, search, and manage YouTube.",
    category: "design",
    homeUrl: "https://www.youtube.com/",
    signInUrl: "https://accounts.google.com/ServiceLogin?service=youtube",
    cookieDomain: ".youtube.com",
    sessionCookieNames: ["SID", "LOGIN_INFO", "__Secure-1PSID"],
    mentionAliases: ["yt"],
    capabilityHint: "find a video, pull a transcript, open a channel",
  },
  {
    id: "framer",
    name: "Framer",
    description: "Build and edit sites in Framer.",
    category: "design",
    homeUrl: "https://www.framer.com/projects",
    signInUrl: "https://www.framer.com/login",
    cookieDomain: ".framer.com",
    // Framer has used Auth.js, Clerk, and a first-party session cookie.
    // Any one present is enough for the desktop probe.
    sessionCookieNames: [
      "__session",
      "__client",
      "__Secure-next-auth.session-token",
      "__Host-next-auth.session-token",
      "framer.sid",
    ],
    mentionAliases: ["framer-sites", "framercom"],
    capabilityHint: "open a project, edit a page, update CMS content",
    // Framer's official path is External Agents (`npx @framer/agent setup`),
    // not a remote MCP endpoint like Figma's.
  },
  {
    id: "asana",
    name: "Asana",
    description: "Tasks, projects, and assignments in Asana.",
    category: "docs",
    homeUrl: "https://app.asana.com/",
    signInUrl: "https://app.asana.com/-/login",
    cookieDomain: ".asana.com",
    sessionCookieNames: ["ticket", "auth_token"],
    mentionAliases: [],
    capabilityHint: "open a project, update a task, check what's due",
    mcpServerName: "asana",
  },
  {
    id: "clickup",
    name: "ClickUp",
    description: "Tasks, docs, and sprints in ClickUp.",
    category: "docs",
    homeUrl: "https://app.clickup.com/",
    signInUrl: "https://app.clickup.com/login",
    cookieDomain: ".clickup.com",
    sessionCookieNames: ["cu_jwt", "token", "__cf_bm"],
    mentionAliases: [],
    capabilityHint: "open a list, update a task, check what's due",
    mcpServerName: "clickup",
  },
  {
    id: "trello",
    name: "Trello",
    description: "Boards, cards, and lists in Trello.",
    category: "docs",
    homeUrl: "https://trello.com/",
    signInUrl: "https://trello.com/login",
    cookieDomain: ".trello.com",
    sessionCookieNames: ["token", "dsc"],
    mentionAliases: [],
    capabilityHint: "open a board, move a card, check a list",
  },
  {
    id: "monday",
    name: "monday.com",
    description: "Boards, items, and workflows in monday.com.",
    category: "docs",
    homeUrl: "https://auth.monday.com/login",
    signInUrl: "https://auth.monday.com/login",
    cookieDomain: ".monday.com",
    sessionCookieNames: ["auth", "sl_session"],
    mentionAliases: ["mondaycom", "monday-dot-com"],
    capabilityHint: "open a board, update an item, check a status",
  },
  {
    id: "airtable",
    name: "Airtable",
    description: "Bases, records, and views in Airtable.",
    category: "docs",
    homeUrl: "https://airtable.com/",
    signInUrl: "https://airtable.com/login",
    cookieDomain: ".airtable.com",
    sessionCookieNames: ["__Host-airtable-session", "brw"],
    mentionAliases: [],
    capabilityHint: "open a base, find a record, update a field",
  },
  {
    id: "confluence",
    name: "Confluence",
    description: "Spaces and pages in Atlassian Confluence.",
    category: "docs",
    homeUrl: "https://start.atlassian.com/",
    signInUrl: "https://id.atlassian.com/login",
    cookieDomain: ".atlassian.com",
    sessionCookieNames: ["cloud.session.token", "tenant.session.token"],
    mentionAliases: [],
    capabilityHint: "open a space, search pages, update a doc",
    mcpServerName: "atlassian",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Customers, invoices, and payments in Stripe.",
    category: "commerce",
    homeUrl: "https://dashboard.stripe.com/",
    signInUrl: "https://dashboard.stripe.com/login",
    cookieDomain: ".stripe.com",
    sessionCookieNames: ["merchant", "stripe.csrf"],
    mentionAliases: [],
    capabilityHint: "look up a customer, check an invoice, review a payment",
    mcpServerName: "stripe",
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Orders, products, and customers in Shopify admin.",
    category: "commerce",
    homeUrl: "https://admin.shopify.com/",
    signInUrl: "https://accounts.shopify.com/lookup",
    cookieDomain: ".shopify.com",
    sessionCookieNames: ["_secure_session_id", "_shopify_s"],
    mentionAliases: [],
    capabilityHint: "look up an order, check inventory, draft a product update",
  },
  {
    id: "intercom",
    name: "Intercom",
    description: "Inbox, conversations, and customers in Intercom.",
    category: "support",
    homeUrl: "https://app.intercom.com/",
    signInUrl: "https://app.intercom.com/admins/sign_in",
    cookieDomain: ".intercom.com",
    sessionCookieNames: ["_intercom_session", "intercom-session"],
    mentionAliases: [],
    capabilityHint: "open the inbox, draft a reply, look up a customer",
  },
  {
    id: "zendesk",
    name: "Zendesk",
    description: "Tickets and customers in Zendesk Support.",
    category: "support",
    homeUrl: "https://www.zendesk.com/login/",
    signInUrl: "https://www.zendesk.com/login/",
    cookieDomain: ".zendesk.com",
    sessionCookieNames: ["_zendesk_shared_session", "_zendesk_session"],
    mentionAliases: ["zen"],
    capabilityHint: "open a ticket, draft a reply, search the help center",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Files and shared folders in Dropbox.",
    category: "storage",
    homeUrl: "https://www.dropbox.com/home",
    signInUrl: "https://www.dropbox.com/login",
    cookieDomain: ".dropbox.com",
    sessionCookieNames: ["jar", "gvc", "t"],
    mentionAliases: ["dbx"],
    capabilityHint: "open a folder, find a file, share a link",
  },
  {
    id: "box",
    name: "Box",
    description: "Files and collaboration in Box.",
    category: "storage",
    homeUrl: "https://app.box.com/",
    signInUrl: "https://account.box.com/login",
    cookieDomain: ".box.com",
    sessionCookieNames: ["z", "box_csrf"],
    mentionAliases: [],
    capabilityHint: "open a folder, find a file, share a document",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Profile, messages, and posts on LinkedIn.",
    category: "crm",
    homeUrl: "https://www.linkedin.com/feed/",
    signInUrl: "https://www.linkedin.com/login",
    cookieDomain: ".linkedin.com",
    sessionCookieNames: ["li_at", "JSESSIONID", "liap"],
    mentionAliases: ["li"],
    capabilityHint: "open a profile, draft a message, search people",
  },
];

export const WEB_APP_BY_ID: Readonly<Record<string, WebApp>> = Object.fromEntries(
  WEB_APPS.map((app) => [app.id, app]),
);

/**
 * Resolve a typed mention to an app. Matches the id, the display name, and the
 * declared aliases, case- and separator-insensitively, so `@gmail`, `@Gmail`,
 * `@google mail`, and `@google-mail` all land on the same entry.
 */
export function resolveWebAppMention(query: string): WebApp | undefined {
  const normalized = normalizeMentionToken(query);
  if (normalized.length === 0) return undefined;
  return WEB_APPS.find(
    (app) =>
      normalizeMentionToken(app.id) === normalized ||
      normalizeMentionToken(app.name) === normalized ||
      app.mentionAliases.some((alias) => normalizeMentionToken(alias) === normalized),
  );
}

/** Preferred `@` token for the picker and inserted mentions. */
export function webAppMentionLabel(app: WebApp): string {
  const token =
    app.id === "google-tasks"
      ? "reminders"
      : app.id === "google-messages"
        ? "messages"
        : app.id === "google-calendar"
          ? "calendar"
          : app.id === "google-drive"
            ? "drive"
            : app.id === "google-sheets"
              ? "sheets"
              : app.id === "google-docs"
                ? "docs"
                : app.id === "google-chat"
                  ? "gchat"
                  : app.id;
  return `@${token}`;
}

/**
 * A mention chip whose path is a catalog app (`drive`, `salesforce`), not a
 * workspace file. Paths with a slash stay files even if a segment matches.
 */
export function webAppForMentionPath(path: string): WebApp | undefined {
  if (path.includes("/") || path.includes("\\")) return undefined;
  return resolveWebAppMention(path);
}

/** Serialized composer token for a web-app mention, or null for ordinary files. */
export function serializeComposerWebAppMention(path: string): string | null {
  const app = webAppForMentionPath(path);
  return app ? webAppMentionLabel(app) : null;
}

export type WebAppMentionMatch = {
  readonly app: WebApp;
  readonly didYouMean: boolean;
};

const MENTION_FUZZY_BASE = 100;

/** Apps whose mention text starts with the typed prefix, for the picker. */
export function matchWebAppMentions(query: string): ReadonlyArray<WebApp> {
  return searchWebAppMentions(query).map((match) => match.app);
}

/**
 * Ranked `@` matches, including a fuzzy "Did you mean…?" hit for typos
 * (`@slak` → Slack). Empty query lists the whole catalog so `@` is the
 * place to browse mail, chat, reminders, and the rest.
 */
export function searchWebAppMentions(query: string): ReadonlyArray<WebAppMentionMatch> {
  const normalized = normalizeMentionToken(query);
  if (normalized.length === 0) {
    return WEB_APPS.map((app) => ({ app, didYouMean: false }));
  }

  const ranked: WebAppMentionMatch[] = [];
  for (const app of WEB_APPS) {
    const scores = [app.id, app.name, ...app.mentionAliases].flatMap((candidate) => {
      const score = scoreQueryMatch({
        value: normalizeMentionToken(candidate),
        query: normalized,
        exactBase: 0,
        prefixBase: 2,
        boundaryBase: 4,
        includesBase: 6,
        ...(normalized.length >= 4 ? { fuzzyBase: MENTION_FUZZY_BASE } : {}),
        boundaryMarkers: ["-", "_", " "],
      });
      return score === null ? [] : [score];
    });
    if (scores.length === 0) continue;
    const score = Math.min(...scores);
    ranked.push({ app, didYouMean: score >= MENTION_FUZZY_BASE });
  }
  ranked.sort((left, right) => {
    if (left.didYouMean !== right.didYouMean) return left.didYouMean ? 1 : -1;
    return WEB_APPS.indexOf(left.app) - WEB_APPS.indexOf(right.app);
  });
  return ranked;
}

/**
 * Web apps named in a composer prompt (`@gmail`, `@sheets`, …).
 *
 * Mentions are collected in prompt order and de-duplicated, so a prompt that
 * names Gmail twice still opens one Gmail tab.
 */
export function collectWebAppsFromPrompt(prompt: string): ReadonlyArray<WebApp> {
  const seen = new Set<string>();
  const apps: WebApp[] = [];
  for (const token of collectComposerInlineTokens(prompt.endsWith(" ") ? prompt : `${prompt} `)) {
    if (token.type !== "mention") continue;
    const app = resolveWebAppMention(token.value);
    if (!app || seen.has(app.id)) continue;
    seen.add(app.id);
    apps.push(app);
  }
  return apps;
}

function normalizeMentionToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/gu, "");
}
