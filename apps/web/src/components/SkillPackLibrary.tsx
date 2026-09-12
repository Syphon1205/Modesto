import { useAtomValue } from "@effect/atom-react";
import type { SkillPackPreview } from "@modesto/contracts";
import { BookOpenIcon, BoxesIcon, Loader2Icon, TrashIcon, TriangleAlertIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { primaryEnvironmentIdAtom } from "../state/primaryEnvironment";
import { useEnvironmentQuery } from "../state/query";
import {
  skillPackInstall,
  skillPackList,
  skillPackPreview,
  skillPackUninstall,
} from "../state/skillPacks";
import { useAtomCommand } from "../state/use-atom-command";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

export function SkillPackLibrary() {
  const environmentId = useAtomValue(primaryEnvironmentIdAtom);
  const list = useEnvironmentQuery(
    environmentId === null ? null : skillPackList({ environmentId, input: {} }),
  );
  const previewCommand = useAtomCommand(skillPackPreview, { reportFailure: false });
  const installCommand = useAtomCommand(skillPackInstall);
  const uninstallCommand = useAtomCommand(skillPackUninstall);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<SkillPackPreview | null>(null);
  const [pending, setPending] = useState<"preview" | "install" | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = useCallback(async () => {
    if (!environmentId || !url.trim() || pending) return;
    setPending("preview");
    setError(null);
    setPreview(null);
    try {
      const result = await previewCommand({ environmentId, input: { url: url.trim() } });
      if (result._tag === "Success") setPreview(result.value.preview);
      else setError("No portable SKILL.md files were found at this GitHub location.");
    } finally {
      setPending(null);
    }
  }, [environmentId, pending, previewCommand, url]);

  const handleInstall = useCallback(async () => {
    if (!environmentId || !preview || pending) return;
    setPending("install");
    try {
      const result = await installCommand({
        environmentId,
        input: { url: url.trim(), ref: preview.source.revision, providers: ["codex", "claude"] },
      });
      if (result._tag === "Success") {
        setPreview(null);
        setUrl("");
      }
    } finally {
      setPending(null);
    }
  }, [environmentId, installCommand, pending, preview, url]);

  const installed = list.data?.packs ?? [];
  const blockedProviders = preview?.eligibility.filter((entry) => !entry.eligible) ?? [];
  const canInstall = Boolean(preview) && blockedProviders.length === 0;
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div>
          <h2 className="text-sm font-medium text-foreground">Install a portable skill pack</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste any GitHub repository containing SKILL.md files. Modesto pins the revision and
            installs the same skills for Codex and Claude.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handlePreview();
            }}
            placeholder="https://github.com/owner/skills"
            disabled={pending !== null}
            className="min-w-0 sm:max-w-md"
          />
          <Button
            className="self-start"
            onClick={() => void handlePreview()}
            disabled={!url.trim() || pending !== null}
          >
            {pending === "preview" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            Preview
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>{preview.name}</CardTitle>
            <CardDescription>
              {preview.skills.length} skill{preview.skills.length === 1 ? "" : "s"} · revision{" "}
              {preview.source.revision.slice(0, 8)} · Codex + Claude
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {preview.warnings.map((warning) => (
              <div key={warning} className="flex gap-2 text-xs text-warning-foreground">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
            {blockedProviders.map((entry) => (
              <div key={entry.provider} className="flex gap-2 text-xs text-warning-foreground">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {entry.provider === "codex" ? "Codex" : "Claude"} already has an untracked skill
                  named {entry.collisionDirectory?.split(/[\\/]/).at(-1)}. Install will refuse to
                  overwrite it.
                </span>
              </div>
            ))}
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              {preview.skills.map((skill) => (
                <div
                  key={skill.sourcePath}
                  className="min-w-0 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BookOpenIcon className="size-3.5 text-muted-foreground" />
                    {skill.name}
                  </div>
                  {skill.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {skill.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void handleInstall()}
                disabled={!canInstall || pending !== null}
              >
                {pending === "install" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                Install for both providers
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={pending !== null}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Installed skill packs</h2>
        {list.isPending && installed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : installed.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-8 text-center">
            <BoxesIcon className="size-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">No portable skill packs installed yet.</p>
          </div>
        ) : (
          installed.map((pack) => (
            <Card key={pack.packId}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="text-base">{pack.name}</CardTitle>
                  <CardDescription>
                    {pack.skills.length} skill{pack.skills.length === 1 ? "" : "s"} ·{" "}
                    {pack.providers.join(" + ")} · {pack.source.revision.slice(0, 8)}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Remove ${pack.name}`}
                  disabled={pending !== null}
                  onClick={() => {
                    if (!environmentId) return;
                    setPending(pack.packId);
                    void uninstallCommand({
                      environmentId,
                      input: { packId: pack.packId },
                    }).finally(() => setPending(null));
                  }}
                >
                  {pending === pack.packId ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <TrashIcon className="size-3.5" />
                  )}
                </Button>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
