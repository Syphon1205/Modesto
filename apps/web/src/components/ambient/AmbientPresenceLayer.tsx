import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";

import { isElectron } from "~/env";
import { usePrimarySettings } from "~/hooks/useSettings";
import { useProjects, useThreadShells } from "~/state/entities";
import { cn } from "~/lib/utils";
import { AmbientOrb } from "./AmbientOrb.tsx";
import { exceedsDragThreshold } from "./ambientDrag.ts";
import {
  ambientBubbleRoutePath,
  buildAmbientBubbles,
  type AmbientBubble,
  type AmbientBubbleSourceThread,
} from "./ambientBubbles.ts";
import { useAmbientPresenceStore } from "./ambientPresenceStore.ts";
import { useAgentBots } from "~/agents/agentBotStore";
import { threadLinkKey, useAgentThreadLinks } from "~/agents/agentThreadLinks";

/**
 * Floating agent presence for active threads. Mounted from the chat shell when
 * `settings.ambientPresenceEnabled` is on. Desktop prefers an always-on-top
 * overlay via `desktopBridge.ambientPresence`; browsers keep this in-app orb.
 *
 * One orb, not one bubble per thread: with several threads active, a row of
 * chips read as a notification tray, not an ambient presence. The orb's color
 * and motion reflect the single most pressing thing across every active
 * thread (`buildAmbientBubbles` already sorts by priority), with a small
 * badge for "there's more going on" — a status and navigation layer, not a
 * task list nailed to the corner of the screen.
 *
 * Purely visual/status - no voice. It used to gate on `voice.enabled` and the
 * orb showed a speaking waveform for TTS; neither survived - a floating
 * status bubble has nothing to do with speech, and coupling the two made this
 * look like a voice feature it isn't. Live subagent helper:
 * `setAmbientLiveSubagents`.
 */
export function AmbientPresenceLayer() {
  const enabled = usePrimarySettings((settings) => settings.ambientPresenceEnabled);
  if (!enabled) return null;
  return <AmbientPresenceLayerActive />;
}

