# JJCON SetUp design changes

_Started 2026-09-15 01:40 UTC_

---

## User

Continuing from "Trade show management app".

## Assistant

We were building a trade-show setup management app for BJJ Championships (Jiu-Jitsu Con 2027). The app supports dual workflows: event ops manager planning weeks ahead on desktop, on-site crew executing and verifying during load-in on phones.

Decisions made:
- Dashboard shows setup progress by six branches (Sectors, Truss, Truck unload, Staff, Goodie bag montagem, Sponsors) with a % verified metric.
- Status model: Not started → In progress → Installed → Verified (crew stops at Installed; only ops manager can verify).
- Sector detail splits across five tabs: Floorplan (zoomable per-sector image), Material list, Instructions, Photos, Power & network.
- Sub-sectors for Podium, Entrance, Championship, Rooms & Halls, Power Drops live in a separate tab.
- Phone checklist uses one card per sector; crew marks installed via tap/swipe.
- Floorplans and photos are drag-drop image slots that persist.
- Used Bushido Design System tokens (--ib-shadow-small for consistent elevation).
- Table toolbar has working search and horizontal scroll wrapper for Status column visibility.
- Crew list sorted by window start time.

Current state: Console page fully functional with branch overview, dense filterable table (Type 1/Type 2 filters), sector detail view with all five tabs, and "Viewing as" switch (ops manager/crew toggle) demonstrating the verify gate. Horizontal scroll and shadow tokens fixed. All image slots ready for real floorplans and photos.

Next steps: Populate with real event data, test phone responsiveness on the checklist unit, and refine navigation flow between branches.

Files: ConsolePage.dc.html, ios-frame.jsx, image-slot.js, Bushido Design System (IBJJF), mindmap.pdf.

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Trade Show App Design"
What `list_files` on the project root returns right now (dotfiles, if any, are not shown here):
📁 _ds
📁 uploads
📄 ConsolePage.dc.html
📄 ds-base.js
📄 image-slot.js
📄 ios-frame.jsx
📄 support.js
User is viewing file: ConsolePage.dc.html
Current date is now September 16, 2026
</system-info>

<pasted_text name="Pasted text (89 lines)">
Design a web app called "JJCon Ops 2027" — an operations tool for planning and executing
the build-out of Jiu-Jitsu Con 2027. The same sector data appears in three different
forms: a desktop authoring view, a mobile field view, and a printed sheet.

THREE CONTEXTS

1. DESKTOP — office staff, before the event. They build the content: upload floorplans,
   write material lists, draft setup instructions. They also track their own preparation:
   which sectors still have no floorplan, which material lists are unfinished, what's
   approved and what isn't. Their question is "what have we prepared, and what's missing?"
   Design for a wide screen: multi-column layouts, dense tables, side-by-side edit and
   preview, keyboard-friendly forms, bulk actions across sectors.

2. MOBILE — setup crew and sector leads, during build-out, on phones, on the floor. They
   consume that content: find their sector, view the floorplan, confirm materials arrived,
   follow the steps. Their question is "what do I do next?" Conditions are noisy and
   bright: large tap targets, high contrast, one thing per screen, key info above the fold,
   no dense tables — stack into cards instead.

3. PRINT — a per-sector packet posted at the sector or carried by a lead with no phone.
   Design this as a real layout, not a browser dump: black and white only (status is
   conveyed by icons and labels, never color alone), floorplan scaled to fill a full page
   with its legend printed beside it rather than behind a toggle, material list as a
   checkbox table with a blank "qty received" column and a signature line, instructions as
   a numbered list with no interactive elements. Header on every page: sector name,
   version date, and assigned lead. Show a print-preview screen for this in the desktop view.

VISUAL DIRECTION
Utilitarian, closer to a field-ops tool than a marketing site. Dark text on light
background with one strong accent for status and actions. Bold sector names, clear
numeric quantities, status chips. Everything must survive being printed in grayscale.

TWO STATUS TRACKS — keep these visually distinct
- Prep status (office): Not started / Draft / Ready / Approved. Per content block, so a
  sector can have an approved floorplan and a draft material list.
- Build status (on site): Not started / In progress / Complete. The physical work.

SCREEN 1 — PREP DASHBOARD (desktop, office home)
A readiness matrix: sectors down the left, content types across the top (Floorplan,
Material List, Instructions), each cell a prep-status chip. Above it a summary strip:
"18 of 24 floorplans ready · 11 of 24 material lists ready · 6 sectors blocked." Filters
for incomplete-only and by owner. A "Print packets" action that lets staff select sectors
and generate their printed sheets in one batch. Tapping a cell opens that block in edit mode.

SCREEN 2 — EDIT MODE (desktop)
Sector detail in an editable state, two-column: form on the left, live preview on the
right with a toggle between mobile preview and print preview. Upload or replace a floorplan
image, tag its layers, add and reorder material rows with quantities, write instruction
steps, set each block's prep status. Last-edited-by line and unsaved-changes state.

