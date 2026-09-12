import type { EnvironmentId } from "@modesto/contracts";
import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { useProjectFileQuery } from "~/components/files/projectFilesQueryState";
import { cn } from "~/lib/utils";

function isRemoteImageSrc(src: string): boolean {
  return /^(?:https?:|data:|blob:)/i.test(src);
}

function dirnameOf(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "" : normalized.slice(0, index);
}

function joinRelative(baseDir: string, relative: string): string {
  const parts = [...(baseDir ? baseDir.split("/") : []), ...relative.split("/")];
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

export function resolveSlideImagePath(
  src: string,
  deckSourcePath: string | null | undefined,
): string | null {
  const trimmed = src.trim();
  if (!trimmed || isRemoteImageSrc(trimmed)) return null;
  const cleaned = trimmed.replace(/^\.\//, "");
  if (cleaned.startsWith("/") || cleaned.includes(":")) return null;
  if (!deckSourcePath) return cleaned;
  if (cleaned.startsWith("slides/")) return cleaned;
  return joinRelative(dirnameOf(deckSourcePath), cleaned);
}

function SlideWorkspaceImage({
  src,
  alt,
  environmentId,
  cwd,
  deckSourcePath,
}: {
  readonly src: string;
  readonly alt?: string | undefined;
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
  readonly deckSourcePath: string | null;
}) {
  const relativePath = useMemo(
    () => resolveSlideImagePath(src, deckSourcePath),
    [deckSourcePath, src],
  );
  const query = useProjectFileQuery(environmentId, cwd, relativePath, relativePath !== null);
  const url = useMemo(() => {
    const contents = query.data?.contents;
    if (!contents || !relativePath) return null;
    if (relativePath.toLowerCase().endsWith(".svg")) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(contents)}`;
    }
    return null;
  }, [query.data?.contents, relativePath]);

  if (!url) {
    return query.isPending ? (
      <span className="mb-5 inline-block size-8 animate-pulse rounded-md bg-muted" aria-hidden />
    ) : null;
  }

  const isLogo = /logo|cursor\.svg/i.test(`${alt ?? ""} ${relativePath ?? ""}`);
  return (
    <img
      src={url}
      alt={alt ?? ""}
      className={cn(
        "mb-5 block w-auto object-contain opacity-90 dark:invert",
        isLogo ? "h-12" : "h-7",
      )}
    />
  );
}

export function SlideMarkdown({
  markdown,
  environmentId,
  cwd,
  deckSourcePath,
}: {
  readonly markdown: string;
  readonly environmentId: EnvironmentId | null | undefined;
  readonly cwd: string | null | undefined;
  readonly deckSourcePath: string | null;
}) {
  const components = useMemo<Components>(
    () => ({
      img: ({ src, alt }) => {
        if (typeof src !== "string" || src.length === 0) return null;
        if (isRemoteImageSrc(src)) {
          const isLogo = /logo|cursor/i.test(`${alt ?? ""} ${src}`);
          return (
            <img
              src={src}
              alt={alt ?? ""}
              className={cn(
                "mb-5 block w-auto object-contain opacity-90 dark:invert",
                isLogo ? "h-12" : "h-7",
              )}
            />
          );
        }
        if (!environmentId || !cwd) return null;
        return (
          <SlideWorkspaceImage
            src={src}
            alt={alt}
            environmentId={environmentId}
            cwd={cwd}
            deckSourcePath={deckSourcePath}
          />
        );
      },
    }),
    [cwd, deckSourcePath, environmentId],
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </ReactMarkdown>
  );
}
