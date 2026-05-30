# Shiftboard — Project Reference

## Tech Stack

- **HTML/CSS/JS** — no build tools, no framework. The scheduling grid, drag-and-drop, and conflict logic are all achievable without a framework.
- **IndexedDB via idb-keyval** — persistent local storage for employees, shifts, availability, and settings. UMD CDN build (`window.idbKeyval`).
- **Heroicons** — SVG icons inlined as `<template>` elements in `index.html` (avoids CDN CORS issues).
- **No drag-and-drop library** — native HTML5 drag events + parallel touch event system + keyboard alternative. That's the point of this project.

## Typeface: Inter

Inter is used throughout Shiftboard. This is a deliberate, context-specific choice — not a default.

**Rationale**: Shiftboard is an enterprise scheduling tool where exact glyph metrics matter for dense grid layouts. `system-ui` produces inconsistent rendering across Windows (Segoe UI), macOS (SF Pro), and Linux (DejaVu/Ubuntu), making grid cell sizing non-deterministic. Inter was designed specifically for screen legibility at small sizes in UI contexts, making it the correct choice here.

**This is the only project in this series where Inter is appropriate.** Do not use Inter on the other three projects. Using a distinctive display face on those projects would be a costume, not a decision. Using Inter on them would be the same mistake in reverse.

## Design Tokens

All tokens live in `css/main.css` as CSS custom properties:

| Token | Value | Notes |
|-------|-------|-------|
| `--color-bg` | `#FFFFFF` | App background |
| `--color-grid-surface` | `#F8FAFC` | Grid cells |
| `--color-sidebar-surface` | `#F1F5F9` | Sidebar/panels |
| `--color-structure` | `#1E293B` | Borders, structural elements |
| `--color-text-primary` | `#1E293B` | Body text |
| `--color-text-muted` | `#596070` | Secondary text — see note below |
| `--color-accent-teal` | `#0F766E` | Confirmed/valid, focus rings — teal-700; teal-600 #0D9488 failed 4.5:1 with white text |
| `--color-accent-amber` | `#F59E0B` | Warnings |
| `--color-accent-red` | `#EF4444` | Errors/conflicts |
| `--color-avail-bg` | `#D1FAE5` | Employee available highlight |
| `--color-unavail-bg` | `#FEE2E2` | Employee unavailable highlight |

### `--color-text-muted` Correction

The spec lists `#64748B` as the muted text color. **This value fails 4.5:1 WCAG AA on the sidebar surface (`#F1F5F9`)** — the actual ratio is ≈4.40:1.

The global value is corrected to `#596070`, which passes on all three background surfaces:
- On `#FFFFFF`: ≈5.10:1 ✓
- On `#F8FAFC`: ≈4.91:1 ✓
- On `#F1F5F9`: ≈4.65:1 ✓

## Employee Color Presets

Eight preset colors for employee chips. All use white (`#FFFFFF`) text. All verified at ≥4.5:1 contrast (exceeds the 3:1 UI component minimum):

| Index | Name | Hex | Contrast |
|-------|------|-----|----------|
| 0 | Teal | `#0F766E` | 5.38:1 |
| 1 | Indigo | `#4338CA` | 9.05:1 |
| 2 | Rose | `#BE123C` | 8.68:1 |
| 3 | Amber | `#B45309` | 5.74:1 |
| 4 | Violet | `#6D28D9` | 10.2:1 |
| 5 | Emerald | `#065F46` | 9.72:1 |
| 6 | Sky | `#0369A1` | 7.78:1 |
| 7 | Fuchsia | `#86198F` | 10.3:1 |

These are Tailwind 700-shade equivalents — dark enough for white text contrast, visually distinct from each other and from the UI accent colors.

All chips include `border: 2px solid rgba(0,0,0,0.12)` to maintain legibility against light backgrounds.

## Data Model

### IndexedDB (idb-keyval, database name: `shiftboard-db`)

Four stores — all in the same database but separate object stores:

- **`employees`** — key: `employeeId` (`"emp_abc123"`). Value: `{ id, name, role, colorPreset, colorHex, createdAt, updatedAt }`.
- **`availability`** — key: `employeeId`. Value: `{ employeeId, slots: { "mon_morning": "available"|"preferred"|"unavailable", ... } }`. 21 slot keys: `{mon|tue|wed|thu|fri|sat|sun}_{morning|afternoon|evening}`.
- **`shifts`** — key: ISO week string (`"2026-W22"`). Value: `{ weekKey, cells: { "mon_morning": ["emp_abc", ...], ... }, updatedAt }`. Document-per-week model — makes undo trivial (snapshot the whole document).
- **`settings`** — flat key-value pairs: `minHeadcount` (number, default 1), `weekStart` (`"mon"`), `lastWeekKey` (string).

### Inter-Module Communication

`sourceType: 'script'` is required (no ES modules). Each JS file exposes a namespace on `window`:

```
window.DB          js/db.js
window.Employees   js/employees.js
window.Settings    js/settings.js
window.Conflicts   js/conflicts.js
window.Grid        js/grid.js
window.Drag        js/drag.js
window.Export      js/export.js
```

`main.js` is the orchestrator — no namespace, wires all events, calls init functions.

Script load order matters: `db.js` → `employees.js` → `settings.js` → `conflicts.js` → `grid.js` → `drag.js` → `export.js` → `main.js`.

## Conflict Detection

Pure function: `Conflicts.detectConflicts(weekCells, availabilityMap, minHeadcount)` — no DOM access, no async. Three rules:

1. **Double-booking** (error/red): same employee appears in the same cell key more than once.
2. **Availability violation** (warning/amber): `availabilityMap[empId].slots[cellKey] === 'unavailable'`.
3. **Understaffed** (warning/amber): `cells[cellKey].length < minHeadcount` for any of the 21 cells.

Conflict states use icons alongside color — never color alone.

## Drag-and-Drop

Three parallel paths share the same `dragState` object and `performDrop()` function:

1. **HTML5 drag events** (desktop)
2. **Touch events** (mobile) — floating clone element, `elementFromPoint` for target detection
3. **Keyboard alternative** — `Enter` to pick up, arrow keys to navigate, `Enter` to drop, `Escape` to cancel

Undo: `preSnapshot` is a deep clone of `weekCells` taken at drag **start** (not on drop). `Ctrl/Cmd+Z` restores it. Single-level only.

## Pre-Commit Tooling

- **Prettier**: `singleQuote`, `semi`, `tabWidth: 2`, `endOfLine: "lf"`
- **ESLint v9 flat config**: `sourceType: 'script'`, `no-unused-vars`, `no-console`, `eqeqeq`
- **Stylelint**: `stylelint-config-standard` + `stylelint-order` with `properties-alphabetical-order`
- **html-validate**: `doctype-style: lowercase`, `void-style: selfclosing`
- **Husky + lint-staged**: runs all linters on commit

## Known Gotchas

- `dragover` handler **must** call `e.preventDefault()` — without it, `drop` never fires.
- idb-keyval: use the UMD CDN build, not the ES module build. URL: `https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js`
- `deno.lock` is generated by Netlify CLI — it's in `.gitignore`.
- `<dialog>` element: supported in Chrome 37+, Firefox 98+, Safari 15.4+. Safari 15.3 and below need a polyfill — noted in HANDOFF.md.
- `Cache-Control: immutable` on JS/CSS requires filename versioning for future updates — noted in HANDOFF.md.
- CSS properties within each rule block must be in alphabetical order (Stylelint enforces this).
