import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { SearchIcon, BookOpenIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { primaryEnvironmentIdAtom } from "~/state/primaryEnvironment";
import { useEnvironmentQuery } from "~/state/query";
import { skillPackList } from "~/state/skillPacks";

export function CopilotAutomationSkills() {
  const environmentId = useAtomValue(primaryEnvironmentIdAtom);
  const list = useEnvironmentQuery(
    environmentId === null ? null : skillPackList({ environmentId, input: {} }),
  );
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const skills = (list.data?.packs ?? []).flatMap((pack) =>
    pack.skills.map((skill) => ({ ...skill, packId: pack.packId })),
  );
  const matches = skills.filter((skill) =>
    `${skill.name} ${skill.description ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">Skills</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Turn an existing agent skill into an automation.
          </p>
        </div>
        <div className="relative w-64">
          <SearchIcon className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" />
          <Input
            className="h-7 pl-7 text-xs"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={`Search ${skills.length} skills…`}
            aria-label={`Search ${skills.length} skills`}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((skill) => (
          <button
            key={`${skill.packId}:${skill.sourcePath}`}
            type="button"
            className="rounded-lg border border-border p-3 text-left hover:bg-muted/40"
            onClick={() => void navigate({ to: "/automations/new", search: { skill: skill.name } })}
          >
            <BookOpenIcon className="mb-2 size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{skill.name}</span>
            <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
              {skill.description}
            </span>
          </button>
        ))}
      </div>
      {query && matches.length === 0 ? (
        <p className="text-xs text-muted-foreground">No matching skills.</p>
      ) : null}
    </section>
  );
}