SCREEN 3 — SECTOR INDEX (mobile, crew home)
Sectors grouped into: Type 1, Type 2, Truss, Truck Unload, Staff, Goodie Bag, Sponsors.
Each card shows name, build-status chip, assigned lead, and material progress (e.g. 12/20).
Search field plus a "my sectors only" filter.

SCREEN 4 — SECTOR DETAIL (mobile)
Tabs below the header; tab set varies by sector type. See sector list below.

SHARED COMPONENTS
- SectorHeader: name, category, build-status chip, assigned lead, day/time window.
- FloorplanViewer: pinch-zoom with legend and toggleable layers (one per element type, so
  a worker can isolate e.g. only power drops). In print, all layers render at once with a
  full legend. Empty state names the owner when no floorplan is uploaded yet.
- MaterialChecklist: grouped rows with item, quantity, checkbox, optional note, progress
  bar. Editable on desktop, checkable on mobile, blank-boxes-plus-signature in print.
- InstructionSteps: numbered steps with checkboxes and optional photo per step, plus a
  "Need help?" contact block.

SECTOR SCREENS
1. Type 1 — tabs: Floorplan | Materials | Instructions
   Floorplan layers: tables, chairs, stations, computer network, sign banners, power drops,
   extension cords. Materials split into "Main Materials" and "Computers &amp; Network".
2. Type 2 — tabs: Floorplan | Information | Installation
3. Truss — tabs: Signage Floorplan | Reference Images | Setup Instructions
   (Reference Images is a captioned photo grid, tappable to full screen.)
4. Truck Unload — tabs: Floorplan | Instructions
5. Staff — prominent link to the Google Sheet for check-in/check-out, Instructions below.
6. Goodie Bag — tabs: Floorplan | Materials | Instructions (table layout and assembly
   stations).
7. Sponsors — Instructions only, no tabs.

CONTENT
Realistic placeholder content, not lorem ipsum: plausible sector names, quantities, and
setup steps as short imperative sentences. Floorplans are simple top-down schematics with
labeled shapes, not photos. Include a few deliberately incomplete sectors so empty and
draft states are visible.

Start with the Prep Dashboard (desktop), then the Type 1 sector detail on mobile, then its
print packet — those three cover every layout pattern in the app.
</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Bushido Design System (IBJJF) (design system)">
[Design System] This project uses the **Bushido Design System (IBJJF)** design system. This is a binding choice for visual style — every visual must follow it. Don't invent colors, type, spacing, or components not grounded here.

Scope: the design system is a visual style reference only. Its guide may describe example products, brands, or people that are unrelated to the user and unrelated to the subject of this conversation. Never treat anything in the design system as a fact about the user, their work, or the topic they asked about.

This project has the **BushidoDesignSystemIBJJF_389963** design system bound at `_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/`. If anything under that path is missing or fails to load, the folder name may differ — `list_files` `_ds/` and use the folder whose name ends with 38996378-a1a9-4400-b089-cc07f4b2dd5e instead, including in the <link>/<script> paths below.

**Loading the bundle is how you use this design system.** Every Design Component you build must load `_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/_ds_bundle.js` in `<helmet>` (include it in child DCs too — de-duped by URL) and compose with its components — do not recreate those components from scratch or restyle raw HTML to look like them. At the top of the template:

```html
<helmet>
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/fonts.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/colors.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/color-palette.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/typography.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/spacing.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/borders.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/elevation.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/layout.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/form-elements.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/tabular-data.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/tokens/base.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/components/core/core.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/components/forms/forms.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/components/data/data.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/components/feedback/feedback.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/components/navigation/navigation.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/components/layout/layout.css">
  <link rel="stylesheet" href="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/styles.css">
  <script src="_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e/_ds_bundle.js"></script>
</helmet>
```

Then mount any component directly in the template — no logic class needed:

```html
<x-import component-from-global-scope="BushidoDesignSystemIBJJF_389963.Button" hint-size="auto,40px">Label</x-import>
```

Props are template attributes (kebab → camelCase); template children pass through as `props.children`. The linked stylesheet(s) carry the design tokens (colors, type, spacing) — style against those via `var(--*)` and the design system's classes rather than guessing values.

**Start from a template if one matches.** Before building from scratch, check whether a template below matches the user's request. Read the template (list its folder, `read_file` the entry) and decide: if it's close to what's asked, `copy_files` the folder as your starting point; if you'd rather re-author in DC, `dc_write` a new page using the template as your structural reference. When this design system is bound, `copy_files` repoints the copied `ds-base.js` automatically — only edit its base line yourself if the copy result says so, or when copying from an unbound project (change `'../..'` to your `_ds/bushido-design-system-ibjjf-38996378-a1a9-4400-b089-cc07f4b2dd5e` path). (Older templates have no `ds-base.js` and carry `../../…` bundle/stylesheet refs in their pages instead — repoint those by hand.)

- `Console page` (`/projects/38996378-a1a9-4400-b089-cc07f4b2dd5e/templates/console-page/`) — IBJJF admin console page — sidebar, navbar, page header, filters and data table

