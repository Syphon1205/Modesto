// Shared timing for the composer state and both the WebGL and fallback cursors.
export const FILM_DURATION = 30;
export const PRODUCT_END = 24.05;
export const PROMPT = "Review this branch and fix the rough edges.";
const clamp = (value) => Math.max(0, Math.min(1, value));
export function cursorPose(time, rectFor) {
  const stops = [
    [10.7, ".product", 0.86, 0.78],
    [11.55, "#demo-model-target", 0.7, 0.55],
    [12.25, '[data-option="auto"]', 0.58, 0.5],
    [13.05, "#demo-choice-target", 0.58, 0.5],
    [14.05, ".chat-prompt", 0.22, 0.55],
    [16.85, ".chat-prompt", 0.22, 0.55],
    [17.75, "#demo-send-target", 0.5, 0.5],
    [18.15, "#demo-send-target", 0.5, 0.5],
    [19.05, ".product", 0.95, 0.82],
  ];
  let index = stops.findIndex((stop) => stop[0] > time);
  if (index < 0) index = stops.length - 1;
  const from = stops[Math.max(0, index - 1)],
    to = stops[index];
  const amount = clamp((time - from[0]) / Math.max(0.001, to[0] - from[0]));
  const mix = amount * amount * (3 - 2 * amount);
  const point = (stop) => {
    const rect = rectFor(stop[1]);
    return { x: rect.x + rect.width * stop[2], y: rect.y + rect.height * stop[3] };
  };
  const a = point(from),
    b = point(to);
  const press = [11.7, 13.2, 18].reduce(
    (value, t) => Math.max(value, Math.max(0, 1 - Math.abs(time - t) / 0.16)),
    0,
  );
  return {
    x: a.x + (b.x - a.x) * mix,
    y: a.y + (b.y - a.y) * mix,
    scale: 1 - press * 0.18,
    tilt: ((b.x - a.x) / 500) * Math.sin(mix * Math.PI),
    opacity: clamp((time - 10.9) / 0.35) * (1 - clamp((time - 18.4) / 0.55)),
  };
}
export function createComposerDemo() {
  const prompt = document.getElementById("demo-prompt");
  const placeholder = document.getElementById("demo-placeholder");
  const caret = document.querySelector(".demo-caret");
  const model = document.getElementById("demo-model-label");
  const modelMark = document.querySelector(".chat-model .mark");
  const choice = document.getElementById("demo-choice-target");
  const auto = document.querySelector('[data-option="auto"]');
  const send = document.getElementById("demo-send-target");
  const status = document.getElementById("generation-status");
  const dots = document.querySelector(".generation-dots");
  const fallback = document.querySelector(".demo-cursor-fallback");
  const product = document.querySelector(".product");
  const elements = new Map();
  return {
    render(time) {
      if (time < 10 || time > PRODUCT_END + 0.3) return;
      const selected = time >= 13.2;
      const submitted = time >= 18.12;
      const count = Math.floor(clamp((time - 14.25) / 2.8) * PROMPT.length);
      prompt.textContent = submitted ? "" : PROMPT.slice(0, count);
      placeholder.style.display = !count || submitted ? "" : "none";
      caret.style.opacity = time >= 14 && time < 17.6 && Math.floor(time * 3) % 2 === 0 ? "1" : "0";
      model.textContent = selected ? "Composer 1.5" : "Auto";
      modelMark.dataset.mark = selected ? "cursor" : "modesto";
      auto.classList.toggle("hovered", time >= 12.1 && time < 12.7);
      choice.classList.toggle("hovered", time >= 12.7);
      choice.classList.toggle("selected", selected);
      send.classList.toggle("ready", count > 0 && !submitted);
      send.classList.toggle("sent", submitted);
      send.style.transform = `scale(${1 - Math.max(0, 1 - Math.abs(time - 18) / 0.14) * 0.14})`;
      status.textContent =
        time < 19.7
          ? "Reading your changes"
          : time < 21.2
            ? "Working through the details"
            : "Changes are ready";
      dots.textContent = time < 21.2 ? ".".repeat((Math.floor(time * 3) % 3) + 1) : "✓";
      if (!document.querySelector(".stage").classList.contains("has-three")) {
        const base = product.getBoundingClientRect();
        const pose = cursorPose(time, (selector) => {
          if (!elements.has(selector)) elements.set(selector, document.querySelector(selector));
          const rect = elements.get(selector).getBoundingClientRect();
          return {
            x: rect.left - base.left,
            y: rect.top - base.top,
            width: rect.width,
            height: rect.height,
          };
        });
        fallback.style.visibility = "visible";
        fallback.style.opacity = String(pose.opacity);
        fallback.style.transform = `translate(${pose.x}px,${pose.y}px) scale(${pose.scale})`;
      }
    },
  };
}
