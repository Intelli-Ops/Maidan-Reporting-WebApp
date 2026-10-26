# Maidan — UI Design System
*(Canonical spec — supersedes `sports_facility_reporting_ui_spec.md`)*

## 1. Design Direction
Maidan is a reporting and operations product for padel, tennis, futsal and other sports facilities.

**North star:** a premium sports brand translated into a serious reporting instrument. Calm, editorial, spacious, precise and slightly athletic — never a generic SaaS dashboard.

**Creative concept:** *Court Lines on Chalk.*

**Quality bar, not style bar:** hold this UI to the rigor of Apple, Linear and Stripe Dashboard — their typography discipline, density, control polish and reporting hierarchy. But do **not** borrow their visual identity (system font, green/grey neutrality, no motif). Maidan has its own identity below; use those references for craft, not for look.

---

## 2. Visual Language
Use:
- Warm chalk background
- Ink typography
- Court blue for interaction
- Muted mint for positive movement
- Fine lines and subtle court geometry
- Large, intentional numbers
- Generous whitespace
- Asymmetry when it improves hierarchy
- Quiet physical motion

The interface should feel composed, not assembled from cards.

### Color

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#F4F3EC` | Main background |
| `surface` | `#FCFBF6` | Cards / panels |
| `surface-raised` | `#FFFFFF` | Modals, popovers, dropdowns — anything that floats above the canvas |
| `surface-muted` | `#EBECE5` | Secondary surfaces |
| `border` | `#D9DAD2` | Dividers |
| `border-strong` | `#C7C8BF` | Table headers, input outlines, emphasis dividers |
| `ink` | `#17201B` | Primary text |
| `ink-muted` | `#69716B` | Secondary text |
| `ink-faint` | `#9A9F97` | Tertiary text — placeholders, disabled, timestamps |
| `blue` | `#2468A8` | Primary interaction |
| `blue-dark` | `#18527F` | Hover / active |
| `blue-soft` | `#E7F0F7` | Selected state |
| `mint` | `#57B995` | Positive / healthy movement |
| `mint-soft` | `#E5F3ED` | Positive background |
| `amber` | `#C58A2B` | Warning |
| `red` | `#C75454` | Error / danger |

**Rule:** blue is the only interactive accent. Mint is reserved exclusively for positive comparisons/metrics — never used as a second "brand" color or on buttons. **Never use purple, green as an accent, neon gradients or arbitrary colors.**

---

## 3. Typography
**UI:** Inter — navigation, body, tables, controls, labels, data.
**Editorial accent:** Instrument Serif or DM Serif Display — major page headings and short italic phrases only. Never as the primary UI font, never on tables, buttons or dense controls.

```text
Page title:    30–36px / 600   (serif accent optional for the lead word)
Section title: 18–22px / 600
Body:          14–15px / 400–500
Compact:       12–13px
KPI:           28–40px / 600
Micro label:   10–11px / 600
Table text:    13–14px
```

Use tabular numerals throughout for reporting tables and aligned metrics. No oversized marketing-style headings.

---

## 4. Layout & Spacing
Desktop:
- Sidebar ~232px
- Header ~64px
- Content max-width ~1440px
- Page gutters 32–48px
- Major sections 40–64px apart

Base spacing unit **4px**; common rhythm: `8 / 12 / 16 / 20 / 24 / 32px`.

Radius:
- Controls: 8px
- Panels/cards: 10–12px
- Badges/chips: 6–8px

Borders 1px, subtle. Shadows rare and soft.

Do **not** build every screen as identical cards. Prefer:

```text
Page context
     ↓
One dominant insight
     ↓
Supporting analysis
     ↓
Detailed report / table
     ↓
Exceptions / actions
```

Use warm canvas for breathing room; use white/raised surfaces only when separation is functionally useful.

---

## 5. Navigation & Application Shell

**Sidebar** — grouped, not flat:

```text
Overview
  Dashboard
Operations
  Bookings
  Courts
  Locations
  Sports
Reporting
  Revenue
  Utilization
  Expenses
  Investor Reports
Management
  Users
  Settings
```

Keep it narrow and quiet. Active navigation: soft blue surface (`blue-soft`), blue icon, dark text, subtle indicator. Never a solid-blue block.

**Top bar:** page title, context when needed, date range, primary filters, account controls. Navigation should never be visually dominant.

**Page headers** are compact:

```text
REVENUE
Where the business is growing.
[ Jul 1 – Jul 31 ] [ All locations ] [ All sports ] [ Export ]
```