The full design-system source tree lives at `/projects/38996378-a1a9-4400-b089-cc07f4b2dd5e/` — use `list_files` / `read_file` from there for anything not under `_ds/` (layout varies by brand; don't assume folder names). Its guide is reproduced below so you don't need to fetch it:

<design-system-guide>
# Bushido Design System

&gt; Bushido (武士道), "the way of the warrior", is the IBJJF's name for its shared code of colors,
&gt; spacing, typography and component behaviour. This project is the design-agent form of that system.

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
component takes a bare Font Awesome name: `&lt;Icon name="circle-check" /&gt;`.

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

</design-system-guide>
</attached-skill>

## Assistant

_[tool: read_file]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

Building the new app as a fresh DC (keeping ConsolePage as prior work).

_[tool: dc_write]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the print page-1 plan layout and the checkbox tick visibility:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the print page scaling + larger print-mode plan labels, and drop the dead lifecycle hook:

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: save_screenshot]_

_[tool: dc_html_str_replace]_

_[tool: save_screenshot]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: delete_file]_

_[tool: ready_for_verification]_

Built `JJCon Ops.dc.html` as a new file (ConsolePage stays intact) with the three screens the brief prioritised:

- **Prep dashboard** — summary strip computed from the data (18/24 floorplans, 11/24 material lists, 6 blocked), readiness matrix grouped by sector type, prep chips per content block (outline/hatch/solid + distinct icons so grayscale still reads), search, owner filter, incomplete-only, row selection with bulk actions, and a per-row jump to field or print view. Cells open that block for the sector.
- **Field view** — iPhone frame with sector index (grouped, search, my-sectors-only, build chip + lead + material progress) and Type 1 detail: Floorplan / Materials / Instructions. The floorplan is a top-down schematic with seven toggleable layers, zoom controls; materials are tappable 56px rows split Main / Computers & network with a progress bar; instructions are numbered steps with checkboxes, a photo slot on two steps, and a Need help block.
- **Print packets** — batch rail (select sectors, page count) plus a three-page Letter preview: page 1 floorplan at 1:100 with the full legend printed, page 2 material checklist with blank "qty received" column and signature lines, page 3 numbered instructions with a sign-off line. Every page carries sector name, version, lead, page number.

Two status tracks stay distinct: prep = square chips (office only), build = pills (phone only).

Not yet built: Screen 2 edit mode, and the Type 2 / Truss / Truck / Staff / Goodie / Sponsors tab sets — say the word and I'll add edit mode next.

## User

Found issues — fixing…

## User

Found issues — fixing…

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: grep]_

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the template side: per-page rows, title, and the signature block on the last material page.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

Material lists now paginate. Registration & Check-in prints four pages (plan, materials, materials continued, instructions) with no overflow — measured 1056/1056 on every page. The signature row sits on the last material page, continuation pages carry a "list continues" line and the repeated header, page counters read the real count ("Page 3 of 4"), and the batch total sums per-sector pages (3 sectors · 10 pages).

## User

Three changes to the existing design, plus one new screen.

1. RENAME
Change the app name everywhere to "JJCON SetUp" — nav, headers, print packet headers,
and the browser title.

2. REMOVE NAV ITEMS
Delete "Registrations", "Bracket", and "Results" from the main navigation. This app is
only about physical setup, not the competition itself. Keep the remaining nav focused on
setup: Prep Dashboard, Sectors, and Print Packets.

3. NEW SCREEN — DESKTOP SECTOR DETAIL (read view)
On the Prep Dashboard, clicking any sector row or cell opens a full sector page. This is
the desktop counterpart to the mobile sector screen — same content, laid out for a wide
display, and read-first rather than edit-first.

Layout:
- Full-width header: sector name, category, prep status per content block, build status,
  assigned lead, day/time window, and an "Edit" button that switches into edit mode.
- Left column (about two-thirds): the floorplan, rendered large. Layer toggles sit in a
  panel beside the plan rather than in a dropdown, so every layer is visible at once —
  tables, chairs, stations, computer network, sign banners, power drops, extension cords.
  Legend always visible.
- Right column: the material list as a proper table (item, quantity, status, note) with
  its progress bar at the top. Below it, the instructions as a numbered list.
- No tabs on desktop. Everything on one scrolling page, because a laptop has the room and
  staff planning the setup want to compare the floorplan against the material list side by
  side instead of switching between them.
- A "Print packet" button in the header, and a line showing whether the current content
  has changed since the packet was last printed.

Apply this same desktop page to every sector category, with the content blocks each one
actually has:
- Type 1: floorplan, main materials, computers & network materials, instructions
- Type 2: floorplan, information, installation
- Truss: signage floorplan, reference images, setup instructions
- Truck Unload: floorplan, instructions
- Staff: Google Sheet link for check-in/check-out, instructions
- Goodie Bag: floorplan (tables and assembly stations), materials, instructions
- Sponsors: instructions only

