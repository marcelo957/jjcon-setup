# Bushido Design System

> Bushido (武士道), "the way of the warrior", is the IBJJF's name for its shared code of colors,
> spacing, typography and component behaviour. This project is the design-agent form of that system.

**IBJJF** — the International Brazilian Jiu-Jitsu Federation — runs the sport's championship
circuit: athlete membership (*filiação*), event registration (*inscrição*), brackets and live mat
operation, results and world ranking, academy registration and black-belt certification. Its
products are internal operations consoles and public-facing registration and results sites, used in
English, Portuguese and Spanish. **CBJJ** (Confederação Brasileira de Jiu-Jitsu) is the sibling
Brazilian federation and has its own green sub-brand palette inside this system.

## Sources

This system was built from two sources; both remain the authority over anything written here.

| Source | What was taken from it |
| --- | --- |
| **GitHub — [IBJJF-DEV/bushido-design-system](https://github.com/IBJJF-DEV/bushido-design-system)** | Every token value (colors, typography, spacing, borders, elevation, motion, z-index, focus, overlay, form and tabular tokens), the component inventory, and each component's structure and states. Read `packages/bushido-ui/src/styles/design-tokens/` for tokens and `packages/bushido-ui/src/` for components. Storybook: [bushido-design-system.pages.dev](https://bushido-design-system.pages.dev/). |
| **Figma — "Bushido Design System.fig"** (attached; the repo README also links [Components and Design System 2](https://www.figma.com/design/loIPrle2OVZHBc6JcnGWy9/Components-and-Design-System-2)) | Component family inventory and variant axes, documentation pages (principles, content and UX guidelines, accessibility, naming conventions). |

Where the two disagreed, the repo won — it is the shipping implementation, and its token files say
outright that they follow the Figma design system.

Worth exploring further in the repo if you are building against IBJJF products: the
`.storybook/stories/` MDX guides (design philosophy, for-designers, for-developers, accessibility,
icon gallery), `specs/` (per-component specifications), and `packages/bushido-ui/src/_foundations/`
(the foundation stories these specimen cards mirror).

## Content fundamentals

Bushido's product copy is **operational, not promotional**. It describes what a screen does and what
happened, with no marketing voice.

- **Person.** Second person for instruction and consequence ("Update the card on file to continue",
  "Your registration is confirmed"). First-person plural only when the federation itself acts
  ("We couldn't load the brackets"). Never first-person singular.
- **Casing.** Sentence case for everything readable — labels, headings, hint text, buttons ("New
  registration", not "New Registration"). Uppercase is a *typographic* device applied by components,
  not typed by authors: tabs, table headers, overlines, the navbar and sidebar group captions all
  uppercase their content in CSS. Write them in sentence case and let the component transform them.
- **Length.** Labels are one or two words ("Academy", "Weight (kg)"). Hints are one clause and say
  what to do, not what went wrong in the abstract: "Must match your registered team", "PDF up to
  10 MB", "Select a registered academy".
- **Domain vocabulary is exact.** Athlete, academy (not "team" in labels), division, belt, absolute,
  bracket, mat, registration, membership, ranking, guardian. Belt and medal names are lowercase in
  prose and Title Case in tags. Portuguese terms — *filiação*, *inscrição*, *responsável legal* —
  appear untranslated in Brazilian-facing copy.
- **Errors name the fix.** "Two fields need attention. Weight and academy are required before you can
  submit." Not "Validation failed."
- **Numbers are always numerals** and always set in Roboto Mono: `$139.75`, `412 athletes`,
  `REG-2026-00412`, `04:32`. Never spell out a count.
- **No emoji, anywhere.** No exclamation marks in product copy. Icons carry tone instead.
- **The engineering-facing voice is different.** The repo's own README and changelogs are informal
  and self-deprecating (strikethrough jokes, "components are ~~a little shitty~~ not good"). That
  voice belongs to internal developer documentation only — never to product surfaces.

## Visual foundations

**Color.** Primary is IBJJF blue `#004581` — deep, corporate, unmodulated; it carries the navbar,
the active sidebar row, the table hover highlight and every primary button. Complementary amber
`#fcb30e` is the one accent: the navbar's active underline, awards, highlights — it is never a
background for text. Secondary `#0b2a53` is the dark footer. Tertiary `#26abe9` doubles as the info
intent. Semantics are literal: success `#00a51a`, warning `#f38f39`, danger `#ce0000`. Beyond the
brand there are three parallel greys — `neutral` for text, `grey` for borders and rules, `surface`
for backgrounds (`#eeeeee` down to `#fdfdfd`) — plus a domain palette no other design system has:
the ten BJJ belts, three medals, and male/female. Backgrounds are flat surface tints. **There are no
gradients anywhere** except one 180° white-to-grey wash inside the tooltip. Two background colors per
screen at most: a surface tint for the page, white for cards.

**Type.** Three families, each with a job. **Roboto Condensed** is structural — headings, buttons,
tabs, table titles, sidebar and navbar; its condensed width is what makes a Bushido screen
recognisable. **Inter** is content — body copy, labels, table cells, hints. **Roboto Mono** is
numeric and technical — scores, times, fees, IDs, code. The display scale is tight: H1 48/56 at
weight 500 with -0.5px tracking, H2 36/44 at 500 with -0.25px, then H3 28/36, H4 22/30, H5 18/26,
H6 16/24 all at weight 400. Body is 14/24. Card headings use H6 at weight 500 with -0.3px tracking.
Buttons are 14/20 medium with +0.5px; overlines are 11/16 with +1px, uppercased.

**Spacing.** A 4px base, 15 steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 72, 96, 128, 144. Card
padding is 12px; page padding 20px; table cells 12px block / 16px inline; grid gutters 16px on
mobile and 24px from desktop up, with 100px page margins at desktop and above.

**Corners.** Six radii, each with an assigned job: 4px for menu items, pagination and filters; 6px —
the default — for inputs and boxes; 8px for buttons, cards, menus and tooltips; 12px for modals and
toasts; 16px for hero panels; pill for tags and badges. Cards use 6px, buttons 8px. Nothing is fully
square except deliberately squared avatars.

**Cards and surfaces.** A card is white, 6px-rounded, with the elevation-1 shadow and no border by
default; `bordered` swaps the shadow for a 1px `#CCCCCC` line. A 10px left accent bar
(`statusBorder`) is the one exception to the "no colored left border" rule — it is a real,
documented Bushido pattern for status cards. Panels are the opposite: always bordered, with a grey
`surface-300` header bar. Modals get a `surface-500` header bar, a 12px radius and a 1px border.

**Elevation.** Five Material-derived levels, each a two-part shadow pairing a tight 30%-black key
with a wider 15%-black ambient. Elevation 1 for cards, 2 for hovered cards and toolbars, 3 for
popups and menus, 4 for modals and drawers, 5 reserved. There is also one inset shadow for pressed
wells.

**Borders and dividers.** Three widths — 1px standard, 2px for focus and emphasis, 4px for status
bars and message accents. Default border `#CCCCCC`, dividers `#999999`. Table headers carry a 2px
bottom rule; card footer dividers run edge-to-edge at 50% opacity.

**Motion.** Five durations — 50ms (menu, tab hover), 150ms (general UI), 250ms (panels, drawers),
500ms, 1000ms — with three Material curves: standard `cubic-bezier(0.4,0,0.2,1)`, decelerate for
entrances, accelerate for exits. Transitions are on color, background, border, box-shadow and
transform only. There are no bounces, no spring physics, no decorative motion. Three looping
animations exist: a 1s spinner, a 1.5s shimmer for indeterminate progress and loading selects, and a
2s pulse.

**Interaction states.** Hover on a filled control darkens the fill by mixing 20% black
(`color-mix(in srgb, var(--button-background) 80%, black)`); active mixes 40%. Ghost buttons tint
toward neutral instead. Inputs turn their border primary blue on hover *and* focus. Focus is a 2px
solid outline in 40%-alpha primary at 2px offset for buttons, and a 2px 20%-alpha box-shadow ring
for inputs — never a browser default. Disabled is `#999999` on `#CCCCCC` for buttons and 0.5
opacity elsewhere, with `cursor: not-allowed`. Two Bushido-specific behaviours worth knowing:
a table row's hover flips the entire row to solid primary blue with white text; and hovering the
*already-active* sidebar row deliberately softens back to the grey hover surface with primary text,
so the row still reads as interactive.

**Transparency and blur.** Rare and purposeful. The overlay backdrop is 65% black with a 6px
backdrop blur. Navbar links sit at 85% white and go solid on hover. Ghost-button hover surfaces are
mixed colors, not alpha. Nothing else is translucent.

**Imagery.** The system defines no illustrations, no photographic treatment and no background
imagery. Cards support a full-bleed thumbnail slot clipped to the card's top corners; that is the
only image affordance. Avatars are the main place photos appear — circular by default, 32/40/50/64px,
falling back to initials and then to a Font Awesome user glyph. **The sources contain no logo file,
so nothing in this system draws an IBJJF mark**: the wordmark renders as type in Roboto Condensed
(see `AppNavbar`'s `brand` prop and `thumbnail.html`). Ask the IBJJF brand team for the real asset
before shipping anything public.

**Layout.** Fixed navbar at 64px; sidebar 260px expanded, 64px collapsed as an icon rail; a
12-column grid from the desktop breakpoint up (4 at mobile, 8 at tablet). Content maxes out at the
1440px widescreen breakpoint. Toast and dialog stacking is fully tokenised: dropdown 700, backdrop
750, sticky 800, drawer 850, dialog 900, toast 950, tooltip 1000.

## Iconography

**Font Awesome 6.7.2 Free** is the icon system — Solid for almost everything, Regular and Brands
available. It is loaded from cdnjs by `bushido-ui`'s `global.ts` at runtime and by
`tokens/fonts.css` here, so glyphs are referenced by name, never as inline SVG. The `Icon`
component takes a bare Font Awesome name: `<Icon name="circle-check" />`.

- Icons size to `1em` inside buttons and tags so they sit on the text box; standalone icons run
  16–24px, and the empty/error state glyph is 48px.
- Icons inherit `currentColor` and therefore the state color of whatever contains them.
- Fixed semantic mappings: `circle-check` success, `triangle-exclamation` warning,
  `circle-exclamation` danger, `circle-info` info and primary, `xmark` dismiss, `chevron-down`
  expand, `angle-double-left/right` sidebar collapse, `magnifying-glass` search,
  `ellipsis-vertical` row overflow.
- Only two hand-drawn SVGs exist in the whole system, both inside toggle controls: the checkbox tick
  and dash, and the radio dot. Everything else is a font glyph.
- **No emoji and no Unicode pictographs.** The one non-Font-Awesome glyph in use is the ellipsis
  character in Pagination.
- The Figma file also contains a Material-style icon set (`Icons/navigate_next`, `Icons/mic_24px`
  and similar) used only in its own documentation frames; product surfaces use Font Awesome.

## Index

| Path | What it holds |
| --- | --- |
| `styles.css` | The single entry point — imports every token file and component stylesheet |
| `tokens/` | `fonts` · `colors` · `color-palette` · `typography` · `spacing` · `borders` · `elevation` · `layout` · `form-elements` · `tabular-data` · `base` |
| `components/core/` | Buttons, links, icon and the base surfaces |
| `components/forms/` | Inputs, selects, toggles and field wrappers |
| `components/data/` | Tags, avatars, tables, lists, pagination, kanban |
| `components/feedback/` | Messages, toasts, overlays, progress, empty and error states |
| `components/navigation/` | Tabs, menus, breadcrumbs, navbar, sidebar, page scaffolding |
| `components/layout/` | Cards, panels, accordions, grid, filter surfaces |
| `guidelines/` | The foundation specimen cards shown in the Design System tab |
| `ui_kits/bushido-console/` | Interactive recreation of the internal IBJJF console |
| `SKILL.md` | Agent-skill entry point for use outside this project |
| `github.md` | Upstream repo association and sync record |

### Components

**Core** — Box, Button, ButtonGroup, ButtonToolbar, CopyButton, Display, Divider, HelpButton, Icon,
IconButton, Link, SplitButton.

**Forms** — Checkbox, CheckboxGroup, Field, FieldGroup, FileInput, ImageInput, Input, MultiSelect,
Option, OptionGroup, Radio, RadioGroup, SearchInput, SearchSelect, Select, Switch, TagInput,
Textarea.

**Data display** — Avatar, Badge, BadgeAnchor, ColorLegend, ColoredDot, DataTable, Kanban,
KanbanCard, KanbanColumn, List, ListItem, Pagination, Table, Tag, TagDisplay, TagGroup.

**Feedback and overlays** — Drawer, EmptyStateMessage, ErrorStateMessage, Lightbox, Message, Modal,
Popup, ProgressBar, ProgressRing, SystemBanner, Toast, ToastStack, Tooltip.

**Navigation** — ActionsMenu, AppFooter, AppNavbar, AppShell, Breadcrumb, BreadcrumbItem,
ContentContainer, Dropdown, LocaleSelector, Menu, MenuItem, MenuItemGroup, NavbarLink, PageContainer,
PageHeader, Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu,
SidebarMenuItem, SidebarSubmenu, SidebarTrigger, Tab, TabGroup, UserMenu.

**Layout** — Accordion, AccordionGroup, Card, CardExpandable, Column, Columns, FilterBar, FiltersBox,
Panel, PanelCard, PanelSection, StatusFilterButton, StatusFiltersBar.

### Intentional additions

Three components have no one-to-one counterpart in the sources and were added so the set is usable:

- **Icon** — a thin wrapper over the Font Awesome glyph set, so every other component can take an
  icon by name instead of embedding markup.
- **BadgeAnchor** — the repo's `ib-badge` positions itself absolutely and assumes a positioned
  parent; this supplies that parent explicitly.
- **NavbarLink** — the repo's navbar takes slotted children; this is the styled link those children
  are in practice.

### Known gaps

- **No logo asset.** Neither source ships one. Wordmarks render in type; do not reconstruct a mark.
- **Tag palette approximation.** The repo's `tag-palette.css` pairs a hand-tuned pale background
  with each saturated text color across ~60 hues. `Tag` here derives its fill as a 12% tint of the
  `--ib-color-*` token instead. Belt, medal, gender and semantic tags — the ones that matter — are
  exact; the decorative named hues are close but not byte-identical.
- **Fonts load from Google Fonts and cdnjs**, matching `bushido-ui`'s own runtime behaviour. No
  font binaries are vendored, so the system needs network access to render correctly.
- Several Figma families are documentation artifacts rather than shipping components (`Keyboard`,
  `Keyboard-dark`, `HEADER DESKTOP`/`HEADER MOBILE` variant sheets, the Font Awesome and Material
  icon galleries). They are represented by the icon system and the navbar rather than rebuilt.