function AmbientPresenceLayerActive() {
  const navigate = useNavigate();
  const projects = useProjects();
  const threadShells = useThreadShells();
  const liveSubagents = useAmbientPresenceStore((state) => state.liveSubagents);
  const bots = useAgentBots();
  const threadLinks = useAgentThreadLinks();
  const position = useAmbientPresenceStore((state) => state.position);
  const setPosition = useAmbientPresenceStore((state) => state.setPosition);
  const desktopOverlayActiveRef = useRef(false);

  const projectTitleByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(`${project.environmentId}:${project.id}`, project.title);
    }
    return map;
  }, [projects]);

  const avatarByBotId = useMemo(() => new Map(bots.map((bot) => [bot.id, bot.avatar])), [bots]);

  const sourceThreads = useMemo((): ReadonlyArray<AmbientBubbleSourceThread> => {
    const next: AmbientBubbleSourceThread[] = [];
    for (const thread of threadShells) {
      const projectTitle =
        projectTitleByKey.get(`${thread.environmentId}:${thread.projectId}`) ?? "Project";
      // A thread an agent bot started carries that bot's face into the
      // overlay; everything else stays exactly as it was.
      const botId = threadLinks[threadLinkKey(thread.environmentId, thread.id)];
      const avatar = botId ? (avatarByBotId.get(botId) ?? null) : null;
      next.push({
        environmentId: thread.environmentId,
        projectTitle,
        thread,
        ...(avatar ? { avatar } : {}),
      });
    }
    return next;
  }, [projectTitleByKey, threadShells, threadLinks, avatarByBotId]);

  const bubbles = useMemo(
    () =>
      buildAmbientBubbles({
        threads: sourceThreads,
        liveSubagents,
      }),
    [liveSubagents, sourceThreads],
  );

  const selectBubble = (bubble: AmbientBubble) => {
    void navigate({
      to: "/$environmentId/$threadId",
      params: {
        environmentId: bubble.environmentId,
        threadId: bubble.threadId,
      },
    });
  };

  const bubblesRef = useRef(bubbles);
  bubblesRef.current = bubbles;

  // Desktop always-on-top overlay when the bridge exposes it; otherwise in-app.
  useEffect(() => {
    const ambient = window.desktopBridge?.ambientPresence;
    if (!ambient || !isElectron) {
      desktopOverlayActiveRef.current = false;
      return;
    }

    let cancelled = false;
    desktopOverlayActiveRef.current = true;
    void ambient.open().then(() => {
      if (cancelled) return;
      void ambient.setBubbles(bubblesRef.current.map(toDesktopAmbientBubble));
    });

    const onMenuAction = window.desktopBridge?.onMenuAction;
    const unsubscribeMenu =
      typeof onMenuAction === "function"
        ? onMenuAction((action) => {
            if (!action.startsWith("ambient-navigate:")) return;
            const path = action.slice("ambient-navigate:".length);
            const match = /^\/([^/]+)\/([^/]+)\/?$/.exec(path);
            if (!match) return;
            void navigate({
              to: "/$environmentId/$threadId",
              params: {
                environmentId: decodeURIComponent(match[1]!),
                threadId: decodeURIComponent(match[2]!),
              },
            });
          })
        : undefined;

    return () => {
      cancelled = true;
      desktopOverlayActiveRef.current = false;
      unsubscribeMenu?.();
      void ambient.close();
    };
  }, [navigate]);

  useEffect(() => {
    const ambient = window.desktopBridge?.ambientPresence;
    if (!ambient || !desktopOverlayActiveRef.current) return;
    void ambient.setBubbles(bubbles.map(toDesktopAmbientBubble));
  }, [bubbles]);

  // When the native overlay is available, hide the in-app orb to avoid
  // doubling presence. Older desktop builds without the bridge keep in-app.
  const preferNativeOverlay = Boolean(window.desktopBridge?.ambientPresence) && isElectron;

  // Press-and-drag the orb to reposition it; a plain click still opens the
  // list or navigates. `dragRef` tracks one pointer session; `draggedRef`
  // flips once movement passes the threshold and is what the capture-phase
  // click handler checks to veto the click that a mouseup always produces.
  const dragRef = useRef<{ readonly originX: number; readonly originY: number } | null>(null);
  const draggedRef = useRef(false);

  const handleOrbPointerDownCapture = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const start = position ?? { offsetX: 0, offsetY: 0 };
    dragRef.current = { originX: event.clientX, originY: event.clientY };
    draggedRef.current = false;

    const onMove = (moveEvent: PointerEvent) => {
      const origin = dragRef.current;
      if (!origin) return;
      const deltaX = moveEvent.clientX - origin.originX;
      const deltaY = moveEvent.clientY - origin.originY;
      if (!draggedRef.current && exceedsDragThreshold(deltaX, deltaY)) {
        draggedRef.current = true;
      }
      if (draggedRef.current) {
        setPosition({ offsetX: start.offsetX + deltaX, offsetY: start.offsetY + deltaY });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleOrbClickCapture = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (draggedRef.current) {
      // The click that follows every mouseup is not a real click here — the
      // pointer session it belongs to just moved the orb.
      event.preventDefault();
      event.stopPropagation();
      draggedRef.current = false;
    }
  };

  if (preferNativeOverlay) {
    return null;
  }

  if (bubbles.length === 0) {
    return null;
  }

  const offsetStyle =
    position !== null
      ? { transform: `translate(${position.offsetX}px, ${position.offsetY}px)` }
      : undefined;

  return (
    <div
      className={cn("pointer-events-none fixed end-3 top-14 z-60 flex flex-col items-end")}
      style={offsetStyle}
      data-ambient-presence=""
    >
      <div className="pointer-events-auto">
        <AmbientOrb
          bubbles={bubbles}
          onSelect={selectBubble}
          onPointerDownCapture={handleOrbPointerDownCapture}
          onClickCapture={handleOrbClickCapture}
        />
      </div>
    </div>
  );
}

function toDesktopAmbientBubble(bubble: AmbientBubble) {
  return {
    id: bubble.id,
    kind: bubble.kind,
    label: bubble.label,
    title: bubble.title,
    subtitle: bubble.subtitle,
    phase: bubble.phase,
    routePath: ambientBubbleRoutePath(bubble),
    threadId: bubble.threadId,
  };
}