4. WHO USES DESKTOP
Update the assumption that desktop is office-only. Two groups use the wide layout:
office staff planning the setup in advance, and some setup staff working on laptops at
the venue during build-out. So the desktop sector page has to work both as a planning
reference and as a live working view — material checkboxes must be checkable directly
from desktop, not just from mobile.

## Assistant

_[tool: read_file]_

Rename + navigation first:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: grep]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the desktop sector-page data in `renderVals`:

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

Now the new desktop sector page:

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: delete_file]_

_[tool: ready_for_verification]_

All four changes are in.

**Rename** — sidebar, navbar brand, browser title and the print footer now read JJCON SetUp. The event name (Jiu-Jitsu Con 2027) stays on the packet header, since that's the event rather than the app.

**Nav** — Registrations, Brackets and Results are gone. Navbar and sidebar both carry Prep dashboard, Sectors, Print packets; Field view sits under an "On site" group.

**Desktop sector page** — clicking a sector name or any prep cell opens it. Full-width header with build status, lead, owner, window, prep status per block, and a packet-freshness line ("Content changed 14 Aug, after the packet was printed 12 Aug"). Left two-thirds: large floorplan with the layer/legend panel permanently beside it and zoom. Right third: material table (checkbox, item, qty, status, note) with progress bar, then numbered instructions. No tabs, one scrolling page. Category rules applied — Type 2 swaps materials for an Information panel and calls the steps Installation, Truss adds a reference-image grid and renames the plan Signage floorplan, Truck Unload drops materials, Staff shows the Google Sheet card with no floorplan, Sponsors is instructions only in a single column.

**Desktop as a working view** — material rows and instruction steps are checkable directly on desktop and share one state with the phone, so a laptop at the venue and a phone on the floor stay in sync. Edit turns prep statuses into selects and quantities into inputs, with an unsaved-changes bar and Save/Cancel.

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: delete_file]_

_[tool: ready_for_verification]_

All three fixed:

- Packet-status line now uses ink text (danger red 5.79:1 for "reprint", neutral for current) with the amber/green icon carrying the state.
- Mobile "material list not started/in draft" note uses defined tokens: neutral-500 text, warning-500 icon.
- Sector page columns are a wrapping flex row (3 1 520px / 2 1 420px), so below ~960px they stack full width. At the preview width the material item cell measures 377px instead of 87px, and the plan keeps its layer panel beside it when there's room.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Subhead now reads "Black and white, one packet per sector: floorplan, material list and instructions" — no fixed page count.

## User

Two changes to the desktop sector page (the page that opens when you click a sector on
the Prep Dashboard).

1. FLOORPLAN FIRST, FULL WIDTH, NO SCROLLING
Drop the two-column layout. Stack the page instead:

- The floorplan card sits at the top, full width, and must fit entirely within the
  viewport on a normal laptop screen — the whole plan visible at a glance, without
  scrolling and without the user having to pan or zoom to see it. Size the plan to fill
  the available height, with the legend beside it inside the same card.
- The material list card sits directly below the floorplan card.
- The instructions card sits below the material list.

Someone opening a sector should see the complete floorplan first and scroll only when
they move on to materials and steps.

2. UP TO FOUR SEPARATE FLOORPLANS PER SECTOR
Replace the single floorplan with layer toggles. A sector can have up to four distinct
floorplans, each its own drawing, kept deliberately apart rather than stacked as layers
on one plan:

- Tables, Chairs & Stanchions
- Computer Network
- Sign Banners
- Power Drops & Extension Cords

Not every sector needs all four. Each sector declares which of the four it requires, and
the rest of the app counts and displays against that required set — never against four by
default. A sector that requires two plans and has both drawn is complete and must read as
complete. Plans a sector doesn't require are shown as not applicable, visually distinct
from a required plan that's still missing. Make setting the required plans part of the
sector's setup in edit mode.

Design the floorplan card to hold this set:
- A selector at the top of the card to switch between the plans this sector requires.
  Required plans with no drawing yet are clearly marked as missing rather than hidden —
  office staff need to see the gap. Plans the sector doesn't require are either omitted or
  greyed out as not applicable.
- The selected plan renders full-size in the card, fitting the viewport as described above.
- Each plan carries its own prep status (Not started / Draft / Ready / Approved), shown on
  the selector so readiness per plan is visible without clicking through.

Update the rest of the app to match:

- Prep Dashboard: keep a single Floorplan column rather than splitting it into four —
  with this many sectors, four columns makes the matrix too wide to scan. Instead, the
  Floorplan cell shows a rollup: a count of ready plans over required plans (e.g. "2/2",
  "1/3"), plus a compact segmented indicator with one segment per required plan, so a
  missing drawing is visible at a glance without reading the number. A sector requiring
  two plans shows two segments, not four. Clicking the cell expands that row in place to
  reveal its required plans by name with their individual statuses, each linking straight
  into edit mode for that plan. Only one row expands at a time. The summary strip above
  counts required plans across all sectors, not sectors and not a flat four per sector.
