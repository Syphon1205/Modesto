// FILE: previewProxyAgent.ts
// Purpose: The script injected into a proxied page. It executes automation
//          operations in-page and answers the host over postMessage.
// Layer: Shared (script source)
//
// This is the web build's counterpart to the desktop host's CDP session. The
// desktop drives a page through Chrome DevTools Protocol - trusted input
// events, real screenshots, the accessibility tree. None of that is reachable
// from inside a page, so this agent does the same jobs with the DOM:
//
//   - Locators resolve through Playwright's own injected script, the exact
//     engine the desktop host uses, so `role=button[name='Send']` means the
//     same thing on both hosts. That is the whole reason it is worth injecting
//     a large third-party bundle here.
//   - Input is synthesized. Events dispatched from script carry
//     `isTrusted: false`, and a site that checks will ignore them. Application
//     UIs overwhelmingly do not check; some hardened login flows do.
//   - `snapshot` returns the page's structure and text, never a bitmap. A page
//     cannot rasterize itself, so the field is reported as absent rather than
//     faked - see `screenshot: null` below.
//
// The script is built as a string because it has to run inside the proxied
// document, not in the app bundle.

export const PREVIEW_AGENT_REQUEST_KEY = "__modestoPreviewAgentRequest";
export const PREVIEW_AGENT_RESPONSE_KEY = "__modestoPreviewAgentResponse";
export const PREVIEW_AGENT_READY_KEY = "__modestoPreviewAgentReady";

/**
 * Operations the in-page agent can perform.
 *
 * `open`, `resize` and `setColorScheme` are absent on purpose: they are frame
 * and tab concerns the host owns, not things a document can do to itself.
 */
export const PREVIEW_AGENT_OPERATIONS = [
  "status",
  "snapshot",
  "click",
  "type",
  "press",
  "scroll",
  "evaluate",
  "waitFor",
] as const;

export type PreviewAgentOperation = (typeof PREVIEW_AGENT_OPERATIONS)[number];

/**
 * Build the injectable agent source.
 *
 * `playwrightInstallExpression` comes from `playwrightInjectedRuntime` - the
 * same expression the desktop host evaluates - so both hosts share one selector
 * implementation. When it is omitted the agent still runs and falls back to
 * `querySelector` for plain CSS, which keeps a proxied page automatable even if
 * the bundle could not be extracted.
 */
