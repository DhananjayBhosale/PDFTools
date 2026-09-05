# T024 Tools Page Owner Feedback

## Owner direction

The owner is clearly unhappy with the current version's sizing and Tools page. The current surface is a migration checkpoint, not final UI. Use the live old Android application at `/Users/dhananjaybhosale/AndroidStudioProjects/PDFTools` as the read-only sizing/density reference. Keep one shared React implementation for Android, iOS, and web.

Visible decisions and frontend implementation remain exclusive to Claude Code Opus 5 High. Apply `apple-design`, `impeccable`, the brand skill, `PRODUCT.md`, `DESIGN.md`, `design-system/MASTER.md`, and `design-system/pages/home.md`. Apple design means response, familiarity, craft, restraint, reduced-motion safety, and platform adaptation, not decorative glass.

## Live old-Android phone metrics

- One full-width grouped list, not the dead `PopularToolCard` or `HomeToolGridCard` composables.
- Page: 16dp sides, 14dp plus status inset top, 12dp between header/privacy/search/categories, 14dp before list.
- Header: 50dp logo, 12dp gap, 24sp/30sp Black title, 44dp settings target with 20dp icon.
- Privacy: nominal 46dp, 12x10dp padding, radius 22dp, 26/16dp icon container/artwork, 12sp/16sp SemiBold.
- Search: nominal 38dp visual with at least 44px practical hit area, radius 22dp, 16x8dp padding, 20dp icon, 16sp/22sp Bold.
- Categories: 46dp shell, 4dp inset, 38dp segments, 20/16dp radii, 14sp/16sp labels. Order All, Edit, Optimize, Convert, Secure. Old proportional weights are 4:4:8:7:6, but every choice must remain reachable at 320/393 widths and 200% text.
- Tool surface: radius 16dp, 1dp border, divided rows.
- Row: 72dp minimum, 14x10dp padding, grows for wrapping and text scale.
- Icon: 48dp bubble, radius 12dp, 32dp artwork, 14dp text gap.
- Type: 14sp/20sp SemiBold title, 12sp/16sp Medium subtitle, 2dp gap, subtitle at most two lines.
- Trailing: 22dp chevron, divider starts 76dp from the left.
- Bottom nav: 16dp side margins, radius 20dp, 54dp targets, 22/20dp selected/unselected icons, 12sp/16sp labels.

Reference authorities include `AppHomeScreen.kt`, `HomeHeaderCards.kt`, `HomeSearchAndCategories.kt`, `HomeToolCards.kt`, `GroupedListComponents.kt`, `PdfToolIconImage.kt`, `AppShell.kt`, and `Type.kt` in the read-only Kotlin project.

## Current React findings

- `components/Tools/Dashboard.tsx` owns Home; `components/Layout/AppShell.tsx` owns shell.
- At 393px, about 281px precedes the first tool. Privacy renders about 63px, filter shell 54px, phone tool title/subtitle 17/14px, artwork 40px in a 48px bubble.
- At 320px, many rows reach about 88px and the catalog is about 3023px tall.
- The current `text-[var(--type-title1-size)]` in `AppShell.tsx` compiles as a color declaration rather than font size, leaving the phone title at 16px. Correct this with an unambiguous font-size form.
- Preserve catalog order, search, Android subtitles, status, routes, and all capability behavior.
- `DESIGN.md` still mentions a card grid and may be reconciled with the accepted divided-list authority.
- Deliberate tablet/desktop adaptation is allowed; copying the old unbounded list at every width is not required.

## Acceptance

- At least 44px practical targets; no horizontal page scroll.
- Legible/reflowing at 200% text, dark theme parity, keyboard accessibility.
- Immediate press feedback and restrained 150-250ms state transitions; reduced-motion safe.
- Screenshots at 320x568, 393x852, tablet/desktop, dark theme, and 200% text.
- Run lint, catalog tests, and the Android-reference-backed catalog test.
- Claude must iterate from screenshots and return `CLAUDE_UI_VERDICT: PASS` or `FAIL`.

## Current blocker

Claude CLI session `629c846f-390d-42fd-afac-29bfdcf8581e` returned HTTP 429 before a model turn, with zero tokens and no model usage. No files changed. Reported reset: 2026-08-30 00:40 IST. Do not substitute another model.