- Edit mode: choose which plans the sector requires, then upload and set status per plan.
- Print packet: each required floorplan prints on its own page, full page, with its own
  legend and its name in the page header.
- Mobile: the Floorplan tab gets the same selector, limited to required plans, sized for
  a phone.

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Now the model change — separate plans per sector:

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: read_file]_

Now the stacked, floorplan-first layout with the plan selector:

_[tool: dc_html_str_replace]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the print packet plan pages:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: run_script]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

Both changes are in.

**Sector page, stacked and floorplan-first** — one column: floorplan card, then material list, then instructions (info/reference-image/staff cards sit between plan and steps). The plan scales to fit its box automatically (`min(640px, 100vh − 390px)`), so the whole drawing is visible without panning or zooming; the legend sits beside it in the same card. Zoom controls are gone from desktop.

**Four separate plans** — Tables/Chairs & Stanchions, Computer Network, Sign Banners, Power Drops & Extension Cords. Each sector declares its required set and each plan carries its own prep status. The card's selector shows all four: required ones with their status chip, missing ones flagged "No drawing" in red, non-required greyed as Not applicable. On the non-furniture sheets, tables and stations render as grey context outlines with a legend note, so a network or power sheet still reads as a place.

Counting is against the required set everywhere: the summary strip totals required plans (not sectors, not four per sector), the dashboard keeps one Floorplans column showing "2/3" plus one segment per required plan, and clicking it expands that row alone to list the plans by name with status and an "Edit plan" link into edit mode. Podium requires three and has three, so it reads 3/3 complete.

Edit mode toggles Required per plan and sets status per plan, with the unsaved-changes bar. Print packets give each required plan its own full page with its own legend and its name in the page header — Registration now prints 7 pages (4 plans, 2 material, 1 instructions). The phone's Floorplan tab has the same selector, limited to required plans.

## User

One addition: floorplans are uploaded PDF files.

They are not drawn in the app. Office staff produce them elsewhere and upload a PDF per
plan, and the app renders that file. Update the design accordingly:

- Edit mode: a PDF upload area per plan — drag-and-drop or file picker, PDF only, with
  upload progress, a thumbnail once it lands, and the file name, size, and upload date
  beneath it. Replacing a plan means uploading a new PDF over the old one, so show the
  previous file's date to make it obvious whether what's displayed is current.
- Floorplan card: render the uploaded PDF scaled to fit the card completely, full page
  visible by default, with zoom and a "fit to page" reset for inspecting detail, plus a
  download button for the original file. If a PDF has more than one page, show page
  navigation and a page count inside the card.
- The legend is already part of the drawing inside the PDF, so the app does not render a
  separate legend panel beside it.
- Empty state for a required plan with no file yet: name the plan, say no PDF has been
  uploaded, and show who owns it.
- Print packet: each required floorplan prints as its own full page taken from the
  uploaded PDF, with the plan name in the page header.
- Mobile: the Floorplan tab renders the PDF fit to the phone screen with pinch-zoom.

## Assistant

_[tool: read_file]_

_[tool: grep]_

Floorplans become uploaded PDFs — the legend moves inside the sheet, and the card gets viewer chrome.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the renderVals wiring for desktop, mobile and print:

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the templates — desktop card, edit uploads, mobile and print:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the print plan page:

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: eval_js]_

`planItems` is still referenced in the returned object.

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: grep]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

Floorplans are now uploaded PDFs throughout.

**Floorplan card** — a PDF viewer: file name, size and upload date in the toolbar, page nav when the file has more than one page ("Page 1 of 2"), zoom, "Fit to page", and Download PDF. The rendered sheet carries its own title block and legend inside the drawing, so the separate legend panel is gone. Registration's furniture and power plans are two-page files; page 2 shows the detail sheet.

**Edit mode** — one drop zone per required plan: drag-and-drop or click, PDF only, progress bar while uploading, then a thumbnail with file name, size, page count and upload date, plus "Replaced the file uploaded 02 Aug 2027" so it's clear whether what's displayed is current. Uploading over a plan sets it back to draft until someone releases it.

**Empty state** — names the plan, says no PDF has been uploaded, and names the owner ("Owner M. Alvarez has to upload this plan before load-in").

**Print** — every required plan prints its own full page from the PDF with the plan name in the header and the file line beside it; multi-page PDFs print each page. Registration's packet is now 9 pages.

**Mobile** — the Floorplan tab renders the sheet fit to the phone with pinch-zoom, a Fit button, and page nav for multi-page files.

The rendered sheets are still schematic stand-ins for the real uploaded drawings — drop actual PDFs in and they'd replace what the viewer shows.

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: grep]_

Source is correct — the preview was running a stale build.

_[tool: show_html]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

Fixed — the preview had been serving a stale build, which masked the change.

The plan viewer is now a block scroll container with the wrapper sized to the scaled sheet (`margin: auto` for centering) and the transform on an inner layer at `transform-origin: top left`:

- Fit to page: scrollWidth/Height equal clientWidth/Height — no scrollbars, nothing to drift.
- At 102%: scroll range 900×692 matches the scaled drawing, `scrollLeft/Top = 0` puts the sheet's top-left exactly at the box origin, and the right and bottom edges are reachable.

## User

Two refinements to the Prep Dashboard.

1. Remove the secondary line beneath each sector name — the place, date, and measurements.
   The sector name alone is enough on this screen; that detail belongs on the sector page,
   not in the readiness matrix. Leave the sector name as the only text in that cell.

2. With that line gone, tighten the rows: reduce the row height so each sector is a single
   compact line, trim the vertical padding to match, and keep the status chips and
   floorplan rollup vertically centered against the shorter row. The goal is a denser
   matrix where more sectors fit on screen at once and the eye can scan straight down a
   status column without long gaps between rows.

Keep the type size of the sector name as it is — this is about removing a line and
tightening spacing, not shrinking the text.

## Assistant

_[tool: grep]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: ready_for_verification]_

Sector cells now hold the name alone (place/date/measurements removed — they're still on the sector page), and cell padding dropped from 8px to 3px so each sector is one compact line with the chips and floorplan rollup centered against it.

One related change: I also removed the small sub-line under the Material list and Instructions chips ("awaiting sign-off", "partial"), since it would otherwise keep those cells two lines tall and cancel the density gain. Say the word if you want it back.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now silencing the two unresolved-hole warnings on group/expand rows:

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

Fixed the real cause: table `min-width` raised to 1210px, Sector column given `min-width: 300px`, and the name/chip row set to `nowrap` so the build and blocked chips stay on the sector name's line. Rows should now sit at ~39px at any viewport, with the existing horizontal scroll absorbing the width.

## User

Add a new page called TASKS to JJCON SetUp, in the main navigation alongside Prep
Dashboard and Sectors. Desktop-first — this is an office planning view.

WHAT IT IS
The Prep Dashboard answers "how ready is each sector?" TASKS answers "who owes what, and
when?" Same underlying work, viewed as a flat list of assignments across every sector
instead of a per-sector matrix.

THE LIST
One row per item, with these columns:
- SECTOR — the sector the item belongs to
- ITEM — what has to be prepared (e.g. Material List, Instructions, Installation, and one
  row per required floorplan: "Floorplan — Tables, Chairs & Stanchions", "Floorplan —
  Computer Network", and so on, so a late drawing is identifiable by name rather than
  hidden inside a single Floorplan row)
- STATUS — Done or Not done
- DEADLINE — the date the item is due
- RESPONSIBLE — the person who owns it

Only items a sector actually requires appear as rows. A sector that needs two floorplans
produces two floorplan rows, not four.

Rows are sortable by any column, and default to deadline ascending so the next thing due
is at the top. Overdue rows — not done, deadline in the past — are visually distinct at a
glance, with the deadline itself carrying the emphasis rather than the whole row
screaming. Show how late in plain terms ("4 days late"). Items due soon but not yet late
get a lighter treatment of the same idea.

FILTERS
A filter bar above the list: by Person, by Sector, by Item type, and a toggle for Late
only. Filters combine, the active ones stay visible as removable chips, and the row count
updates ("38 of 112 items"). Include a quick "my tasks" shortcut that filters to the
current user.

SUMMARY STRIP
Above the filters: total items, done, not done, and overdue — with overdue given the most
weight, since that's the number the office looks at first.

INTERACTION
- Checking a row's status marks the item done and records who marked it and when; show
  that on the row.
- Clicking the sector or item name opens that sector's page, scrolled to the relevant card.
- Deadline and responsible person are editable inline, without leaving the list.
- Allow selecting several rows to reassign an owner or shift a deadline in one action —
  useful when someone leaves or a build day moves.

Empty states worth designing: a filter combination that matches nothing, and the
all-clear state when nothing is overdue.

## Assistant

_[tool: grep]_

_[tool: read_file]_

Adding a Tasks screen. First the logic:

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the nav entries and the Tasks screen markup:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the card refs on the sector page so item links scroll to the right card:

_[tool: run_script]_

_[tool: dc_js_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: get_webview_logs]_

_[tool: ready_for_verification]_

Tasks is in the sidebar and navbar, between Prep dashboard and Sectors.

**The list** — 89 rows, one per required item: a row per required floorplan named individually ("Floorplan — Computer Network"), plus the material/information/reference-images row and the instructions/installation row each sector actually has. Sponsors and Truck Unload produce fewer rows accordingly. Every column sorts; default is deadline ascending.

**Lateness** — the deadline cell carries it: red border and bold mono date plus "3 days late" under it; amber border and "due in 2 days" / "due today" for the near ones. The row itself stays neutral.

**Filters** — person, sector, item type, Late only, and a My tasks shortcut (R. Tanaka is the signed-in user). Active filters appear as removable chips with Clear all, and the count reads "15 of 89 items".

**Summary** — items required, done, not done, and overdue set at 44px in danger red.

**Interaction** — checking a row marks it done and stamps "R. Tanaka · just now" under the status; sector and item names open that sector's page with the relevant card scrolled into view (a floorplan row also selects that plan); deadline is a date field and responsible a person select, both editable in the row; multi-select drives reassign-to and shift-by-3/7-days in one action.

**Empty states** — no-match with a Clear filters action, and an all-clear "Nothing is overdue" with a success mark when the late filter finds nothing.

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: grep]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: get_webview_logs]_