---

## 6. Filters
Filters are compact instruments, not large UI blocks.

Default row: `Date range` · `Location/Sport/Court (as relevant)` · `Compare` · `More filters`

```text
[ Jul 1–31 ] [ All locations ] [ All sports ] [ Previous period ] [ +3 filters ]
```

Rules:
- Compact 40–44px controls.
- Searchable multi-select for long lists.
- Selected filters become removable chips.
- Show active filter count.
- Include **Clear all**.
- Secondary/advanced filters open in a popover or drawer — never a permanent wall of dropdowns.
- Date presets: `Today · This week · This month · Last month · Last 30 days · Quarter · Custom`.
- Comparison: `Previous period · Previous year`.
- Filter state must be visually obvious at a glance.

**Filter drawer** groups advanced filters by category:

```text
TIME
Date range
Comparison
FACILITY
Location
Court
Sport
BOOKING
Booking type
Booking status
```

---

## 7. Metrics (KPIs)
Metrics matter, but avoid KPI-card walls. Value is dominant, label is quiet, comparison is secondary.

```text
REVENUE
PKR 4.82M
↑ 12.4%
vs previous period
```

Related KPIs may share one surface (e.g. four metrics in one row on one flat panel) rather than four separate cards. Avoid huge icons, avoid giving every metric a different color, avoid decorative metrics with no meaning.

---

## 8. Data Tables
Tables should feel premium and operational:
- Row height ~44–52px.
- Fine horizontal dividers; prefer subtle separators over zebra stripes.
- Right-align numbers, left-align labels, tabular numerals.
- Subtle header (using `border-strong`).
- Understated hover — rows change surface gently, never float or jump.
- Clear sorting indicators.
- Sticky headers for long tables.
- Clean pagination; optional column-visibility control.
- Compact status badges (see §13).

---

## 9. Booking & Court UI
The booking calendar is a **signature Maidan component.**

```text
             Court 01       Court 02       Court 03
09:00        ┌───────┐
             │ Padel │
10:00        └───────┘
11:00                       ┌────────────┐
                            │ Tennis     │
```

Differentiate bookings primarily through position, typography, small accents, sport labels and status — not saturated colored rectangles. A thin blue current-time line is appropriate.

### Court geometry
Court lines are a signature motif:
- 1px, low opacity, ink/blue/neutral grey.
- Use in booking views, facility headers, empty states and occasional brand moments.
- A single curved line can create movement through a large empty area.
- Never use as wallpaper.

---

## 10. Reporting & Data Visualization
Reports should feel like beautifully structured documents, not dashboards. Every chart must answer a question.

Use:
- Line → revenue / bookings over time
- Horizontal or vertical bar → location / sport comparison
- Stacked bar → composition
- Heatmap → utilization
- Sparkline → compact trends
- Donut → **only** for simple proportions, used sparingly

Avoid 3D charts, gradient fills, decorative donuts, gauges, excessive gridlines/labels, giant legends and heavy chart backgrounds.

Primary chart color: blue. Mint reserved for meaningful positive comparison. One primary accent + restrained secondary neutral tones — never a rainbow chart.

Tooltip example:
```text
Tuesday · 8 PM
Bookings     42
Revenue      PKR 84,000
Utilization  91%
```

### Utilization
Utilization is a core Maidan metric — a restrained heatmap exposing patterns by day/hour, using tonal intensity rather than bright colors. Hover reveals exact values.

```text
          Mon Tue Wed Thu Fri Sat Sun
08:00      ·   ·   ░   ·   ░   ▒   ▒
10:00      ░   ▒   ▒   ░   ▒   ▓   ▓
16:00      ▓   ▓   █   ▓   █   █   █
18:00      █   █   █   █   █   █   █
```

### Executive / investor reporting
Answer: **What happened? Where? Why did it change? What needs attention?**
Prioritize revenue, growth, utilization, location performance, sport performance, expenses and exceptions. More whitespace, less operational detail than the operations views.

---

## 11. Buttons
- **Primary:** solid blue, for the one important action per view.
- **Secondary:** neutral surface + border.
- **Tertiary:** text/ghost.
- **Destructive:** restrained red, never solid-red-heavy.

Avoid excessive button groups and pill-shaped buttons.

## 12. Inputs & Selects
- Near-white (`surface-raised`) fill.
- 1px border, 8px radius, 40–44px height.
- Clear focus ring in blue.
- `ink-faint` placeholder text, `ink` for selected value.
- Search inputs may use a simple stroke search icon. No oversized fields.

