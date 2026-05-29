# Shiftboard Handoff

## Status: All 12 phases complete

**Last updated**: 2026-05-29

---

## What's working

- **Full application** — index.html opens directly in any modern browser, no server required
- **Employee management** — Add, edit, delete with color picker; search/filter; availability matrix (7×3 grid, cycles Available → Preferred → Unavailable)
- **Schedule grid** — 7-column × 3-row weekly grid, week navigation (prev/next/today), current day highlighted
- **Drag-and-drop** — HTML5 drag (desktop), touch events (mobile), keyboard alternative (Enter pick up → Arrow keys → Enter drop → Escape cancel)
- **Conflict detection** — Double-booking (red), availability violation (amber), understaffed (amber); icons not just colour; `role="alert"` panel announces to screen readers
- **Undo** — Ctrl/Cmd+Z restores pre-drag state (single-level, in-memory)
- **Export** — Clipboard copy as plain text; print stylesheet strips chrome, B&W chips
- **Settings** — Configurable minimum headcount per shift, persists to IndexedDB
- **Pre-commit tooling** — ESLint v9, Stylelint, Prettier, html-validate all passing; Husky wired

## What's not working / known limitations

- **Single-level undo only** — Only the most recent drag can be undone; snapshot is cleared on page reload
- **No offline asset caching** — There is no service worker; idb-keyval loads from CDN. If CDN is unavailable, the app will not function
- **Safari < 15.4** — The native `<dialog>` element requires Safari 15.4+; earlier versions need [dialog-polyfill](https://github.com/GoogleChrome/dialog-polyfill)
- **`Cache-Control: immutable`** — JS/CSS assets in Netlify config are set to immutable. Future file updates without renaming will not be served to users with cached copies. Either rename files on update or remove `immutable` from `netlify.toml` before deploying changes
- **No Lighthouse run yet** — Deployment to Netlify required for full Lighthouse CLI audit; scores should be verified post-deploy
- **Touch drag on mobile** — Functional but the 768px breakpoint hides the full grid on narrow screens; touch drag is tested but read-only mode is shown below 768px

## Next task (if continuing)

Deploy to Netlify and run Lighthouse CLI:
```
npx lighthouse https://your-site.netlify.app --output html --output-path ./lighthouse-report.html
```
Target: Performance >90, Accessibility >95, Best Practices >95.

---

## Decisions made this session

- **Inter** over system-ui — rationale documented in CLAUDE.md
- **`--text-muted` corrected** to `#596070` — `#64748B` fails 4.5:1 on `#F1F5F9` (sidebar surface)
- **idb-keyval UMD build** (not ES module) — avoids `import` requirement; exposes `window.idbKeyval`
- **Document-per-week model** for shifts store — makes undo trivial (deep clone before mutation)
- **`sourceType: 'script'`** in ESLint — no `import`/`export`; inter-module via `window` namespaces
- **Heroicons inlined** as `<template>` elements — avoids CDN CORS issues for `cloneNode` SVG use
- **`<section>` for schedule grid and drop zone** — html-validate requires native elements over `role="region"`
- **BEM modifier pattern** added to Stylelint — `selector-class-pattern` updated to allow `block--modifier` syntax
- **`'use strict'` removed** from all JS files — VS Code's language service flags it as redundant with arrow IIFEs; ESLint rules cover the same guarantees
- **No `role="list"`** on `<ul>` — html-validate flags it as redundant; modern screen readers handle `<ul>` correctly

---

## Remaining phases

All phases complete. The app is ready for deployment and a Lighthouse audit.

---

## File structure

```
shiftboard/
├── index.html              Full app shell, SVG icon templates, modal dialogs
├── css/
│   ├── main.css            Design tokens, reset, layout, utilities
│   ├── grid.css            Schedule grid, chips, conflict states
│   ├── sidebar.css         Sidebar, employee list, drop zone, nav
│   ├── conflicts.css       Conflict panel and items
│   └── print.css           Print stylesheet (B&W, no chrome)
├── js/
│   ├── db.js               IndexedDB CRUD (window.DB)
│   ├── employees.js        Employee list, modals, availability matrix (window.Employees)
│   ├── settings.js         Settings modal (window.Settings)
│   ├── conflicts.js        Pure conflict engine + panel renderer (window.Conflicts)
│   ├── grid.js             Grid render, week nav, date utils (window.Grid)
│   ├── drag.js             DnD state machine — HTML5 + touch + keyboard (window.Drag)
│   ├── export.js           Clipboard + print (window.Export)
│   └── main.js             Orchestrator — wires all events, calls init
├── assets/
│   └── favicon.svg
├── netlify.toml            Cache headers + security headers
├── _redirects              SPA fallback
├── CLAUDE.md               Design rationale and architecture notes
├── HANDOFF.md              This file
├── README.md               User-facing documentation
├── package.json            Dev dependencies (type: module)
├── .husky/pre-commit       Runs lint-staged
├── .prettierrc             Formatting config
├── eslint.config.js        ESLint v9 flat config
├── stylelint.config.js     Stylelint + order + BEM pattern
└── .htmlvalidate.json      html-validate config
```

## Manual test checklist

- [ ] Add employee → appears in sidebar list with correct color chip
- [ ] Edit employee name → chip updates in sidebar and grid
- [ ] Delete employee → removed from sidebar and all scheduled shifts
- [ ] Set availability to Unavailable for a slot → schedule employee in that slot → amber warning appears
- [ ] Drag chip from sidebar to grid cell → chip appears in cell
- [ ] Drag chip between cells → chip moves
- [ ] Drag chip to sidebar drop zone → chip removed from grid
- [ ] Ctrl/Cmd+Z → last drag undone
- [ ] Keyboard: Tab to chip → Enter → Arrow keys → Enter → chip placed
- [ ] Keyboard: Tab to chip → Enter → Escape → cancelled
- [ ] Set minHeadcount to 2 → cells with 1 employee show amber warning
- [ ] Click "Copy summary" → paste into editor → correct plain text format
- [ ] Click "Print" → print preview shows clean grid, no sidebar, B&W chips
- [ ] Resize below 768px → narrow-message appears, grid hidden
- [ ] Refresh page → all data persists (employees, schedule, settings)
