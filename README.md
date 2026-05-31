# Shiftboard

A shift scheduling tool built for two use cases: managers build and edit the weekly schedule on desktop; employees check assignments and make small adjustments on mobile. Build a schedule by dragging employees into time slots across a configurable grid. Employees can mark their availability preferences, and the system flags conflicts — double-booking, understaffed shifts, availability violations — in real time.

## Features

- **Weekly schedule grid** — Up to 7-column × 3-row (Morning / Afternoon / Evening) drag-and-drop grid; configurable week start (Mon/Sun) and optional weekend columns
- **Mobile view** — Below 768 px the grid reflows to a vertical day-card stack; sidebar becomes a slide-in drawer for employee management
- **Employee management** — Add, edit, and delete employees with color-coded chips and role/title labels
- **Availability preferences** — Per-employee 7×3 matrix with Available / Preferred / Unavailable states
- **Real-time conflict detection** — Double-booking, availability violations, and understaffed shifts flagged instantly; scoped to visible days only
- **Keyboard drag alternative** — Full keyboard operation: pick up chips with Enter, navigate with arrow keys, drop with Enter, cancel with Escape
- **Undo** — Ctrl/Cmd+Z reverses the last drag operation
- **Export** — Copy week summary to clipboard as plain text (respects active day order and weekend visibility); print-optimised B&W view
- **Local-first** — All data stored in IndexedDB; no backend, no account required

## Tech stack

Vanilla HTML/CSS/JS. No framework, no build tool — open `index.html` directly in a browser.

- **Storage**: IndexedDB via [idb-keyval](https://github.com/jakearchibald/idb-keyval) (CDN)
- **Icons**: [Heroicons](https://heroicons.com/) (inlined SVG templates)
- **Drag-and-drop**: Native HTML5 drag events + parallel touch event system + keyboard alternative — no DnD library
- **Typeface**: Inter — chosen specifically for this project's enterprise grid context; see `CLAUDE.md` for rationale

## Local development

No build step required.

```
git clone https://github.com/tomd0627/shiftboard.git
cd shiftboard
# Open index.html in a browser — that's it
```

For pre-commit linting:

```
npm install
```

This installs Husky, ESLint, Stylelint, Prettier, and html-validate. Hooks run automatically on commit.

## Deployment

Configured for [Netlify](https://netlify.com). Push to `master` — the `netlify.toml` handles everything:

- Long-lived `Cache-Control: immutable` headers for JS/CSS/assets
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`

**Note**: Because JS/CSS assets use `Cache-Control: immutable`, future updates to these files require either renaming them or removing the `immutable` directive before deploying. See `HANDOFF.md`.

## Data storage

All data is stored client-side in IndexedDB (`shiftboard-db`):

| Store | Key | Contents |
|-------|-----|----------|
| `employees` | `employeeId` | Name, role, color |
| `availability` | `employeeId` | 21-slot weekly matrix |
| `shifts` | `weekKey` (ISO, e.g. `2026-W22`) | All employee assignments for the week |
| `settings` | string keys | `minHeadcount`, `weekStart`, `showWeekends`, `lastWeekKey` |

Data survives page reloads but is browser-local. There is no sync or backup.

## Browser support

- Chrome 90+
- Firefox 88+
- Safari 15.4+ (the native `<dialog>` element requires 15.4; earlier Safari needs [dialog-polyfill](https://github.com/GoogleChrome/dialog-polyfill))

## Accessibility

- Full keyboard drag-and-drop alternative
- Conflict states indicated by icon + colour (never colour alone)
- `role="alert"` on conflict panel — announced by screen readers on change
- All interactive elements have visible teal focus rings
- Skip link to main content
- `aria-live` region for drag-and-drop state announcements
- Colour contrast: all text meets WCAG AA (4.5:1); employee chip colours verified at ≥4.5:1 with white text
