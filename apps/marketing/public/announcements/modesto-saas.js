/* One deterministic GSAP timeline drives playback, scrubbing, and frame capture. */
(() => {
  const DURATION = 30;
  const params = new URLSearchParams(location.search);
  document.body.dataset.ratio = ["16x9", "9x16", "1x1"].includes(params.get("ratio"))
    ? params.get("ratio")
    : "16x9";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const scenes = [...document.querySelectorAll(".scene")];
  let lastReport = -1;
  let wantsPlayback =
    params.get("record") !== "1" && params.get("paused") !== "1" && !reducedMotion.matches;
  const start = Number(params.get("t"));
  let timeline;
  let threeScene;
  let composerDemo;

  function report(force = false) {
    if (!timeline) return;
    const time = timeline.time();
    composerDemo?.render(time);
    threeScene?.draw(time);
    const bucket = Math.floor(time * 10);
    if (!force && bucket === lastReport) return;
    lastReport = bucket;
    const scene = time < 5.5 ? 0 : time < 10.3 ? 1 : time < 24.05 ? 2 : 3;
    scenes.forEach((element, index) => {
      element.setAttribute("aria-hidden", String(index !== scene));
    });
    document.documentElement.dataset.scene = String(scene);
    if (window.parent !== window)
      window.parent.postMessage(
        { type: "modesto:state", time, duration: DURATION, playing: wantsPlayback, scene },
        location.origin,
      );
  }
  function syncPlayback() {
    timeline.paused(!wantsPlayback || document.hidden);
    report(true);
  }
  function setTime(value) {
    if (!Number.isFinite(value)) return;
    wantsPlayback = false;
    timeline.pause().time(Math.max(0, Math.min(DURATION - 0.001, value)), false);
    report(true);
  }
  function makeTimeline() {
    const tl = gsap.timeline({
      paused: true,
      repeat: -1,
      defaults: { ease: "power3.out" },
      onUpdate: () => report(),
    });
    tl.set(".intro", { autoAlpha: 1 }, 0)
      .fromTo(
        ".intro-line",
        { yPercent: 115 },
        { yPercent: 0, duration: 1.15, stagger: 0.14 },
        0.12,
      )
      .fromTo(
        ".intro-in",
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.16 },
        0.4,
      )
      .fromTo(
        ".agent-tile",
        { opacity: 0, y: 100, rotateY: -30, scale: 0.75 },
        { opacity: 1, y: 0, rotateY: 0, scale: 1, duration: 1.35, stagger: 0.18 },
        0.25,
      )
      .fromTo(".orbit-ring, .sculpture-caption", { opacity: 0 }, { opacity: 1, duration: 1.4 }, 1)
      .to(".tile-codex", { y: -10, rotation: -9, duration: 3.5, ease: "sine.inOut" }, 1.8)
      .to(".tile-claude", { y: 10, rotation: 8, duration: 3.5, ease: "sine.inOut" }, 1.8)
      .to(".tile-cursor", { y: -7, rotation: -4, duration: 3.5, ease: "sine.inOut" }, 1.8)
      .to(".intro", { autoAlpha: 0, yPercent: -5, duration: 0.55, ease: "power2.inOut" }, 5)
      .fromTo(".harness", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 5.45)
      .fromTo(
        ".harness-in",
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, stagger: 0.12 },
        5.5,
      )
      .fromTo(
        ".network-node",
        { opacity: 0, scale: 0.55 },
        { opacity: 1, scale: 1, duration: 0.7, stagger: 0.055, ease: "back.out(1.5)" },
        6,
      )
      .fromTo(".harness-bottom", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, 7)
      .to(".harness", { autoAlpha: 0, scale: 1.04, duration: 0.55 }, 9.85)
      .fromTo(
        ".product",
        { autoAlpha: 1, yPercent: 100 },
        { yPercent: 0, duration: 0.8, ease: "power4.inOut" },
        9.95,
      )
      .to(".brand", { color: "#efeff1", duration: 0.3 }, 10.3)
      .to(".brand img", { filter: "brightness(1)", duration: 0.3 }, 10.3)
      .fromTo(
        ".product-in",
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 },
        10.4,
      )
      .fromTo(
        ".chat-demo",
        {
          yPercent: 32,
          scale: 0.8,
          opacity: 0,
          rotationX: 32,
          rotationY: -16,
          rotationZ: -7,
          transformPerspective: 1100,
        },
        {
          yPercent: 0,
          scale: 1,
          opacity: 1,
          rotationX: 14,
          rotationY: -8,
          rotationZ: -3,
          duration: 1.15,
          ease: "power3.out",
        },
        10.6,
      )
      .fromTo(
        ".chat-picker",
        { autoAlpha: 0, y: 30, z: 0, scale: 0.86, rotationX: -24, transformPerspective: 900 },
        { autoAlpha: 1, y: 0, z: 65, scale: 1, rotationX: -6, duration: 0.55 },
        11.8,
      )
      .to(".chat-picker", { autoAlpha: 0, y: 8, z: 20, duration: 0.25 }, 13.6)
      .to(
        ".chat-demo",
        {
          rotationX: 4,
          rotationY: 3,
          rotationZ: 1,
          scale: 1.035,
          duration: 3.8,
          ease: "power2.inOut",
        },
        13.7,
      )
      .to(
        ".chat-demo",
        { yPercent: 130, scale: 0.82, autoAlpha: 0, duration: 1, ease: "power3.inOut" },
        18.35,
      )
      .to(".product-heading", { yPercent: -20, autoAlpha: 0, duration: 0.8 }, 18.4)
      .fromTo(
        ".generated-result",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.85 },
        18.65,
      )
      .fromTo(
        ".work-line",
        { yPercent: 55, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.85, stagger: 0.14 },
        20,
      )
      .fromTo(".work-detail", { opacity: 0 }, { opacity: 1, duration: 0.7 }, 20.65)
      .fromTo(".work-finish", { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, 21.2)
      .to(".product", { autoAlpha: 0, duration: 0.35 }, 24.1)
      .fromTo(".outro", { autoAlpha: 0, yPercent: 0 }, { autoAlpha: 1, duration: 0.01 }, 24.05)
      .to(".brand", { opacity: 0, duration: 0.08 }, 24)
      .fromTo(
        ".outro-line",
        { xPercent: -4, yPercent: 0, opacity: 0 },
        { xPercent: 0, opacity: 1, duration: 0.22, stagger: 0.04, ease: "steps(3)" },
        24.07,
      )
      .fromTo(
        ".outro-in",
        { opacity: 0, y: 0 },
        { opacity: 1, duration: 0.25, stagger: 0.04 },
        24.3,
      )
      .fromTo(
        ".glitch-band",
        { xPercent: -110, opacity: 0 },
        { xPercent: 0, opacity: 0.85, duration: 0.05, stagger: 0.012, ease: "steps(1)" },
        23.96,
      )
      .to(".glitch-band", { xPercent: 14, duration: 0.04, stagger: 0.009, ease: "steps(1)" }, 24.08)
      .to(
        ".glitch-band",
        { xPercent: -8, opacity: 0.55, duration: 0.04, stagger: 0.008, ease: "steps(1)" },
        24.19,
      )
      .to(
        ".glitch-band",
        { xPercent: 110, opacity: 0, duration: 0.06, stagger: 0.01, ease: "steps(1)" },
        24.29,
      )
      .fromTo(
        ".outro h2",
        { textShadow: "-5px 0 #728db5, 5px 0 #7e8450" },
        { textShadow: "0px 0 transparent, 0px 0 transparent", duration: 0.32, ease: "steps(4)" },
        24.07,
      )
      .fromTo(
        ".outro-lines",
        { rotation: -25, scale: 1.08 },
        { rotation: -15, scale: 1, duration: 5.6, ease: "none" },
        24.4,
      )
      .fromTo(".film-progress", { scaleX: 0 }, { scaleX: 1, duration: DURATION, ease: "none" }, 0)
      .to(".ambient", { scale: 1.06, duration: DURATION, ease: "none" }, 0);
    return tl;
  }

  window.__ready = Promise.all([
    document.fonts.ready,
    ...[...document.images].map((img) => img.decode().catch(() => undefined)),
    import("./modesto-saas-3d.js")
      .then((module) => module.create3D())
      .catch((error) => {
        console.warn("3D artwork unavailable; using CSS artwork.", error);
        return null;
      }),
    import("./modesto-saas-demo.js").then((module) => module.createComposerDemo()),
  ]).then((results) => {
    threeScene = results.at(-2);
    composerDemo = results.at(-1);
    if (!window.gsap) {
      document.body.dataset.animationError = "true";
      return false;
    }
    timeline = makeTimeline();
    // Seeking is also the capture API used by the previous version of this ad.
    window.__setTime = setTime;
    timeline.time(
      Number.isFinite(start) && params.has("t")
        ? Math.max(0, Math.min(29.999, start))
        : wantsPlayback
          ? 0
          : 2,
    );
    syncPlayback();
    window.addEventListener("message", (event) => {
      if (
        event.origin !== location.origin ||
        event.source !== window.parent ||
        event.data?.type !== "modesto:control"
      )
        return;
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
    if (window.parent !== window)
      window.parent.postMessage({ type: "modesto:ready" }, location.origin);
    return true;
  });
})();
