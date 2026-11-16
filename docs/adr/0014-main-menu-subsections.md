# 0014. Subsections in the main menu, with a navigation context

- Status: Accepted
- Date: 2026-11-16

## Context

Practice (7 pages) and Theory (8 topics, ADR 0013) showed their pages as a
row of tabs at the top of the screen. The row was getting long, did not show
where you were once you scrolled down, and Theory needed to link to the
Practice page of each topic ("Practise it in Practice: Intervals"), which
tabs inside another section's screen could not do. The selected tab was also
forgotten on every visit.

## Decision

- **Sections can have subsections.** A `SECTIONS` entry (`src/sections.ts`)
  has either a `Screen` or `subsections` (`id`, `label`, `Component`); Practice
  uses `PRACTICE_SECTIONS`, Theory `THEORY_TOPICS`. The tab screens are gone.
- **Main menu**: the selected section is expanded to list its subsections
  (indented, the current one highlighted, `aria-current="page"`); other
  sections stay collapsed, with a chevron. Clicking a section opens it on the
  subsection last shown there. The header shows the section above the
  subsection's title.
- **`NavigationProvider`** (`src/providers/`) holds the selected section and
  each section's subsection, remembered in localStorage
  (`music-teacher:section`, `music-teacher:subsection:<section>`), and
  `useNavigation()` exposes them with `go(section, subsection?)`, which also
  scrolls back to the top. It is plain React state and context, no router
  library.
- **Typed links**: `SubsectionId<"practice">` is derived from the registry,
  so links written in pages (`SectionLink`, `PractiseIn`) fail to compile
  when an id is wrong. Pages that `sections.ts` imports use only types from
  it.
- Only the page shown is mounted, as with the tabs: leaving a page that
  started audio (a pitch exercise, sight reading) still stops it.

## Alternatives considered

- **Keep the tabs, add sidebar links**: two navigations for the same pages.
- **Always expand every section**: 19 entries, Settings pushed far down;
  one click less to jump between Practice and Theory, but the menu is busy.
- **A router library (URLs per page)**: a desktop app has no address bar or
  deep links, so it would add a dependency for no visible benefit.

## Consequences

- Any section can grow subsections by giving its entry a registry.
- Pages can link to each other (Theory → Practice today; Practice → Theory
  is now easy to add).
- Navigation state is UI-only; nothing changes in the engine or settings.