## 13. Status Badges
`Active` · `Cancelled` · `Pending` · `Completed`

Small, low-contrast, semantic (mint/amber/red/muted backgrounds at ~10% strength). Do not turn every metadata field into a badge.

## 14. Tabs
```text
Overview   Revenue   Bookings   Utilization   Courts
```
Active tab: primary text + subtle blue underline/indicator. Avoid large pill-tab designs.

## 15. Icons
- 16–18px standard, 20px for prominent controls.
- Stroke-based, not filled/glyph style.
- Icons support labels — never replace understandable text.
- Never use emoji as UI icons.

---

## 16. Motion
Motion is part of the identity but stays quiet and useful.

- Micro (hover): **120–180ms**
- Default (popover, drawer, most transitions): **180–300ms**
- Large transitions (page-level reveals): **300–500ms**
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`

Use:
- KPI → gentle 4px upward reveal.
- Chart → line reveal on meaningful initial render.
- Booking → block settles into its slot.
- Navigation → active indicator slides.
- Popover → subtle `0.98 → 1` scale.
- Toast → enters from ~8px below.

Never use bounce, excessive parallax, perpetual animation, or motion that delays work.

### Editorial motion (brand moments only)
A thin curved court line may draw itself over 700–1000ms at 0.05–0.10 opacity, in empty states, report covers or onboarding. This is a **brand moment**, not a constant dashboard animation. Respect `prefers-reduced-motion`.

---

## 17. States

### Empty
```text
NOTHING TO REPORT
No bookings were recorded in this period.
[ Change date range ]
```
A subtle court-line illustration is appropriate. Avoid giant illustrations.

### Loading
Quiet skeletons that preserve layout. Avoid aggressive shimmer.

### Error
```text
Couldn't load this report.
Try again or change the selected period.
[ Try again ]
```
Keep errors calm; red is a signal, not a giant background.

---

## 18. Responsive & Accessibility
Desktop-first reporting experience.

**Desktop:** full sidebar and reporting canvas.
**Tablet:** condensed navigation, advanced filters move to a drawer, fewer simultaneous columns.
**Mobile:** recompose rather than shrink — prioritize main metric, key trend, filters and critical operations. Stack KPI groups. Allow horizontal chart scrolling. Convert dense tables to expandable rows/detail views. Filters accessible via a filter button/drawer.

Never simply compress desktop UI until it becomes unusable.

Accessibility: WCAG AA contrast · keyboard navigation · visible focus · semantic controls · color is never the only status indicator · respect reduced motion.

---

## 19. Anti-AI-Slop Rules
**Never add:** purple/blue gradients, green-as-accent, neon effects, glassmorphism, huge rounded cards, floating blobs, random decorative icons, emoji UI, excessive shadows, 4×4 card grids, fake charts, giant welcome banners/hero sections, decorative metrics with no meaning, constant glowing animation, excessive pills/badges, rainbow charts, generic "AI dashboard" styling.

**Always use:** strong typography, warm neutral surfaces, precise spacing, subtle borders, one restrained accent color (blue) + one meaning-color (mint), excellent filters, excellent tables, clean single-accent charts, clear hierarchy.

When asked to make it **more modern** → improve typography, spacing, hierarchy, interaction quality, responsiveness, motion. Do not add decoration.
When asked to make it **more premium** → simplify and refine.
When asked to make it **more sporty** → use court geometry, typography, composition, motion. Not sports clip-art.

---

## 20. Component Rules
Semantic components:

```text
AppShell
Sidebar
Topbar
PageHeader
FilterBar
FilterDrawer
Metric
DataTable
StatusBadge
Tabs
Button
Input / Select
BookingCalendar
BookingBlock
RevenueChart
UtilizationHeatmap
EmptyState
ErrorState
ExportDialog
Toast
```

Every interactive component needs default, hover, focus, active and disabled states.
Every data component needs loading, empty, error and populated states.

---

## 21. Final Rule
The interface should feel like someone with exceptional taste deliberately removed everything unnecessary.

**Warm chalk + ink + court blue + mint + editorial serif + Inter + fine geometry + generous whitespace + restrained motion.**

Design Maidan as a **calm, premium, sport-native reporting instrument**.

**Precise enough for finance.
Fast enough for operations.
Distinct enough to feel like sport.
Refined enough to feel premium.**

**Do not design a generic SaaS dashboard. Design Maidan.**
