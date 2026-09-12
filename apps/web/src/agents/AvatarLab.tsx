// FILE: AvatarLab.tsx
// Purpose: The avatar creation studio — a live animated preview and the full
//          customisation surface of the avatar engine: primary solid, attached
//          parts, colours, and per-eye geometry.
// Layer: Agents UI
//
// This is a thin editor over an `AgentAvatarSpec`; it knows nothing about bots
// or persistence, which is why the same component serves "create your first
// agent" in the welcome tour and "edit Scout's face" in the roster.
//
// The engine is Bible Strong Avatar Lab's (AGPL-3.0). The controls here mirror
// its studio inspector: a body built from 3-D solids you can attach more
// solids to, eyes editable per side or linked, and named animations you can
// preview. See THIRD_PARTY_NOTICES.md.

import type {
  AgentAvatarSpec,
  AgentAvatarSurface,
  AgentAvatarSurfaceType,
} from "@modesto/contracts";
import { DicesIcon, LinkIcon, PlusIcon, Trash2Icon, UnlinkIcon } from "lucide-react";
import { useId, useState } from "react";

import { AgentAvatar } from "./AgentAvatar";
import {
  AGENT_AVATAR_NODE_SURFACES,
  AGENT_AVATAR_SURFACES,
  surfaceFromPreset,
  surfaceRoundnessFields,
} from "./avatar/agentAvatarDefinition";
import {
  generateAvatarSpec,
  normalizeAvatarSpec,
  randomAvatarSeed,
  readableEyeColor,
} from "./avatar/agentAvatarRandom";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * Animations offered as a preview strip, in the order a bot moves through
 * them. A subset of the library's 23: these are the six the roster and the
 * presence overlay actually play, and previewing the other seventeen is
 * browsing someone else's library rather than checking your own character.
 */
const PREVIEW_ANIMATIONS: ReadonlyArray<{ readonly id: string; readonly label: string }> = [
  { id: "idle", label: "Idle" },
  { id: "working", label: "Working" },
  { id: "listening", label: "Waiting" },
  { id: "happy", label: "Done" },
  { id: "confused", label: "Failed" },
  { id: "sleeping", label: "Asleep" },
];

const SURFACE_LABELS: Record<AgentAvatarSurfaceType, string> = {
  sphere: "Sphere",
  capsule: "Capsule",
  cube: "Cube",
  cylinder: "Cylinder",
  cone: "Cone",
  diamond: "Diamond",
  mickey: "Ears",
  cursor: "Cursor",
};

const ROUNDNESS_LABELS: Record<string, string> = {
  roundness: "Roundness",
  morphRoundness: "Morph",
  tipRoundness: "Tip",
  baseRoundness: "Base",
};

function LabSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2.5">
      <label htmlFor={id} className="w-[4.75rem] shrink-0 text-[11px] text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-primary"
      />
      <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground/60">
        {Math.round(value)}
      </span>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="w-[4.75rem] shrink-0 text-[11px] text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="color"
        value={
          value.length === 4
            ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
            : value
        }
        onChange={(event) => onChange(event.currentTarget.value)}
        className="size-7 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
      />
      <span className="font-mono text-[10px] uppercase text-muted-foreground/60">{value}</span>
    </div>
  );
}

