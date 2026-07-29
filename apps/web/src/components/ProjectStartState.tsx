// FILE: ProjectStartState.tsx
// Purpose: Useful first-run workbench for an empty Modesto workspace.
// Layer: Shared app component

import { FolderIcon, GitBranchIcon, PlusIcon, SparklesIcon } from "~/lib/icons";
import { requestOpenAddProject } from "../projectUiEvents";
import { ModestoLogo } from "./ModestoLogo";
import { RouteInsetSurface } from "./RouteInsetSurface";

const START_CAPABILITIES = [
  {
    icon: SparklesIcon,
    label: "Agent sessions",
    description: "Keep plans, runs, checkpoints, and handoffs in one durable thread.",
  },
  {
    icon: GitBranchIcon,
    label: "Project-aware",
    description: "Carry the active project, branch, and Git state into every agent run.",
  },
] as const;

export function ProjectStartState() {
  return (
    <RouteInsetSurface>
      <main className="flex h-full min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-12">
        <section className="w-full max-w-[40rem]">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-border/65 bg-[var(--color-background-elevated-primary)] shadow-sm">
              <ModestoLogo aria-hidden="true" className="size-7" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/65">
                Modesto workbench
              </p>
              <h1 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
                Start with a project
              </h1>
            </div>
          </div>

          <button
            type="button"
            className="group flex w-full items-center gap-4 rounded-xl border border-border/70 bg-[var(--color-background-elevated-primary)] p-4 text-left shadow-[0_8px_30px_-22px_rgba(0,0,0,0.65)] transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-border hover:bg-[var(--color-background-elevated-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={requestOpenAddProject}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-background-button-primary)] text-[var(--color-text-button-primary)]">
              <FolderIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">Open a code project</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                Choose a folder, then start an agent with the right workspace and Git context.
              </span>
            </span>
            <PlusIcon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </button>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {START_CAPABILITIES.map(({ icon: Icon, label, description }) => (
              <div
                key={label}
                className="rounded-xl border border-border/50 bg-[color-mix(in_srgb,var(--color-background-elevated-primary)_62%,transparent)] p-4"
              >
                <Icon className="mb-3 size-4 text-muted-foreground" />
                <h2 className="text-xs font-medium text-foreground/90">{label}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground/75">{description}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground/55">
            Projects stay local. Modesto only gives an agent access when you start a session.
          </p>
        </section>
      </main>
    </RouteInsetSurface>
  );
}
