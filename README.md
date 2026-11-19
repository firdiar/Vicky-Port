# Ficky Apriando — portfolio

A static portfolio site for **Ficky Apriando, S.T.**, built on the **Genesis**
design system (`designmd.ai/chef/genesis`, MIT). No build step, no framework, no
dependencies: plain HTML, one stylesheet and one small script.

Open **`index.html`** in a browser. That is the whole install.

---

## What is in here

| Path | What it is |
| --- | --- |
| `index.html` | The portfolio: hero, profile, experience, practice, credentials, skills, training, education, contact |
| `registry.html` | A demo product ("kitmd") used to exercise the design system — homepage |
| `explore.html` | Registry demo: search, tag filters, sorting, grid/list views |
| `kit.html` | Registry demo: kit detail page, rendered from `assets/js/data.js` |
| `system.html` | The Genesis design system itself: tokens, type scale, spacing, elevation, every component, rules |
| `assets/css/genesis.css` | Design system tokens + components (light and dark) |
| `assets/css/portfolio.css` | Portfolio-only compositions on top of the tokens |
| `assets/css/motion.css` | Motion layer: reveal states, scroll chrome, pointer effects, transitions |
| `assets/js/app.js` | Theme toggle (with the circular wipe), mobile drawer, account menu, interactive dot grid, copy-to-clipboard, command palette (Ctrl K), registry filtering, kit rendering, docs table of contents |
| `assets/js/motion.js` | Reveal observer, word-by-word headline, count-up, scrollspy, spotlight, tilt, magnetic buttons |
| `assets/js/data.js` | The twelve fictional kits used by the registry demo |
| `assets/img/kits/*.svg` | Kit sheet previews, generated — see `tools/make-previews.ps1` |
| `assets/img/ficky-apriando.jpg` | Portrait, extracted from page 1 of the CV PDF (336 × 344) |
| `assets/cv/Ficky-Apriando-CV-2026.pdf` | The source CV, served for download |
| `tools/make-previews.ps1` | Regenerates the kit preview SVGs |
| `tools/serve.ps1`, `tools/serve.js` | LAN static server (see below) |
| `tools/extract-pdf-images.js` | Pulls the embedded images out of a PDF (used for the portrait) |
| `tools/probe.js` | Headless browser probe that verifies the motion layer (see below) |

### Content source

Everything about Ficky Apriando on the portfolio comes from
`CV FICKY APRIANDO 2026.pdf` (26 pages: summary, education, work experience,
qualifications, training, achievements, languages, skills, and scanned
certificates). The registry kits, their authors and their statistics are
fictional demo data — clearly labelled as a demo.

The portrait is the same photo used on page 1 of the CV: it is an embedded JPEG
inside the PDF, pulled out with `tools/extract-pdf-images.js`. The photo was
framed in a gold ID ring in the original, so the stylesheet insets it slightly
(`transform: scale(1.12)` inside a clipped circle) to leave a clean edge.

---

## Design system in one screen

- **Colour** — one accent: indigo `#6366F1` (hover `#4F46E5`), used **only** for
  interactive elements. Green `#20970B` is reserved for the brand highlight.
  Neutrals run `#0A0A0A` text → `#E8E8EC` borders → `#FAFAFA` page.
- **Type** — General Sans for display and headings (700, tight tracking); DM Sans
  for body, labels and UI (400/500); JetBrains Mono for identifiers and code.
  Scale: 72 / 60 / 32 / 24 / 15 / 13 / 12 / 11.
- **Space** — 4px base, scale 4…96; container 1280 + 24px gutter; card gap 20–24.
- **Radius** — 4 tags · 6 buttons and inputs · 8 panels · 12 cards · full avatars.
- **Elevation** — flat by default; shadow only on hover, focus and floating layers.
- **Rules** — do and don't lists are printed on the homepage and in
  `system.html#rules`.

Light and dark themes are both complete; the toggle in the nav stores the choice
in `localStorage`. Append `?theme=light` or `?theme=dark` to any URL to force one.

---

## Motion and interaction

`assets/css/motion.css` plus `assets/js/motion.js` add the feel; they change no
tokens. Every effect is `transform`, `opacity` or `clip-path`, and the whole
layer switches off cleanly.