_[tool: ready_for_verification]_

All three fixed:

**Scroll-to-card** now works — clicking "Material list" on the Registration row scrolls to 1128 and lands the card 12px below the top; instructions rows land their card too; a sector-name click goes to the top. Two causes, not one: the runtime doesn't invoke `componentDidUpdate`, and instance arrow-properties aren't re-bound, so the scroll is now a prototype method fired from the click handler, retrying until the card's ref is connected, walking up for a real scroll container and falling back to `document.scrollingElement`.

**Due-soon note** is now neutral-500 text (12.6:1) with the amber icon carrying the state, matching the packet-status pattern. Overdue stays danger red.

**Marked-by line** moved to neutral-400 (7.5:1).

## User

Found issues — fixing…

## Assistant

_[tool: eval_js]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

Header fixed at the flex level rather than with pixel nudges: the sector page's info column now declares `flex: 1 1 440px; min-width: 0` and the actions slot `flex: 0 0 auto; flex-wrap: wrap; margin-left: auto`, so the meta row can no longer share a band with the buttons. Checked on Sponsor Signage Pack and on Registration & Check-in (longest meta) at 419–839px content width — no overlap at any of them; the actions drop below the meta as the header wraps.

## User

One refinement to the Prep Dashboard.

The status chips (Not started, In progress, Complete) are not aligned down the column —
because the labels are different lengths, each chip sizes to its own text and the column
reads as ragged. Fix the alignment:

- Give every status chip the same fixed width, sized to the longest label, so the chips
  form a clean vertical column with their left and right edges lined up row to row.
- Align the chip text consistently within that fixed width — centered — and keep each chip
  vertically centered in its row.
- If a status dot or icon sits inside the chip, keep it at the same horizontal position in
  every chip so the dots line up down the column too.
- Apply the same treatment to every status column on the page, so all of them align with
  each other and not just within themselves.

The result should be that someone scanning straight down a status column sees a single
straight edge, with only the color and label changing row to row.

## Assistant

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

Status chips are now fixed-width with a two-track grid — a 12px icon slot at a constant left inset, label centered in the rest — so the icons line up as one column and the labels sit centered under each other.

Measured down the dashboard:
- Material list chips: left 1054, width 118 on every row.
- Instructions chips: left 1214, width 118 on every row.
- Build pills: left 586, right 710, width 124, icon at 596 on every row — they were ragged because they trailed the variable-length sector name, so they're now pinned to the right edge of the Sector column with the Blocked flag moved ahead of them.

The same `chip()` and `buildTag()` builders feed the legend, the sector page's prep row, the expanded plan list and the phone cards, so those pick up the fixed width too.

## User

Move the summary strip that currently sits above the matrix on the Prep Dashboard over to
the TASKS page.

- Remove it from the Prep Dashboard entirely. That page starts directly with the readiness
  matrix — the matrix already shows readiness sector by sector, so the counts above it are
  redundant there.
- Place it on the TASKS page, above the filter bar, merged with the summary strip already
  planned for that page rather than stacked as a second row of numbers. One strip, one set
  of counts.
- Where the two overlap, keep a single figure rather than showing the same thing twice —
  and keep overdue the most prominent number in the strip, since that's what the office
  checks first.
- Counts follow whatever filters are active on TASKS, with the unfiltered total still
  visible so the denominator doesn't disappear when someone filters to one person.

Everything else on both pages stays as it is.

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

Now removing the strip from the Prep Dashboard:

_[tool: read_file]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: grep]_

_[tool: read_file]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

The Prep Dashboard now opens straight onto the filter row and matrix — the strip and its data are gone.

Tasks carries one merged strip above the filters, four cells, no duplicated figures:

- **Overdue** — 44px danger, the dominant number, "past deadline, not done".
- **Not done** — with "7 sectors blocked · nothing started" carried over from the old strip as its sub-line.
- **Done** — with the three former per-type readiness counts folded in as a sub-line: "Floorplans 28/45 · Materials 9/20 · Instructions 14/24".
- **Items in view** — plus how many sectors are represented.

Every cell reads "n of N": the big figure follows the active filters, the muted denominator stays at the unfiltered total. Filtering to R. Tanaka gives "0 of 11 overdue · 15 of 89 items · 4 of 24 sectors".

## User

Check didn’t complete

## Assistant

_[tool: eval_js]_

_[tool: get_webview_logs]_

The verifier subagent dropped out without reporting, so I re-checked directly: Tasks renders with the merged strip and all 89 rows, the Prep Dashboard opens on the matrix, and the console has only the two known benign hole warnings — nothing broken.

