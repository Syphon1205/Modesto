import { CloudIcon, FolderIcon, FolderPlusIcon, Globe2Icon, LaptopIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";

export type CreateProjectType = "cloud" | "local" | "remote";

interface CreateProjectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onContinue: (type: CreateProjectType) => void;
  readonly onPickLocalFolder: () => Promise<string | null>;
  readonly onCreateLocal: (input: { readonly path: string; readonly title: string }) => void;
  readonly remoteAvailable: boolean;
}

const PROJECT_TYPES: ReadonlyArray<{
  readonly type: CreateProjectType;
  readonly title: string;
  readonly description: string;
  readonly icon: ReactNode;
}> = [
  {
    type: "cloud",
    title: "Cloud",
    description: "Choose a repository for a cloud workspace",
    icon: <CloudIcon />,
  },
  {
    type: "local",
    title: "Local",
    description: "Edit, run, and test files on your computer",
    icon: <LaptopIcon />,
  },
  {
    type: "remote",
    title: "Remote",
    description: "Choose a folder on a connected agent",
    icon: <Globe2Icon />,
  },
];

export function CreateProjectDialog({
  open,
  onOpenChange,
  onContinue,
  onPickLocalFolder,
  onCreateLocal,
  remoteAvailable,
}: CreateProjectDialogProps) {
  const [step, setStep] = useState<"type" | "local">("type");
  const [selectedType, setSelectedType] = useState<CreateProjectType>("cloud");
  const [projectName, setProjectName] = useState("");
  const [sourceFolder, setSourceFolder] = useState<string | null>(null);
  const [isPickingFolder, setIsPickingFolder] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("type");
    setSelectedType("cloud");
    setProjectName("");
    setSourceFolder(null);
    setIsPickingFolder(false);
  }, [open]);

  const pickFolder = async () => {
    if (isPickingFolder) return;
    setIsPickingFolder(true);
    const path = await onPickLocalFolder();
    setIsPickingFolder(false);
    if (!path) return;
    setSourceFolder(path);
    if (projectName.trim().length === 0) {
      setProjectName(
        path
          .replace(/[\\/]+$/, "")
          .split(/[\\/]/)
          .at(-1) ?? "",
      );
    }
  };

  const continueFromType = () => {
    if (selectedType === "local") {
      setStep("local");
      return;
    }
    onContinue(selectedType);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-3xl overflow-hidden">
        <DialogHeader className="px-7 pt-7 pb-4 sm:px-8 sm:pt-8">
          <DialogTitle className="text-2xl sm:text-3xl">Create project</DialogTitle>
          <DialogDescription className="sr-only">
            Choose where the project should run.
          </DialogDescription>
        </DialogHeader>
        {step === "type" ? (
          <>
            <DialogPanel className="px-7 pt-3 pb-5 sm:px-8">
              <fieldset>
                <legend className="mb-4 text-sm font-medium text-foreground">Project type</legend>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
                  {PROJECT_TYPES.map((option) => {
                    const selected = selectedType === option.type;
                    const disabled = option.type === "remote" && !remoteAvailable;
                    return (
                      <button
                        key={option.type}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={disabled}
                        onClick={() => setSelectedType(option.type)}
                        className={cn(
                          "group relative flex min-h-36 flex-col rounded-2xl border p-5 text-left outline-none transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
                          selected
                            ? "border-primary/55 bg-primary/8"
                            : "border-border bg-card/35 hover:border-foreground/25 hover:bg-card/65",
                          disabled && "cursor-not-allowed opacity-45",
                        )}
                      >
                        <span
                          className={cn(
                            "mb-8 flex size-5 items-center justify-center text-muted-foreground [&>svg]:size-5",
                            selected && "text-primary",
                          )}
                        >
                          {option.icon}
                        </span>
                        <span className="text-base font-medium text-foreground">
                          {option.title}
                        </span>
                        <span className="mt-1 text-sm leading-snug text-muted-foreground">
                          {disabled ? "No remote agents are connected" : option.description}
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            "absolute right-5 top-5 size-5 rounded-full border-2 border-muted-foreground/65 transition-colors",
                            selected &&
                              "border-[6px] border-primary bg-primary-foreground shadow-[0_0_0_1px_var(--color-primary)]",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </DialogPanel>
            <DialogFooter variant="bare" className="px-7 pb-7 sm:px-8 sm:pb-8">
              <Button onClick={continueFromType}>Next</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogPanel className="space-y-5 px-7 pt-3 pb-5 sm:px-8">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">Project name</span>
                <span className="flex h-12 items-center rounded-xl border border-input bg-background/55 focus-within:ring-2 focus-within:ring-ring">
                  <span className="flex h-full w-12 shrink-0 items-center justify-center border-r border-border text-muted-foreground">
                    <FolderIcon className="size-5" />
                  </span>
                  <Input
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Project name"
                    className="h-full border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                </span>
              </label>
              <div className="space-y-2">
                <span className="text-sm font-medium text-foreground">Source folder</span>
                <button
                  type="button"
                  onClick={() => void pickFolder()}
                  disabled={isPickingFolder}
                  className="flex min-h-36 w-full flex-col items-center justify-center rounded-2xl border border-border bg-card/35 px-6 text-center outline-none transition-colors hover:border-foreground/25 hover:bg-card/65 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <FolderPlusIcon className="mb-3 size-6 text-muted-foreground" />
                  {sourceFolder ? (
                    <>
                      <span className="max-w-full truncate text-sm font-medium text-foreground">
                        {sourceFolder
                          .replace(/[\\/]+$/, "")
                          .split(/[\\/]/)
                          .at(-1)}
                      </span>
                      <span className="mt-1 max-w-full truncate text-xs text-muted-foreground">
                        {sourceFolder}
                      </span>
                      <span className="mt-3 text-xs font-medium text-primary">
                        Choose another folder
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-foreground">
                        {isPickingFolder
                          ? "Opening Finder…"
                          : "Add a folder Modesto can read and edit"}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">Choose in Finder</span>
                    </>
                  )}
                </button>
              </div>
            </DialogPanel>
            <DialogFooter variant="bare" className="px-7 pb-7 sm:px-8 sm:pb-8">
              <Button variant="ghost" onClick={() => setStep("type")}>
                Back
              </Button>
              <Button
                disabled={!sourceFolder || projectName.trim().length === 0}
                onClick={() => {
                  if (!sourceFolder) return;
                  onCreateLocal({ path: sourceFolder, title: projectName.trim() });
                }}
              >
                Create project
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogPopup>
    </Dialog>
  );
}
