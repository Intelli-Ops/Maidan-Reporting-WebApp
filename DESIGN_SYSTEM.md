# Maidaan Reporting App Design System

Version: 1.0

---

# Brand Identity

Maidaan Reporting is a premium SaaS analytics platform for managing Padel and Futsal facilities.

The product should feel modern, elegant, minimal and professional.

Design inspiration:

- Linear
- Stripe Dashboard
- Vercel
- Arc Browser
- Notion
- Framer

Avoid looking like a traditional admin dashboard.

The UI should communicate:

• Premium
• Modern
• Spacious
• Sports Technology
• Data Analytics
• Investor Reporting

---

# Brand Personality

Minimal

Elegant

Friendly

Premium

Professional

Fast

Clean

---

# Color Palette

## Primary

Blue

#2563A8

Primary actions

Links

Navigation

Charts

---

## Secondary

Teal

#1F7A7A

Analytics

Charts

Court utilization

---

## Accent

Green

#2E7D32

Revenue

Success

Completed bookings

Positive metrics

---

## Sidebar

Dark Navy

#0E2335

---

## Background

Main

#F6F8FA

Secondary

#EEF3F6

Surface

#FFFFFF

---

## Borders

#E5E7EB

---

# Typography

Heading

#0F172A

Bold

Subheading

#334155

Medium

Body

#64748B

Muted

#94A3B8

---

# Glassmorphism

Use ONLY for KPI cards.

Background

rgba(255,255,255,.55)

Backdrop Blur

18px

Border

1px solid rgba(255,255,255,.45)

Shadow

0 10px 35px rgba(0,0,0,.08)

Never use glass effects on tables.

Never use glass effects on charts.

Never use glass effects everywhere.

---

# Border Radius

Cards

18px

Buttons

10px

Inputs

10px

Charts

18px

Tables

16px

Status Pills

999px

---

# Shadows

Soft

Low opacity

Large blur

No hard shadows

---

# Spacing

Base spacing unit

8px

Card padding

24px

Page padding

32px

Gap between cards

24px

---

# Buttons

Primary

Gradient

#2563A8 → #2E7D32

Text

White

Secondary

White

Border

#D0D7DE

Hover

Very subtle

---

# Sidebar

Dark

Minimal

Outlined icons

Rounded active item

Blue active indicator

Collapsible

---

# Navigation

Top navigation

White

Contains

Search

Notifications

Location Selector

Date

Profile

---

# Dashboard Background

Very light gray

(#F6F8FA)

Overlay a subtle padel court line pattern

Opacity

2–4%

Pattern should never distract from data.

It should only reinforce branding.

---

# Cards

Floating appearance

Soft shadows

Rounded corners

Minimal borders

Lots of whitespace

---

# Tables

Modern

Minimal

Inspired by Stripe Dashboard

Rounded rows

Soft hover

Alternating row backgrounds

Status pills

No heavy borders

Large row spacing

---

# Charts

Rounded corners

Soft gradients

Thin gridlines

Smooth curves

Modern legends

Use only brand colors

Blue

Teal

Green

Light Blue

Gray

---

# Dashboard Components

Create reusable components.

KPI Card

Glass KPI Card

Analytics Card

Chart Card

Donut Chart

Pie Chart

Bar Chart

Area Chart

Horizontal Bar Chart

Heatmap

Recent Bookings Table

Status Badge

Sidebar

Header

Search Bar

Filter Dropdown

Location Selector

Date Picker

Notification Menu

User Profile Menu

---

# Imagery

Do not place promotional images inside the sidebar.

Instead create dedicated dashboard cards such as:

Top Performing Court

Court of the Month

Featured Facility

Court Overview

Images should have:

Rounded corners

16px radius

Soft overlay

Subtle shadow

Image cards should integrate naturally with the analytics layout.

---

# Icons

Use Lucide Icons.

Outlined style only.

Avoid filled icons.

---

# Animations

Subtle only.

Cards lift on hover.

Buttons brighten.

Rows highlight.

Charts animate smoothly.

Avoid excessive motion.

---

# Accessibility

Minimum contrast ratio WCAG AA.

Interactive elements should have clear focus states.

Large click targets.

Readable font sizes.

---

# Layout

12-column responsive grid.

Desktop first.

Responsive for tablet.

Sidebar collapses on tablet.

Charts resize automatically.

Tables become horizontally scrollable.

---

# Coding Rules

Reuse existing components whenever possible.

Do not recreate existing UI primitives.

Follow current Tailwind configuration.

Respect existing design tokens.

Do not modify backend logic.

Do not modify API contracts.

Only improve the frontend.

Build reusable React components.

Avoid duplicated code.

Use TypeScript.

Use clean component composition.