This is a good stopping point. Note that the usage limit for this session is nearly reached (91%); say the word if you want me to keep going.

## User

keep going

## Assistant

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: get_webview_logs]_

Remaining gap from the brief: the phone still shows Type 1 tabs for every category. Let me make the mobile tab set vary by sector type.

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the template branches inside the second tab:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

All six category tab sets are correct on the phone. Checking the two new tab bodies render:

_[tool: eval_js]_

_[tool: ready_for_verification]_

Closed the last open gap from the brief: the phone's tab set now varies by sector type instead of showing Type 1 tabs everywhere.

- Type 1 / Goodie Bag — Floorplan | Materials | Instructions
- Type 2 — Floorplan | Information | Installation, with the Information tab as a label/value list (supplier, product, coverage, underlay, removal)
- Truss — Signage plan | Reference | Setup steps, Reference being a captioned photo grid
- Truck Unload — Floorplan | Instructions
- Staff — Check-in | Instructions, the Check-in tab a large Google Sheets link with a payroll note
- Sponsors — Instructions only, no tab bar

If the active tab doesn't exist for a sector, it falls back to that sector's first tab, so switching between categories never lands on an empty screen.

## User

Rework the summary strip on the TASKS page to match the style of the old Prep Dashboard
strip, but limited to three counts.

STYLE — follow the old strip exactly:
- A single horizontal card divided into equal-width panels by thin vertical dividers.
- Each panel: a large bold number in the primary blue, followed by a smaller, lighter
  "of N" total on the same line; beneath it a small uppercase label in letter-spaced grey;
  beneath that a thin full-width progress bar showing the ratio, filled in the same blue
  on a light grey track.
- Same generous padding, same rounded card, same restrained look. Numbers do the talking.

CONTENT — three panels only:
1. FLOORPLANS READY · REQUIRED PLANS — ready floorplans over the total required across all
   sectors, counting each required plan separately, not one per sector.
2. MATERIAL LISTS READY — ready material lists over total sectors that require one.
3. INSTRUCTION SETS READY — ready instruction sets over total sectors that require one.

Drop the fourth "blocked sectors" panel and anything else. Three panels, evenly divided
across the full width.

PLACEMENT AND BEHAVIOR
Sits at the top of the TASKS page, above the filter bar. Counts respond to the active
filters, so filtering to one person shows that person's numbers — with the unfiltered
total still readable so the denominator doesn't vanish.

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

The Tasks strip is now the old Prep Dashboard strip: one rounded white card, three equal panels (208px each) split by thin dividers, each with a 28px mono number in primary blue, a lighter "of N" beside it, an uppercase letter-spaced grey label, and a 4px blue progress bar on a grey track.

Unfiltered it reads 28 of 45 floorplans (counting required plans individually), 9 of 20 material lists, 14 of 24 instruction sets. Filtering to R. Tanaka gives 9 of 9 / 3 of 3 / 3 of 3, with the unfiltered total kept on a small mono line under each bar so the denominator stays readable.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

Fixed at the constraint: each panel is now a flex column with the label wrapper set to `flex: 1`, so the bar and total line pin to a shared bottom regardless of whether the label wraps to one line or two. Also tightened the label to `line-height: 16px`, which brings the card back near the old strip's proportions.

Measured: all three panels 208×162, bar top at 90 and total line at 100 in every panel.

## User

Change the default sort on the TASKS page.

Before any filter or sort is applied, the list should follow the same sector order as the
Prep Dashboard, top to bottom — the sector grouping and sequence on that page is the
order the office thinks in, and the two screens should read consistently. Within each
sector, list that sector's items in a fixed order: floorplans first (in their standard
order: Tables, Chairs & Stanchions, then Computer Network, then Sign Banners, then Power
Drops & Extension Cords), then Material List, then Instructions.

Do not default to deadline order. Deadline remains available as a sort the user chooses,
along with the other columns, and any sort the user applies overrides this default until
they clear it. Give them a way to return to the default order — a "Sector order" option in
the sort control, or clearing the active sort.

Filtering does not change the order: a filtered list still reads in sector order, just
with fewer rows.

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

Tasks now defaults to sector order — the same grouping and sequence as the Prep Dashboard (Type 1 → Type 2 → Truss → Truck Unload → Staff → Goodie Bag → Sponsors, sectors in dashboard order), and within each sector: the four floorplans in standard order, then Material list, then Instructions.

A "Sector order" button sits in the filter row, greyed out while the default is active and turning primary once a column sort is applied; clicking it returns to the default. Column sorts still work and override until reset, and they use sector order as their tiebreak rather than deadline. Filtering leaves the order untouched — just fewer rows.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

"Sector order" is now the design-system `Button` (small, neutral, `list-ol` icon) — 8px radius, Roboto Condensed 12/500, matching "Late only" beside it.

It also follows the state-control pattern rather than being disabled: filled while the list is in sector order, outlined and clickable once a column sort is active, so it reads as "this is the current order" instead of unavailable.

