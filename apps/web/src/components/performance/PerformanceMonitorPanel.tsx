import type { ResourceTelemetryAggregate, ResourceTelemetrySourceStatus } from "@modesto/contracts";
import {
  Activity,
  ArrowUpRight,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  RefreshCw,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  useResourceTelemetry,
  useResourceTelemetryHistory,
} from "../../lib/resourceTelemetryState";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

function formatBytes(value: number): string {
  if (value < 1_024) return `${Math.round(value)} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let amount = value;
  let unit = -1;
  do {
    amount /= 1_024;
    unit += 1;
  } while (amount >= 1_024 && unit < units.length - 1);
  return `${amount.toFixed(amount >= 100 ? 0 : amount >= 10 ? 1 : 2)} ${units[unit]}`;
}

function formatRate(value: number): string {
  return `${formatBytes(value)}/s`;
}

function statusLabel(status: ResourceTelemetrySourceStatus | null): string {
  if (status === "healthy") return "Live";
  if (status === "starting") return "Starting";
  if (status === "degraded") return "Limited";
  if (status === "unavailable") return "Unavailable";
  if (status === "stopped") return "Stopped";
  return "Connecting";
}

function StatusDot({ status }: { status: ResourceTelemetrySourceStatus | null }) {
  return (
    <span
      className={cn(
        "size-1.5 rounded-full",
        status === "healthy" && "bg-emerald-500",
        (status === "starting" || status === null) && "animate-pulse bg-amber-500",
        status === "degraded" && "bg-amber-500",
        (status === "unavailable" || status === "stopped") && "bg-muted-foreground/45",
      )}
    />
  );
}

export function PerformanceEnvironmentSummary({ onViewMore }: { onViewMore: () => void }) {
  const telemetry = useResourceTelemetry();
  const aggregate = telemetry.data?.groups.allT3 ?? null;
  const status = telemetry.data?.health.native.status ?? null;

  return (
    <button
      type="button"
      onClick={onViewMore}
      className="mt-1 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground/90 transition-colors hover:bg-accent/70"
      aria-label="Open floating performance monitor"
    >
      <Gauge className="size-[15px] shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">Performance</span>
      <span className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
        <StatusDot status={status} />
        {aggregate
          ? `${aggregate.currentCpuPercent.toFixed(1)}% · ${formatBytes(aggregate.currentRssBytes)}`
          : telemetry.error
            ? "Unavailable"
            : "Connecting"}
      </span>
      <ArrowUpRight className="size-3 text-muted-foreground" />
    </button>
  );
}

interface PerformanceFloatDrag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly panelX: number;
  readonly panelY: number;
}

export function FloatingPerformanceMonitor({
  onClose,
  onDock,
}: {
  onClose: () => void;
  onDock: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<PerformanceFloatDrag | null>(null);
  const [position, setPosition] = useState(() => ({
    x: typeof window === "undefined" ? 16 : Math.max(16, window.innerWidth - 456),
    y: 72,
  }));

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panelX: position.x,
      panelY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panel) return;
    setPosition({
      x: Math.max(
        8,
        Math.min(
          window.innerWidth - panel.offsetWidth - 8,
          drag.panelX + event.clientX - drag.startX,
        ),
      ),
      y: Math.max(8, Math.min(window.innerHeight - 80, drag.panelY + event.clientY - drag.startY)),
    });
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={panelRef}
      className="fixed z-[65] flex h-[min(620px,calc(100dvh-96px))] w-[min(430px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-border/75 bg-background/96 shadow-2xl backdrop-blur-xl"
      style={{ left: position.x, top: position.y }}
      role="dialog"
      aria-label="Floating performance monitor"
    >
      <div
        className="flex h-10 shrink-0 cursor-grab items-center gap-2 border-b border-border/60 px-3 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <Gauge className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-[12px] font-medium">Performance</span>
        <Button
          size="xs"
          variant="ghost"
          className="gap-1.5"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onDock}
        >
          <ArrowUpRight className="size-3" /> Dock right
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Close floating performance monitor"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <PerformanceMonitorPanel />
    </div>
  );
}

function MetricCard(props: { icon: typeof Cpu; label: string; value: string; detail: string }) {
  const Icon = props.icon;
  return (
    <div className="rounded-xl border border-border/60 bg-card/55 p-3.5">
      <div className="mb-3 flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] font-medium uppercase tracking-[0.1em]">{props.label}</span>
        <Icon className="size-3.5" />
      </div>
      <p className="font-mono text-xl font-medium tracking-tight tabular-nums text-foreground">
        {props.value}
      </p>
      <p className="mt-1 truncate text-[10px] text-muted-foreground">{props.detail}</p>
    </div>
  );
}

function ComponentRow({
  label,
  value,
  total,
}: {
  label: string;
  value: ResourceTelemetryAggregate;
  total: number;
}) {
  const percent = total > 0 ? Math.min(100, (value.currentRssBytes / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[11px]">
        <span className="min-w-0 flex-1 text-foreground/85">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {value.currentCpuPercent.toFixed(1)}%
        </span>
        <span className="w-16 text-right font-mono tabular-nums text-muted-foreground">
          {formatBytes(value.currentRssBytes)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted/70">
        <div
          className="h-full rounded-full bg-foreground/35 transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function PerformanceMonitorPanel() {
  const telemetry = useResourceTelemetry();
  const history = useResourceTelemetryHistory({ windowMs: 15 * 60_000, bucketMs: 30_000 });
  const snapshot = telemetry.data;
  const aggregate = snapshot?.groups.allT3 ?? null;
  const buckets = history.data?.buckets ?? [];
  const maxCpu = Math.max(1, ...buckets.map((bucket) => bucket.maxCpuPercent));
  const processes = useMemo(
    () =>
      [...(snapshot?.processes ?? [])]
        .sort((a, b) => b.cpuPercent - a.cpuPercent || b.residentBytes - a.residentBytes)
        .slice(0, 6),
    [snapshot?.processes],
  );
  const status = snapshot?.health.native.status ?? null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-5">
        <header className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground shadow-sm">
            <Gauge className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight">Performance</h2>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <StatusDot status={status} />
              <span>
                {telemetry.error ?? `${statusLabel(status)} · Modesto workspace activity`}
              </span>
            </div>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={telemetry.refresh}
            disabled={telemetry.isPending}
            aria-label="Refresh performance data"
          >
            <RefreshCw className={cn("size-3.5", telemetry.isPending && "animate-spin")} />
          </Button>
        </header>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricCard
            icon={Cpu}
            label="CPU"
            value={aggregate ? `${aggregate.currentCpuPercent.toFixed(1)}%` : "—"}
            detail="Current usage"
          />
          <MetricCard
            icon={MemoryStick}
            label="Memory"
            value={aggregate ? formatBytes(aggregate.currentRssBytes) : "—"}
            detail={aggregate ? `${formatBytes(aggregate.peakRssBytes)} peak` : "Waiting for data"}
          />
          <MetricCard
            icon={Activity}
            label="Processes"
            value={aggregate ? String(aggregate.processCount) : "—"}
            detail={
              aggregate
                ? `${aggregate.processStarts} started · ${aggregate.processExits} exited`
                : "Waiting for data"
            }
          />
          <MetricCard
            icon={HardDrive}
            label="Disk activity"
            value={
              aggregate
                ? formatRate(aggregate.ioReadBytesPerSecond + aggregate.ioWriteBytesPerSecond)
                : "—"
            }
            detail={
              aggregate
                ? `${formatRate(aggregate.ioReadBytesPerSecond)} read · ${formatRate(aggregate.ioWriteBytesPerSecond)} write`
                : "Waiting for data"
            }
          />
        </div>

        <section className="rounded-xl border border-border/60 bg-card/45 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-medium">CPU activity</h3>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Last 15 minutes</p>
            </div>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              peak {maxCpu.toFixed(1)}%
            </span>
          </div>
          <div className="flex h-24 items-end gap-[3px]" aria-label="CPU history chart">
            {buckets.length > 0 ? (
              buckets.map((bucket, index) => (
                <div key={`${bucket.startedAt}:${index}`} className="group relative min-w-0 flex-1">
                  <div
                    className="w-full rounded-[2px] bg-foreground/20 transition-colors group-hover:bg-foreground/45"
                    style={{ height: `${Math.max(3, (bucket.avgCpuPercent / maxCpu) * 96)}px` }}
                    title={`${bucket.avgCpuPercent.toFixed(1)}% average CPU`}
                  />
                </div>
              ))
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground">
                Collecting history…
              </div>
            )}
          </div>
        </section>

        {snapshot ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-xl border border-border/60 bg-card/45 p-4">
              <h3 className="mb-4 text-[12px] font-medium">By component</h3>
              <div className="space-y-4">
                <ComponentRow
                  label="Server and agents"
                  value={snapshot.groups.backend}
                  total={aggregate?.currentRssBytes ?? 0}
                />
                <ComponentRow
                  label="Desktop"
                  value={snapshot.groups.electron}
                  total={aggregate?.currentRssBytes ?? 0}
                />
                <ComponentRow
                  label="Monitor"
                  value={snapshot.groups.monitor}
                  total={aggregate?.currentRssBytes ?? 0}
                />
              </div>
            </section>
            <section className="overflow-hidden rounded-xl border border-border/60 bg-card/45">
              <h3 className="px-4 pt-4 pb-2 text-[12px] font-medium">Active processes</h3>
              <div className="divide-y divide-border/45">
                {processes.map((process) => (
                  <div
                    key={`${process.identity.pid}:${process.identity.startTimeMs}`}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-[11px] text-foreground/85"
                      title={process.command}
                    >
                      {process.name || "Process"}
                    </span>
                    <span className="w-12 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {process.cpuPercent.toFixed(1)}%
                    </span>
                    <span className="w-16 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {formatBytes(process.residentBytes)}
                    </span>
                  </div>
                ))}
                {processes.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[11px] text-muted-foreground">
                    No process data yet.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
