import type { LucideIcon } from "lucide-react";
import {
  BugIcon,
  ClipboardListIcon,
  CpuIcon,
  FileTextIcon,
  GitPullRequestIcon,
  HammerIcon,
  HelpCircleIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  ListTodoIcon,
  MessagesSquareIcon,
  MessageSquarePlusIcon,
  PlugIcon,
  PresentationIcon,
  Table2Icon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  SplitIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";

export const SLIDES_SLASH_COMMAND = "slides";

/** Normalize `/Figma` or `figma` to the lookup key. */
export function normalizeSlashCommandName(name: string): string {
  return name.trim().replace(/^\/+/, "").toLowerCase();
}

const LUCIDE_BY_COMMAND: Readonly<Record<string, LucideIcon>> = {
  model: CpuIcon,
  plan: ClipboardListIcon,
  default: HammerIcon,
  spawn: SplitIcon,
  multiagent: SplitIcon,
  side: MessagesSquareIcon,
  canvas: LayoutDashboardIcon,
  dashboard: LayoutDashboardIcon,
  slides: PresentationIcon,
  figma: LayoutTemplateIcon,
  framer: LayoutTemplateIcon,
  sheets: Table2Icon,
  sheet: Table2Icon,
  spreadsheet: Table2Icon,
  spreadsheets: Table2Icon,
  docs: FileTextIcon,
  doc: FileTextIcon,
  documentation: FileTextIcon,
  debug: BugIcon,
  debugger: BugIcon,
  feedback: MessageSquarePlusIcon,
  compact: LayersIcon,
  context: LayersIcon,
  cost: SparklesIcon,
  doctor: HelpCircleIcon,
  help: HelpCircleIcon,
  init: SparklesIcon,
  review: GitPullRequestIcon,
  pr: GitPullRequestIcon,
  "pr-comments": GitPullRequestIcon,
  commit: GitPullRequestIcon,
  diff: GitPullRequestIcon,
  mcp: PlugIcon,
  plugin: PlugIcon,
  plugins: PlugIcon,
  permissions: ShieldCheckIcon,
  security: ShieldCheckIcon,
  "security-review": ShieldCheckIcon,
  status: SearchIcon,
  resume: RefreshCwIcon,
  login: Settings2Icon,
  logout: Settings2Icon,
  config: Settings2Icon,
  settings: Settings2Icon,
  theme: SparklesIcon,
  vim: TerminalIcon,
  terminal: TerminalIcon,
  agents: SparklesIcon,
  skills: SparklesIcon,
  memory: LayersIcon,
  export: FileTextIcon,
  tasks: ListTodoIcon,
  todo: ListTodoIcon,
  fix: WrenchIcon,
  bughunter: BugIcon,
};

export function slashCommandLucideIcon(name: string): LucideIcon {
  const key = normalizeSlashCommandName(name);
  return LUCIDE_BY_COMMAND[key] ?? SparklesIcon;
}

export function slashCommandHasBrandMark(name: string): boolean {
  const key = normalizeSlashCommandName(name);
  return key === "figma" || key === "framer";
}