| Where | What happens |
| --- | --- |
| Hero | Eyebrow, headline, copy, buttons and stats rise in sequence. The headline's words rise one at a time. The credential sheet settles in and tilts up to 5° toward the pointer. |
| Scrolling | Section heads, timeline rows, certificates, skills and footer reveal as they enter view, 72 ms apart inside a group. |
| Nav | A 2 px progress bar tracks the page and the bar gains weight after the first scroll. The section in view gets a sliding underline and `aria-current`. A back-to-top button appears after 600 px with a ring that reports progress. |
| Cards | Pointer-tracked indigo glow, 3 px lift and a border shift on hover; kit previews scale inside their frame. |
| Figures | The hero's dataset counts up — years are left alone, because a rolling year reads as a typo. |
| Theme | The swap runs as a View Transition and wipes in a circle out of the toggle button. |
| Pages | Moving between the four pages cross-fades where the browser supports cross-document view transitions. |
| Detail | Primary buttons sweep a highlight and press in 3 %; icons nudge; the drawer slides; the palette pops; the toast springs; the status dot breathes. Credential rows in the hero sheet copy their registration number when clicked. |

The site is complete with motion off. Three switches:

- `prefers-reduced-motion: reduce` — static; the hidden reveal states never apply.
- `?motion=off` on any URL — the same, with transitions reduced to zero. Used by
  the screenshot tests.
- No JavaScript — the hidden states are gated on an `html.js` class that the
  inline head script sets, so a page without scripts is fully readable. That
  script also un-hides everything after 2.5 s if `motion.js` never reports in.

## Verify it

`tools/probe.js` drives Chrome or Edge over the DevTools protocol with no npm
packages (it needs Node 22+ for the built-in `WebSocket`). It loads the page,
dispatches real pointer events, scrolls, clicks and screenshots, and asserts the
result:

```powershell
node tools/probe.js --url=http://127.0.0.1:8080/index.html
node tools/probe.js --width=485 --height=900 --out=./shots/mobile
```

It checks that off-screen content starts hidden and is visible after scrolling,
that the pointer effects fire, that the theme flips inside a view transition,
that reduced motion disarms the layer, and that the console stays clean. Add
`--sweep=1` to walk an entire page and fail if anything is left invisible — run
it on all five pages after changing markup:

```powershell
node tools/probe.js --sweep=1 --url=http://127.0.0.1:8080/system.html
```

---

## Run it locally

The site is static, so any file server works — `python -m http.server 8080`,
`npx serve`, or the included one:

```powershell
node tools/serve.js 8080
```

It serves the folder, prints the address other devices on your network can use,
and supports `HEAD` and byte ranges, so the 4.6 MB CV PDF streams and downloads
cleanly on a phone. On Windows, `powershell -NoProfile -File tools\serve.ps1`
is a thin wrapper that does the same.

Open the printed network URL on a phone in the same Wi-Fi.

---

## Notes for whoever maintains this

- **Fonts load from Fontshare and Google Fonts.** Offline, the site falls back to
  system fonts; the layout is tuned to survive that.
- **Tested in Chromium** at 1440, 1200, 900, 720 and 485 px wide, light and dark.
- **Keyboard**: skip link, `Ctrl/⌘ K` opens the command palette (registry pages),
  `Esc` closes menus, drawers and the palette. Focus rings are 3px indigo rather
  than shadows, per the system.
- **Kit previews** are generated, not drawn by hand:

  ```powershell
  powershell -NoProfile -File tools\make-previews.ps1
  ```

- **Motion is a layer, not a rewrite.** New markup is picked up from the
  selector lists at the top of `motion.js`: `GROUPS` stagger their children,
  `LEAVES` reveal on their own. A block that matches neither still renders
  normally, it just does not animate. An element that is already inside the
  viewport when the script runs is shown without a transition, so there is never
  a flash of hidden content.
- **Certificate chips** carry validity, not decoration: `.chip--valid` (green with
  a dot) while the certificate is current, the same treatment as the two lifetime
  IWI-C cards. When a certificate lapses, drop the modifier and update the date in
  the card — and the text in the section description if the count changes.
- **The CV PDF** is the source of truth for every fact on the portfolio. If the CV
  changes, update `index.html` with it — the design system stays the same.

## Credit

Genesis design system — [designmd.ai/chef/genesis](https://designmd.ai/chef/genesis),
MIT licensed. This project reimplements it from the published DESIGN.md rather
than copying the original site's markup.