export function buildPreviewProxyAgentScript(input: {
  readonly playwrightInstallExpression?: string | undefined;
  readonly origin: string;
}): string {
  const install = input.playwrightInstallExpression ?? "false";
  const origin = JSON.stringify(input.origin);

  return `(() => {
"use strict";
if (window.${PREVIEW_AGENT_READY_KEY}) return;
window.${PREVIEW_AGENT_READY_KEY} = true;

var HOST_ORIGIN = ${origin};
var consoleEntries = [];
var MAX_CONSOLE = 200;

for (var level of ["log", "info", "warn", "error", "debug"]) {
  (function (name) {
    var original = console[name];
    console[name] = function () {
      try {
        var text = Array.prototype.map
          .call(arguments, function (part) {
            if (typeof part === "string") return part;
            try { return JSON.stringify(part); } catch (_) { return String(part); }
          })
          .join(" ");
        consoleEntries.push({ level: name, text: text.slice(0, 2000), at: Date.now() });
        if (consoleEntries.length > MAX_CONSOLE) consoleEntries.shift();
      } catch (_) {}
      return original.apply(console, arguments);
    };
  })(level);
}

function injected() {
  try {
    if (!globalThis.__t3PlaywrightInjected) { ${install}; }
  } catch (_) {}
  return globalThis.__t3PlaywrightInjected || null;
}

/** Resolve a locator or CSS selector to one element, preferring Playwright's engine. */
function resolveElement(input) {
  var locator = input && (input.locator || input.selector);
  if (!locator) return null;
  var engine = input.locator ? injected() : null;
  if (engine) {
    var parsed = engine.parseSelector(locator);
    return engine.querySelector(parsed, document, true) || null;
  }
  return document.querySelector(locator);
}

function requireElement(input, operation) {
  var element = resolveElement(input);
  if (!element) {
    throw new Error(
      operation + ": no element matched " + JSON.stringify(input.locator || input.selector),
    );
  }
  return element;
}

function isVisible(element) {
  if (!(element instanceof Element)) return false;
  var rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  var style = window.getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

function accessibleName(element) {
  var label = element.getAttribute("aria-label");
  if (label) return label.trim();
  var labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    var parts = labelledBy.split(/\\s+/).map(function (id) {
      var node = document.getElementById(id);
      return node ? (node.textContent || "").trim() : "";
    });
    var joined = parts.filter(Boolean).join(" ");
    if (joined) return joined;
  }
  if (element instanceof HTMLInputElement && element.labels && element.labels.length > 0) {
    return (element.labels[0].textContent || "").trim();
  }
  var placeholder = element.getAttribute("placeholder");
  if (placeholder) return placeholder.trim();
  return (element.textContent || "").trim().slice(0, 200);
}

var INTERACTIVE =
  "a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=textbox]," +
  "[role=checkbox],[role=radio],[role=tab],[role=menuitem],[contenteditable=true],[onclick]";

/**
 * The page's structure and text.
 *
 * \`screenshot\` is null, always: a document cannot rasterize itself. Reporting
 * null rather than an empty image is what lets a caller tell "no picture is
 * available here" apart from "the picture is blank".
 */
function snapshot() {
  var elements = [];
  var nodes = document.querySelectorAll(INTERACTIVE);
  for (var i = 0; i < nodes.length && elements.length < 400; i++) {
    var node = nodes[i];
    if (!isVisible(node)) continue;
    var rect = node.getBoundingClientRect();
    elements.push({
      tag: node.tagName.toLowerCase(),
      role: node.getAttribute("role") || undefined,
      name: accessibleName(node) || undefined,
      value:
        node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
          ? String(node.value).slice(0, 200)
          : undefined,
      disabled: node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true",
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  }
  return {
    url: document.baseURI,
    title: document.title,
    text: (document.body ? document.body.innerText || "" : "").slice(0, 40000),
    elements: elements,
    consoleEntries: consoleEntries.slice(-50),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scroll: { x: window.scrollX, y: window.scrollY },
    screenshot: null,
    screenshotUnavailableReason:
      "The web host runs inside the page and cannot rasterize it. Use the structure and text in this snapshot, or run Modesto on the desktop for image snapshots.",
  };
}

function centerOf(element) {
  element.scrollIntoView({ block: "center", inline: "center" });
  var rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function mouseEvent(type, point, init) {
  return new MouseEvent(type, Object.assign({
    bubbles: true, cancelable: true, view: window, clientX: point.x, clientY: point.y, button: 0,
  }, init || {}));
}

function click(input) {
  var point;
  var element;
  if (input && typeof input.x === "number" && typeof input.y === "number" && !input.locator && !input.selector) {
    point = { x: input.x, y: input.y };
    element = document.elementFromPoint(point.x, point.y);
    if (!element) throw new Error("click: no element at (" + point.x + ", " + point.y + ")");
  } else {
    element = requireElement(input, "click");
    point = centerOf(element);
  }
  element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y }));
  element.dispatchEvent(mouseEvent("mousedown", point));
  if (element instanceof HTMLElement) element.focus({ preventScroll: true });
  element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y }));
  element.dispatchEvent(mouseEvent("mouseup", point));
  element.dispatchEvent(mouseEvent("click", point, { detail: 1 }));
  return { clicked: true, x: point.x, y: point.y };
}

/**
 * Set a field's value the way a framework will notice.
 *
 * React and friends install their own value setter on the element instance, so
 * assigning \`element.value\` is invisible to them. Calling the prototype's
 * native setter and then firing \`input\` is what makes the change stick.
 */
function setFieldValue(element, value) {
  var prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  var descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor && descriptor.set) descriptor.set.call(element, value);
  else element.value = value;
}

function type(input) {
  var element = requireElement(input, "type");
  if (element instanceof HTMLElement) element.focus({ preventScroll: true });
  var text = String(input.text == null ? "" : input.text);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    var next = input.clear ? text : String(element.value || "") + text;
    setFieldValue(element, next);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { typed: true, value: String(element.value).slice(0, 500) };
  }

  if (element.isContentEditable) {
    if (input.clear) element.textContent = "";
    element.textContent = String(element.textContent || "") + text;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    return { typed: true, value: String(element.textContent).slice(0, 500) };
  }

  throw new Error("type: target is not a text field or contenteditable element");
}

function press(input) {
  var key = String(input.key || "");
  if (!key) throw new Error("press: key is required");
  var modifiers = input.modifiers || [];
  var has = function (name) { return modifiers.indexOf(name) !== -1; };
  var init = {
    key: key,
    code: key.length === 1 ? "Key" + key.toUpperCase() : key,
    bubbles: true,
    cancelable: true,
    altKey: has("Alt"),
    ctrlKey: has("Control"),
    metaKey: has("Meta"),
    shiftKey: has("Shift"),
  };
  var target = resolveElement(input) || document.activeElement || document.body;
  target.dispatchEvent(new KeyboardEvent("keydown", init));
  if (key.length === 1) target.dispatchEvent(new KeyboardEvent("keypress", init));
  target.dispatchEvent(new KeyboardEvent("keyup", init));
  return { pressed: key };
}

function scroll(input) {
  var deltaX = Number(input.deltaX || 0);
  var deltaY = Number(input.deltaY || 0);
  var target = input.locator || input.selector ? requireElement(input, "scroll") : null;
  if (target) {
    target.scrollBy(deltaX, deltaY);
    return { scrolled: true, x: target.scrollLeft, y: target.scrollTop };
  }
  window.scrollBy(deltaX, deltaY);
  return { scrolled: true, x: window.scrollX, y: window.scrollY };
}

async function evaluate(input) {
  var expression = String(input.expression || "");
  // Indirect eval keeps the expression in global scope, matching how the
  // desktop host evaluates through CDP.
  var value = (0, eval)(expression);
  if (input.awaitPromise !== false && value && typeof value.then === "function") {
    value = await value;
  }
  if (input.returnByValue === false) return { type: typeof value };
  try {
    return JSON.parse(JSON.stringify(value === undefined ? null : value));
  } catch (_) {
    return String(value);
  }
}

function waitConditionMet(input) {
  if (input.locator || input.selector) {
    var element = resolveElement(input);
    if (!element || !isVisible(element)) return false;
  }
  if (input.text) {
    var body = document.body ? document.body.innerText || "" : "";
    if (body.indexOf(input.text) === -1) return false;
  }
  if (input.urlIncludes && document.baseURI.indexOf(input.urlIncludes) === -1) return false;
  return true;
}

function waitFor(input) {
  var timeoutMs = Number(input.timeoutMs || 5000);
  var startedAt = Date.now();
  return new Promise(function (resolve, reject) {
    var check = function () {
      var met = false;
      try { met = waitConditionMet(input); } catch (error) { reject(error); return; }
      if (met) { resolve({ matched: true, waitedMs: Date.now() - startedAt }); return; }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("waitFor: condition not met within " + timeoutMs + "ms"));
        return;
      }
      setTimeout(check, 60);
    };
    check();
  });
}

async function run(operation, input) {
  switch (operation) {
    case "status":
      return { url: document.baseURI, title: document.title, readyState: document.readyState };
    case "snapshot": return snapshot();
    case "click": return click(input || {});
    case "type": return type(input || {});
    case "press": return press(input || {});
    case "scroll": return scroll(input || {});
    case "evaluate": return await evaluate(input || {});
    case "waitFor": return await waitFor(input || {});
    default: throw new Error("Unsupported operation: " + operation);
  }
}

window.addEventListener("message", function (event) {
  var data = event.data;
  if (!data || data.kind !== "${PREVIEW_AGENT_REQUEST_KEY}") return;
  // Only the app that framed this document may drive it. Without this check any
  // page that can reach this frame could issue automation commands.
  if (HOST_ORIGIN && event.origin !== HOST_ORIGIN) return;

  Promise.resolve()
    .then(function () { return run(data.operation, data.input); })
    .then(function (value) {
      event.source.postMessage(
        { kind: "${PREVIEW_AGENT_RESPONSE_KEY}", id: data.id, ok: true, value: value },
        event.origin,
      );
    })
    .catch(function (error) {
      event.source.postMessage(
        {
          kind: "${PREVIEW_AGENT_RESPONSE_KEY}",
          id: data.id,
          ok: false,
          error: String((error && error.message) || error),
        },
        event.origin,
      );
    });
});

try {
  parent.postMessage({ kind: "${PREVIEW_AGENT_READY_KEY}", url: document.baseURI }, HOST_ORIGIN || "*");
} catch (_) {}
})();`;
}
