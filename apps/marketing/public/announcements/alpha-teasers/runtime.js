/* Shared teaser clock. Same capture / embed protocol as the brand film. */
(() => {
  const RATIOS = new Set(["16x9", "9x16", "1x1"]);

  function resolveTheme(params) {
    const requested = params.get("theme");
    if (requested === "light" || requested === "paper") return "light";
    if (requested === "dark") return "dark";
    if (document.body.dataset.theme === "paper" || document.body.dataset.theme === "light") {
      return "light";
    }
    return "dark";
  }

  function waitForAssets() {
    const images = [...document.images].map((img) => img.decode().catch(() => undefined));
    return Promise.all([document.fonts.ready, ...images]);
  }

  window.ModestoTeaser = {
    boot({ duration, build, sceneAt, onFrame }) {
      const params = new URLSearchParams(location.search);
      const ratio = RATIOS.has(params.get("ratio")) ? params.get("ratio") : "16x9";
      document.body.dataset.ratio = ratio;
      document.body.dataset.theme = resolveTheme(params);

      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
      const scenes = [...document.querySelectorAll(".scene")];
      const progress = document.querySelector(".film-progress");
      let lastReport = -1;
      let wantsPlayback =
        params.get("record") !== "1" && params.get("paused") !== "1" && !reducedMotion.matches;
      const start = Number(params.get("t"));
      let timeline;

      function currentScene(time) {
        if (typeof sceneAt === "function") return sceneAt(time);
        if (!scenes.length) return 0;
        const span = duration / scenes.length;
        return Math.min(scenes.length - 1, Math.floor(time / span));
      }

      function report(force = false) {
        if (!timeline) return;
        const time = timeline.time();
        // WebGL export films draw on every tick; the DOM reporting below is
        // deliberately throttled and would otherwise cap them at 10fps.
        if (typeof onFrame === "function") onFrame(time);
        const bucket = Math.floor(time * 10);
        if (!force && bucket === lastReport) return;
        lastReport = bucket;
        const scene = currentScene(time);
        scenes.forEach((element, index) => {
          element.setAttribute("aria-hidden", String(index !== scene));
        });
        document.documentElement.dataset.scene = String(scene);
        if (progress) progress.style.setProperty("--progress", String(time / duration));
        if (window.parent !== window) {
          window.parent.postMessage(
            { type: "modesto:state", time, duration, playing: wantsPlayback, scene },
            location.origin,
          );
        }
      }

      function syncPlayback() {
        timeline.paused(!wantsPlayback || document.hidden);
        report(true);
      }

      function setTime(value) {
        if (!Number.isFinite(value)) return;
        wantsPlayback = false;
        timeline.pause().time(Math.max(0, Math.min(duration - 0.001, value)), false);
        report(true);
      }

      window.__ready = waitForAssets().then(() => {
        if (!window.gsap) {
          document.body.dataset.animationError = "true";
          return false;
        }
        timeline = window.gsap.timeline({
          paused: true,
          repeat: -1,
          defaults: { ease: "power3.out" },
          onUpdate: () => report(),
        });
        build(timeline, window.gsap);
        // Linear clock so onFrame (flicker grids, live timers) keeps ticking
        // for the full duration even when a film has no other tweens.
        timeline.to({ t: 0 }, { t: duration, duration, ease: "none" }, 0);
        window.__setTime = setTime;
        const initial =
          Number.isFinite(start) && params.has("t")
            ? Math.max(0, Math.min(duration - 0.001, start))
            : wantsPlayback
              ? 0
              : Math.min(2, duration * 0.18);
        timeline.time(initial);
        syncPlayback();

        window.addEventListener("message", (event) => {
          if (
            event.origin !== location.origin ||
            event.source !== window.parent ||
            event.data?.type !== "modesto:control"
          ) {
            return;
          }
          const { action, time } = event.data;
          if (action === "seek") setTime(time);
          if (action === "play") {
            wantsPlayback = true;
            syncPlayback();
          }
          if (action === "pause") {
            wantsPlayback = false;
            syncPlayback();
          }
          if (action === "restart") {
            timeline.time(0);
            wantsPlayback = true;
            syncPlayback();
          }
        });
        document.addEventListener("visibilitychange", syncPlayback);
        reducedMotion.addEventListener("change", (event) => {
          if (event.matches) {
            wantsPlayback = false;
            syncPlayback();
          }
        });
        if (window.parent !== window) {
          window.parent.postMessage({ type: "modesto:ready" }, location.origin);
        }
        return true;
      });
    },
  };
})();
