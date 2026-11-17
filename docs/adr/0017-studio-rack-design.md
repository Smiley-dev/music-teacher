# 0017. "Studio rack" look and a top bar instead of the side menu

- Status: Accepted
- Date: 2026-11-17

## Context

A new design for the app was made as a canvas ("Music Teacher · Studio rack
app"): warm near-black panels with amber lamps (and a paper-coloured light
theme), mono labels and displays like rack gear, chunky keys, LED-style
meters, and a top bar holding everything that is always visible. The app
had the default shadcn look, with a sidebar for the main menu (ADR 0014)
and the instrument select (ADR 0015).

## Decision

- **Theme tokens.** The shadcn tokens in `src/index.css` (`:root` light,
  `.dark` dark) take the design's colours. Four tokens are added: `inset`
  (displays set into a panel), `topbar`, `signal` (the lit amber, darker
  ink on paper) and `nav-active` (+ `-foreground`). The Tailwind status
  shades the app already uses (emerald, amber, red, sky, violet) are
  redefined per theme to the design's green, amber, red, blue and violet, so
  every existing `text-emerald-500` and so on follows the design and keeps
  the rule "emerald = ok, amber = warning, red = error".
- **Fonts**: Archivo (text, 500/700/800) and Space Mono (labels, numbers,
  keys), bundled with `@fontsource` so the app needs no network. Replaces
  Geist.
- **Generated primitives stay unedited.** `src/components/ui/` is generated
  (CODING_RULES), so the rack look of buttons (mono caps, a 3px edge that
  lights up for the selected choice, pressed state), cards, selects and
  badges is applied in `index.css` through their `data-slot` attributes.
- **Top bar replaces the sidebar.** Brand, the main menu as one segmented
  bar, the instrument select (ADR 0015, now with a LOCKED mark while an
  exercise runs), the input device with a status lamp, and the theme
  switch. The selected section's pages (Practice, Theory) are a second row
  of keys under it, the current one lit. The bar is sticky, so the
  instrument and input stay visible. Navigation itself (ADR 0014) does not
  change: same `useNavigation`, same remembered pages.
- **Tuner** follows the design: a large mono note, FREQ / CENTS / state
  readout, a 41-mark strobe scale in place of the gauge, vertical LED level
  meters with peak hold, and the waveform on an inset display. `LevelMeter`
  (Settings) becomes a row of lamps with a CLIP lamp.
- Pages other than the Tuner keep their layouts for now; they get the new
  colours, type, cards and keys through the tokens.

## Alternatives considered

- **Re-skin by editing `components/ui`**: the next `shadcn add` would undo
  it.
- **Per-component Tailwind classes everywhere**: dozens of files change for
  what the tokens and the `data-slot` rules do in one place.
- **Load the fonts from Google Fonts, as the design file does**: a desktop
  app for practising should work offline.
- **Keep the sidebar and restyle it**: the design's top bar keeps the
  instrument and input visible on narrow windows without taking a column.

## Consequences

- Rebuilding each Practice and Theory page to the design's two-column
  layouts (options beside the display) is separate follow-up work; the
  tokens already apply there.
- A new status colour needs a shade defined in both themes in `index.css`.
- The `data-slot` rules are unlayered CSS and beat utility classes on the
  properties they set (button height and padding, card border). A page that
  needs a different size should add a variant here, not a class.
