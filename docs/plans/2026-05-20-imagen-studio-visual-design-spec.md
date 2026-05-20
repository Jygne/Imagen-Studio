# Imagen Studio Visual Design Spec

Date: 2026-05-20
Status: Active baseline
Scope: `Local Generate`, `Sheet Generate`, `Seg Generate`, `Runs`, and all future workflow pages

## Purpose

This document defines the visual baseline for Imagen Studio going forward.

It is based on the current design language of:

- `Local Generate`
- `Sheet Generate`
- `Seg Generate`
- `Runs`

It also incorporates the product direction shown in the preferred reference screenshot:

- cleaner
- calmer
- less redundant
- task-first instead of dashboard-first

From this point on, new pages and redesigns should follow this document unless we explicitly revise the spec.

## Product Feel

Imagen Studio should feel like a focused production console:

- dark, warm, and technical
- sharp but not noisy
- dense enough for operators, but never cluttered
- precise in hierarchy, with one obvious action at a time

The UI should not feel like a generic analytics dashboard.
It should feel like a controlled workstation for running image workflows.

## Canonical References

Use these pages as the primary visual references:

- [LocalGeneratePage.tsx](/Users/jingru.liu/Desktop/Imagen-Studio/frontend/src/features/local-generate/components/LocalGeneratePage.tsx)
- [SheetGeneratePage.tsx](/Users/jingru.liu/Desktop/Imagen-Studio/frontend/src/features/sheet-generate/components/SheetGeneratePage.tsx)
- [SegGeneratePage.tsx](/Users/jingru.liu/Desktop/Imagen-Studio/frontend/src/features/seg-generate/components/SegGeneratePage.tsx)
- [RunsPage.tsx](/Users/jingru.liu/Desktop/Imagen-Studio/frontend/src/features/runs/components/RunsPage.tsx)
- [globals.css](/Users/jingru.liu/Desktop/Imagen-Studio/frontend/src/app/globals.css)
- [AppShell.tsx](/Users/jingru.liu/Desktop/Imagen-Studio/frontend/src/shared/components/layout/AppShell.tsx)
- [TopBar.tsx](/Users/jingru.liu/Desktop/Imagen-Studio/frontend/src/shared/components/layout/TopBar.tsx)

## Core Design Principles

### 1. One page, one primary job

Each page should answer one main question:

- `Local Generate`: what folder am I running, and what will be generated?
- `Sheet Generate`: is the sheet ready, and what rows will run?
- `Seg Generate`: what inputs are queued, and can I start?
- `Runs`: what happened, and where do I inspect details?

If a block does not help the user make that page's main decision, it should be removed, collapsed, or moved elsewhere.

### 2. Progressive disclosure

Show information in this order:

1. page title and page purpose
2. required setup or readiness status
3. core configuration
4. preview or result
5. secondary detail only when needed

Do not present all metadata at the same visual level.

### 3. Minimal duplication

The same fact should not appear in multiple places on the same screen unless it changes meaning.

Examples of bad duplication:

- showing the same checked count in a top KPI row and again in a secondary summary row
- showing sheet URL in both a control card and a separate info card when only one is needed
- repeating "service account configured" in both a badge and a dedicated panel without adding action value

### 4. Action-first layout

The primary action must always be visually obvious:

- one dominant CTA per page
- secondary actions shown as border buttons
- tertiary actions shown as inline links or icon buttons

### 5. Operational calm

The interface should feel stable when idle:

- avoid excessive color blocks
- avoid too many badges in one row
- avoid warning or error styling for zero-value states unless there is an actual problem

## Layout System

## Global Shell

- sidebar width: `248px`
- top bar height: `52px`
- main content padding: `32px`
- standard inter-card gap: `16px`

This should remain consistent across workflow pages.

## Page Header

Every page starts with:

- title: `text-2xl`, semibold
- one-line supporting description below it
- optional right-side control only if it changes page mode

Allowed right-side header controls:

- workflow toggle
- refresh button
- lightweight action switch

Disallowed:

- large KPI ribbons above the working area on utility pages
- multiple control groups competing with the page title

## Page Archetypes

### A. Workbench page

Used by `Local Generate`, `Sheet Generate`, `Seg Generate`.

Structure:

- left: configuration and primary action
- right: preview, queue, or progress

This is the preferred pattern for workflow execution pages.

### B. Monitor page

Used by `Runs`.

Structure:

- summary row at top
- one large result table below
- details in drawer or modal

This is the preferred pattern for history, monitoring, and inspection pages.

### C. Utility lookup page

Used by `BB Search` and similar tools.

Structure should be closer to `Sheet Generate` than to a dashboard:

- left: search controls
- right: result preview or result table
- optional single summary row only if it materially affects action

It should not look like a multi-layer KPI dashboard.

## Surface Hierarchy

### Background layers

Use the existing palette:

- page base: `#1A1815`
- top bar / shell chrome: `#211E1B` family
- card surface: `bg-bg-surface`
- input surface: `bg-bg-input`

### Surface rules

- top-level cards: `rounded-xl`, bordered, subtle depth
- inputs: rounded, clearly inset, lower contrast than cards
- hover states: restrained, usually `bg-bg-hover`
- do not stack too many nested bordered boxes inside a single card

### Card usage

Use cards for:

- configuration blocks
- status blocks
- previews
- tables
- run detail sections

Do not use cards for:

