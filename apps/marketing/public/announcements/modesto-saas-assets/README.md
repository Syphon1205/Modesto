# Modesto brand film assets

The live film is `../modesto-saas.html`; the review player is `../modesto-saas-preview.html`.
It is a 30-second, silent motion study with landscape, vertical, and square compositions.
The composer is based on the user-supplied Modesto screenshot. The prompt, model selection,
and coding-work status are an illustrative animation, not a live model call.
Existing MP4 files predate this revision and have not been regenerated.

## Dependencies and attribution

- GSAP 3.13.0: https://www.npmjs.com/package/gsap/v/3.13.0
  Local distribution preserves its copyright header and Standard License reference:
  https://gsap.com/standard-license/
- Three.js 0.180.0, including RoomEnvironment: https://www.npmjs.com/package/three/v/0.180.0
  MIT license is retained in `vendor/Three-LICENSE.txt`.
- Manrope variable font: https://github.com/google/fonts/tree/main/ofl/manrope
  SIL Open Font License is retained in `vendor/Manrope-OFL.txt`.
- Provider marks live in `marks/`: one square, single-colour silhouette per provider,
  extracted from the app's own icon set (`apps/web/src/components/Icons.tsx`) and given a
  normalised viewBox so every logo reads at the same optical size. Vendor trademarks stay
  with their owners. The film paints them through a CSS mask with `currentColor`
  (`.mark[data-mark="…"]`), so a mark takes the contrast of whatever surface it sits on.
- The roster covers every provider Modesto ships: Codex, Claude, Cursor, Gemini, Grok,
  Meta, OpenCode, GitHub Copilot, Factory Droid, Kilo, Kimi, Qwen, Poolside, Devin, Pi, and
  custom ACP agents. Scene 2 rings all of them around the core; the outro repeats the set.
- The Modesto mark reuses the existing announcement asset.
- 3D card geometry, cursor, assembling code brackets, gyroscope, sculptural forms, and canvas textures are generated
  in `../modesto-saas-3d.js`. No external textures or models are requested at playback time.

## Playback and capture

`?ratio=16x9`, `?ratio=9x16`, and `?ratio=1x1` preserve the specified composition.
`&paused=1&t=12.9` opens a still frame. `&record=1` disables automatic playback.
Await `window.__ready`, then use `window.__setTime(seconds)` for deterministic capture.
The single WebGL renderer uses the GSAP timeline clock, pauses in hidden documents, and
caps pixel density. CSS artwork and a simple cursor remain available if WebGL is unavailable.
Reduced-motion viewers start on a still frame and can explicitly play the film.