function SurfacePicker({
  types,
  value,
  onChange,
}: {
  readonly types: ReadonlyArray<AgentAvatarSurfaceType>;
  readonly value: AgentAvatarSurfaceType;
  readonly onChange: (type: AgentAvatarSurfaceType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          aria-pressed={value === type}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
            value === type
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {SURFACE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}

/** Dimension + roundness controls for one solid, primary or attached. */
function SurfaceControls({
  surface,
  onChange,
}: {
  readonly surface: AgentAvatarSurface;
  readonly onChange: (next: AgentAvatarSurface) => void;
}) {
  return (
    <>
      <LabSlider
        label="Width"
        value={surface.width}
        min={10}
        max={420}
        onChange={(width) => onChange({ ...surface, width })}
      />
      <LabSlider
        label="Height"
        value={surface.height}
        min={10}
        max={420}
        onChange={(height) => onChange({ ...surface, height })}
      />
      <LabSlider
        label="Depth"
        value={surface.depth}
        min={10}
        max={420}
        onChange={(depth) => onChange({ ...surface, depth })}
      />
      {/* Only the roundness terms this solid actually uses — the engine
          rejects a definition carrying the others. */}
      {surfaceRoundnessFields(surface.type).map((field) => (
        <LabSlider
          key={field}
          label={ROUNDNESS_LABELS[field] ?? field}
          value={(surface[field] ?? 0) * 100}
          min={0}
          max={100}
          onChange={(percent) => onChange({ ...surface, [field]: percent / 100 })}
        />
      ))}
    </>
  );
}

export interface AvatarLabProps {
  readonly value: AgentAvatarSpec;
  readonly onChange: (spec: AgentAvatarSpec) => void;
  readonly className?: string;
}

export function AvatarLab({ value, onChange, className }: AvatarLabProps) {
  const [animation, setAnimation] = useState("idle");
  const [tab, setTab] = useState<"body" | "parts" | "eyes">("body");
  // Linked by default: the overwhelmingly common want is a symmetric face, and
  // editing two eyes to keep them the same is busywork. Unlinking is one click
  // for the deliberate asymmetry the engine supports.
  const [eyesLinked, setEyesLinked] = useState(true);

  const patch = (next: Partial<AgentAvatarSpec>): void => {
    onChange(normalizeAvatarSpec({ ...value, ...next }));
  };

  const reroll = (): void => {
    onChange(generateAvatarSpec(randomAvatarSeed()));
  };

  const patchEye = (
    side: "left" | "right",
    field: "width" | "height" | "x" | "y" | "angle",
    next: number,
  ): void => {
    if (!eyesLinked) {
      patch({ eyes: { ...value.eyes, [side]: { ...value.eyes[side], [field]: next } } });
      return;
    }
    // Mirrored, not copied: x and angle flip sign so a linked nudge moves both
    // eyes outward rather than sliding the whole pair sideways.
    const mirrored = field === "x" || field === "angle" ? -next : next;
    patch({
      eyes: {
        ...value.eyes,
        left: { ...value.eyes.left, [field]: side === "left" ? next : mirrored },
        right: { ...value.eyes.right, [field]: side === "right" ? next : mirrored },
      },
    });
  };

  const addNode = (): void => {
    const surface = surfaceFromPreset("sphere");
    const scaled = {
      ...surface,
      width: surface.width * 0.32,
      height: surface.height * 0.32,
      depth: surface.depth * 0.32,
    };
    patch({
      nodes: [
        ...value.nodes,
        { surface: scaled, position: [0, value.primary.height * 0.45, 0], rotation: [0, 0, 0] },
      ],
    });
  };

  const eye = value.eyes.left;

  return (
    <div className={cn("flex min-w-0 flex-col gap-5 lg:flex-row lg:gap-7", className)}>
      <div className="flex shrink-0 flex-col items-center gap-3 lg:w-52">
        <div className="flex size-44 items-center justify-center rounded-2xl border border-border bg-muted/25">
          <AgentAvatar spec={value} size={148} animation={animation} title="Avatar preview" />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={reroll} className="w-full gap-2">
          <DicesIcon className="size-3.5" aria-hidden />
          Randomise
        </Button>
        <div className="flex w-full flex-wrap justify-center gap-1">
          {PREVIEW_ANIMATIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setAnimation(option.id)}
              aria-pressed={animation === option.id}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                animation === option.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex gap-1 border-b border-border">
          {(
            [
              ["body", "Body"],
              ["parts", `Parts${value.nodes.length > 0 ? ` (${value.nodes.length})` : ""}`],
              ["eyes", "Eyes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={cn(
                "-mb-px border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
                tab === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "body" ? (
          <div className="flex min-w-0 flex-col gap-2.5">
            <SurfacePicker
              types={AGENT_AVATAR_SURFACES}
              value={value.primary.type}
              onChange={(type) => patch({ primary: surfaceFromPreset(type) })}
            />
            <SurfaceControls surface={value.primary} onChange={(primary) => patch({ primary })} />
            <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
              <ColorField
                label="Body"
                value={value.bodyColor}
                onChange={(bodyColor) =>
                  // Eyes follow the body until the user overrides them, so a
                  // dark body does not silently swallow dark eyes.
                  patch({
                    bodyColor,
                    eyeColor:
                      value.eyeColor === readableEyeColor(value.bodyColor)
                        ? readableEyeColor(bodyColor)
                        : value.eyeColor,
                  })
                }
              />
              <ColorField
                label="Eyes"
                value={value.eyeColor}
                onChange={(eyeColor) => patch({ eyeColor })}
              />
            </div>
          </div>
        ) : null}

        {tab === "parts" ? (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] leading-relaxed text-muted-foreground/75">
                Solids welded onto the body — ears, fins, an antenna. This is what makes two bots on
                the same shape read as different creatures.
              </p>
            </div>
            {value.nodes.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground/60">No parts yet.</p>
            ) : null}
            {value.nodes.map((node, index) => (
              <div
                // eslint-disable-next-line eslint-plugin-react/no-array-index-key -- Parts carry no id of their own; the list is only appended to or spliced, and a synthetic id would have to be persisted to stay stable.
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-border bg-muted/15 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-foreground">Part {index + 1}</span>
                  <Button
                    type="button"
                    size="icon-micro"
                    variant="ghost"
                    aria-label={`Remove part ${index + 1}`}
                    onClick={() =>
                      patch({ nodes: value.nodes.filter((_unused, other) => other !== index) })
                    }
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
                <SurfacePicker
                  types={AGENT_AVATAR_NODE_SURFACES}
                  value={node.surface.type}
                  onChange={(type) =>
                    patch({
                      nodes: value.nodes.map((other, position) =>
                        position === index ? { ...other, surface: surfaceFromPreset(type) } : other,
                      ),
                    })
                  }
                />
                <SurfaceControls
                  surface={node.surface}
                  onChange={(surface) =>
                    patch({
                      nodes: value.nodes.map((other, position) =>
                        position === index ? { ...other, surface } : other,
                      ),
                    })
                  }
                />
                {(["X", "Y", "Z"] as const).map((axis, axisIndex) => (
                  <LabSlider
                    key={`position-${axis}`}
                    label={`Move ${axis}`}
                    value={node.position[axisIndex] ?? 0}
                    min={-300}
                    max={300}
                    onChange={(next) =>
                      patch({
                        nodes: value.nodes.map((other, position) => {
                          if (position !== index) return other;
                          const moved: [number, number, number] = [...other.position];
                          moved[axisIndex] = next;
                          return { ...other, position: moved };
                        }),
                      })
                    }
                  />
                ))}
                {(["X", "Y", "Z"] as const).map((axis, axisIndex) => (
                  <LabSlider
                    key={`rotation-${axis}`}
                    label={`Turn ${axis}`}
                    value={node.rotation[axisIndex] ?? 0}
                    min={-180}
                    max={180}
                    onChange={(next) =>
                      patch({
                        nodes: value.nodes.map((other, position) => {
                          if (position !== index) return other;
                          const turned: [number, number, number] = [...other.rotation];
                          turned[axisIndex] = next;
                          return { ...other, rotation: turned };
                        }),
                      })
                    }
                  />
                ))}
              </div>
            ))}
            {value.nodes.length < 16 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={addNode}
              >
                <PlusIcon className="size-3.5" aria-hidden />
                Add part
              </Button>
            ) : null}
          </div>
        ) : null}

        {tab === "eyes" ? (
          <div className="flex min-w-0 flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setEyesLinked((linked) => !linked)}
              className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {eyesLinked ? (
                <LinkIcon className="size-3.5" aria-hidden />
              ) : (
                <UnlinkIcon className="size-3.5" aria-hidden />
              )}
              {eyesLinked ? "Eyes linked" : "Eyes independent"}
            </button>
            <LabSlider
              label="Width"
              value={eye.width}
              min={4}
              max={120}
              onChange={(next) => patchEye("left", "width", next)}
            />
            <LabSlider
              label="Height"
              value={eye.height}
              min={4}
              max={160}
              onChange={(next) => patchEye("left", "height", next)}
            />
            <LabSlider
              label="Spacing"
              value={value.eyes.spacing}
              min={0}
              max={160}
              onChange={(spacing) => patch({ eyes: { ...value.eyes, spacing } })}
            />
            <LabSlider
              label="Offset X"
              value={eye.x}
              min={-80}
              max={80}
              onChange={(next) => patchEye("left", "x", next)}
            />
            <LabSlider
              label="Offset Y"
              value={eye.y}
              min={-80}
              max={80}
              onChange={(next) => patchEye("left", "y", next)}
            />
            <LabSlider
              label="Angle"
              value={eye.angle}
              min={-60}
              max={60}
              onChange={(next) => patchEye("left", "angle", next)}
            />
            {!eyesLinked ? (
              <div className="mt-2 flex flex-col gap-2.5 border-t border-border pt-3">
                <p className="text-[11px] font-medium text-muted-foreground">Right eye</p>
                <LabSlider
                  label="Width"
                  value={value.eyes.right.width}
                  min={4}
                  max={120}
                  onChange={(next) => patchEye("right", "width", next)}
                />
                <LabSlider
                  label="Height"
                  value={value.eyes.right.height}
                  min={4}
                  max={160}
                  onChange={(next) => patchEye("right", "height", next)}
                />
                <LabSlider
                  label="Offset X"
                  value={value.eyes.right.x}
                  min={-80}
                  max={80}
                  onChange={(next) => patchEye("right", "x", next)}
                />
                <LabSlider
                  label="Offset Y"
                  value={value.eyes.right.y}
                  min={-80}
                  max={80}
                  onChange={(next) => patchEye("right", "y", next)}
                />
                <LabSlider
                  label="Angle"
                  value={value.eyes.right.angle}
                  min={-60}
                  max={60}
                  onChange={(next) => patchEye("right", "angle", next)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