- every single metric on utility pages
- metadata that can live inline
- decorative grouping with no functional payoff

## Typography

The current product uses a technical mono-first language.
That should remain the brand signature.

### Type roles

- page title: strong, large, human-readable
- card title: compact, semibold
- field label: uppercase, very small, tracked
- body copy: muted, compact
- table text: small, legible, low-noise
- LCD numbers: only for high-signal metrics

### LCD usage rules

The `lcd` treatment is special and should be used sparingly:

- good use: run counters, total processed, summary counts in `Runs`
- acceptable use: a single important metric group on task-monitor pages
- bad use: every number on the page

If everything is styled like an instrument reading, nothing feels important.

## Color Usage

### Accent

Accent orange is the primary action color.

Use it for:

- primary CTA
- active toggle state
- important but non-dangerous highlight
- sparse metric emphasis

Do not use accent as a blanket fill for many cards on the same screen.

### Status colors

- success green: positive completion, valid status, confirmed ready state
- warning amber: caution, skipped state, attention needed
- error red: actual problem, failed run, broken validation

Rules:

- zero is not automatically an error
- zero-count metric cards should stay neutral unless the absence is itself a failure
- reserve red backgrounds for true exceptions

## Component Patterns

## Status block

The `Sheet Generate` connection block is the preferred pattern:

- compact list rows
- icon + label + brief detail
- one configure link
- one refresh control

This is better than turning readiness into multiple large metric cards.

## Configuration block

The configuration card pattern should remain:

- section title
- tight vertical spacing
- uppercase labels
- full-width inputs
- 2-column layout only for paired low-complexity fields

Avoid:

- splitting related settings into too many separate cards
- showing setup metadata inside the same visual layer as editable controls

## Preview block

Preview panels should be compact and actionable.

Allowed forms:

- thumbnail grid
- small row preview table
- active run progress block

Preview should answer:

- what will run
- how many items are involved
- what is the current state

It should not become a second full dashboard.

## Table pattern

`Runs` is the reference table pattern:

- one strong container
- subtle header background
- compact row height
- muted labels
- interaction revealed on hover or selection

Tables should prioritize scanability over decoration.

## Detail panel pattern

Detailed metadata belongs in:

- a drawer
- a modal
- a secondary view

It should not sit in the main scan path unless the page is explicitly for auditing.

## Information Density Rules

These rules are the most important for future redesigns.

### Always show

- page title
- one-line page purpose
- core controls needed to complete the task
- one preview or result area
- one primary action

### Show only when useful

- progress counts
- run status
- setup detail
- raw IDs
- raw URLs
- extended metadata

### Hide or collapse by default

- repeated connection information
- repeated KPIs
- long raw spreadsheet URLs in the main visual path
- zero-value stat groups that do not help a decision
- decorative eyebrow labels if the page is already visually busy

## Anti-Patterns

The following should be considered out of spec.

### 1. KPI overload

Too many summary cards at the top of a workflow utility page creates noise and makes the interface feel heavier than it is.

Guideline:

- `Runs` may use a 4-card summary row
- workflow pages should avoid top KPI rows unless they are actively monitoring execution

### 2. Duplicate summaries

Do not show:

- top summary metrics
- then secondary metric cards
- then tertiary info strips

for the same result set on one page.

One summary layer is enough.

### 3. Long-form metadata in first view

Long URLs, spreadsheet IDs, service-account text, and internal codes should not dominate the first viewport.

Move them into:

- compact status rows
- truncated inline values
- drawers
- hover or secondary detail

### 4. Over-signaling neutral states

A zero count with a red background implies failure.
Use neutral styling unless the zero is truly alarming.

### 5. Multiple competing emphasis styles

Avoid having all of these at once in one viewport:

- eyebrow banner
- KPI cards
- colored metric cards
- info strips
- badge clusters
- table

Pick one dominant summary pattern, not four.

## BB Search Guidance

`BB Search` should be redesigned to align with the workbench language, not the dashboard language.

Target structure:

- header with title and short description
- left control column
- right result column
- at most one compact summary band when results return
- result table as the primary reading surface

What should be reduced or removed:

- stacked KPI layers
- separate metadata cards for information already present in controls
- heavy emphasis on zero-value metrics
- repeated service account and sheet identity blocks

What should remain:

- source tab
- row range
- clear action buttons
- result list
- decision badge per result row

## Motion and Interaction

- transitions should feel quick and quiet
- hover states should be subtle
- focus rings should remain visible
- progress animation should only appear during true in-flight work

Do not add decorative motion for its own sake.

## Responsive Behavior

Desktop is the primary operating mode, but pages must degrade cleanly:

- on narrower widths, workbench pages stack vertically
- preview panel drops below controls
- tables may become card lists if needed
- primary CTA stays easy to reach

Responsive change should preserve information hierarchy, not just element wrapping.

## Implementation Checklist

Before approving any new page or redesign, confirm:

- the page has one clear primary job
- the first viewport is not overloaded
- there is only one dominant summary layer
- long metadata is not overexposed
- the primary action is obvious
- status color is semantically correct
- card count is minimized
- the page matches either the workbench pattern or the monitor pattern
- `BB Search`-style utility pages do not drift into analytics-dashboard territory

## Adoption Rule

This document is now the default visual spec for Imagen Studio.

Future design or frontend adjustments should follow this file first, then local page-specific needs.

If a new page needs to break the spec, document the reason before implementation.
