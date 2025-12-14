# Foundation 7 RFC (WIP)

Foundation 7 is a **breaking** redesign of the Foundation for Sites framework that targets modern JavaScript, modern CSS, and an evergreen browser baseline.

This document is an initial implementation-oriented RFC to guide the development of Foundation 7 core and its first components.

## Goals

- **DOM-first runtime**: no required jQuery dependency; no jQuery event system; no `$.fn.foundation` as the primary API.
- **ESM-first distribution**: modern `exports` map, explicit entry points, and side-effect free imports by default.
- **Evergreen baseline**: no bundled IE-era polyfills; platform APIs are used directly (Pointer Events, CustomEvent, etc.).
- **Modern CSS**: design tokens via CSS custom properties, cascade layers, logical properties for RTL, and component-level responsiveness (container queries where it fits).
- **Accessibility by default**: keyboard interactions, focus management, reduced motion, and ARIA patterns baked into components.

## Non-goals (initially)

- Preserving Foundation 6 APIs, data attributes, or jQuery extension points.
- Supporting legacy browsers that require `matchMedia`/MutationObserver polyfills.
- Maintaining multi-ecosystem packaging formats (Bower, Composer, Meteor, NuGet).

## Proposed repository layout

- `core/`
  - Framework runtime: plugin mounting, lifecycle, event helpers, teardown guarantees.
- `css/` (future)
  - Token + base + utilities + component CSS, shipped as modern CSS entry points.
- `<component>/` (future)
  - Per-component packages (Reveal, Dropdown, Tabs, etc.) exporting JS + optional CSS.

## Core runtime API (first milestone)

Foundation 7 core is intentionally small and explicit:

- Plugins are **objects** describing how to mount onto DOM elements.
- `createFoundation()` returns an app instance you control:
  - `init(root)` scans a root subtree and mounts plugins.
  - `destroy(root?)` tears down mounted instances (all, or within a subtree).
  - `use(plugin)` registers additional plugins.

See `core/src/` for the initial implementation scaffold.

### First ported component (draft)

- Reveal (modal/dialog) lives in `core/src/plugins/reveal.ts` as the first end-to-end component port. Once the component API stabilizes, it should move to its own package (e.g. `reveal/`).

## Breaking changes (high level)

- No global `window.Foundation`.
- No automatic plugin registration by import side effects.
- No jQuery dependency in core.
- No “data-options” string parsing as a primary configuration mechanism; prefer structured attributes or JSON.
- No separate RTL builds; RTL should be handled via logical properties and direction selectors.

## Build and packaging direction

Foundation 7 packages will:

- be authored in TypeScript (or typed JS) and ship accurate `.d.ts`
- publish ESM entrypoints via a package `exports` map
- prefer a single build pipeline per package (no Gulp/Webpack/Rollup split)

The first package (`core`) uses `tsc` to emit `dist/` as a minimal baseline; we can consolidate to a single repo-wide build later.

## Development (current)

- Build core: `yarn f7:core:build` (outputs `core/dist/`, gitignored)

## Next milestones

1. Ship a stable `@foundation/core` API surface (init/destroy/use + plugin contracts).
2. Introduce one rewritten component (likely Reveal) to validate lifecycle/events/a11y.
3. Establish CSS tokens + cascade layers and a minimal base stylesheet.
4. Replace legacy tests with a modern browser/a11y harness (Playwright + axe).
