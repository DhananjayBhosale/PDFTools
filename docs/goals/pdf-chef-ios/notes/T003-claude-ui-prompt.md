You are the exclusive UI owner for PDF Chef iOS. This session was launched by Codex with `claude --model opus --effort high`; do not delegate any user-visible decision or frontend edit to a lower-tier model. You may use Claude subagents only if each editing agent is also Opus, each has an exact disjoint file scope, and you retain final review responsibility. Work autonomously and implement, do not stop at a plan.

Before any design or product-file edit, complete these gates in this order:

1. Read `/Users/dhananjaybhosale/.agents/skills/apple-design/SKILL.md` completely.
2. Read `/Users/dhananjaybhosale/.agents/skills/impeccable/SKILL.md` completely, including every directly required instruction/reference for this task.
3. Read `/Users/dhananjaybhosale/.codex/skills-src/ui-ux-pro-max-skill/.claude/skills/brand/SKILL.md` completely.
4. Run Impeccable's required project-context loader exactly as its skill instructs, from `/Users/dhananjaybhosale/Documents/PDFTools-main`.
5. Read `PRODUCT.md`, `DESIGN.md`, `design-system/MASTER.md`, applicable page overrides, `docs/goals/pdf-chef-ios/goal.md`, `docs/goals/pdf-chef-ios/state.yaml`, and the new Codex contracts under `services/platform/` and `services/domain/`.
6. Record in your final response the exact skill paths read, the exact context-loader command/result, your Claude session ID if available, and confirmation that the active model is Opus with high effort. Do not claim a gate you did not perform.

You exclusively own all user-visible decisions and frontend implementation: information architecture; Home, Recent, Settings; iOS tab presentation; React UI; CSS/tokens; colors/type/spacing/icons/artwork; themes; iPhone/iPad responsive behavior; all states; onboarding; copy; accessibility presentation; touch/gestures/motion; haptic design decisions; app icon/launch artwork; screenshot review.

Implement the complete shared React/Vite experience now. Requirements:

- Calm, premium, private, purpose-built for sensitive document work. No generic SaaS look, excessive glass, card-grid monotony, gradient text, decorative motion, or imitation of another app.
- iOS-appropriate Home, Recent, Settings tabs. Home exposes all 34 existing tools with excellent search/filtering/hierarchy plus comfortable upload, preview, progress, results, recovery, and accessibility. Preserve every existing tool route and processing capability.
- First-run onboarding covers local processing, offline use, local history, and user responsibility to review documents.
- Recent visually supports persistent records and retained documents: filename, tool, timestamp, input/output size, actual space saved or unknown, availability/missing-file state, reopen, rename, share, save, delete, clear, confirmation, empty/loading/error/success states. Consume stable Codex ports; do not invent technical persistence behavior.
- Settings covers system/light/dark, readable text size, accumulated actual space saved, history/document preferences and separate clear actions, storage usage, large-document warnings, relevant download preferences, privacy, version/about, and reset. You choose visible defaults and copy; engineering stores them.
- Apple safe areas, native-feeling materials only where useful, 44pt minimum targets, Dynamic Type/readable scaling, WCAG AA, keyboard-visible layouts, reduced motion, VoiceOver semantics, iPhone/iPad adaptation, long filenames, destructive confirmations, and critically damped motion. Momentum bounce only follows a user gesture.
- Create `docs/brand-guidelines.md`, `assets/design-tokens.json`, and `assets/design-tokens.css`, keep JSON/CSS tokens synchronized, and update `design-system/MASTER.md` plus page overrides for durable choices.
- Create Claude-approved master app-icon and launch artwork under `assets/brand/**`. Do not edit `ios/**`; Codex will wire approved artwork.
- Integrate the stable typed Codex contracts from `services/platform/contracts.ts` and `services/domain/**` from Claude-owned call sites. If an engineering method is not implemented yet, use a typed injectable boundary with honest unavailable/loading/error states; do not hard-code a fake success or invent uploaded/cloud behavior.
- Keep all processing and privacy behavior local/offline. Do not add remote assets, analytics, uploads, or external runtime dependencies.

Permanent allowed write scope:

- `App.tsx`
- `index.tsx`
- `index.html`
- `index.css`
- `components/**`
- `hooks/**`
- `types.ts`
- `services/toolSearch.ts`
- `lib/framer-motion-shim.tsx`
- `design-system/**`
- `docs/brand-guidelines.md`
- `assets/design-tokens.json`
- `assets/design-tokens.css`
- `assets/brand/**`
- `public/logo.svg`
- `public/favicon.svg`
- `public/og-image.svg`
- `public/site.webmanifest`
- `tailwind.config.cjs`

Forbidden writes:

- All `services/**` except `services/toolSearch.ts`
- `runtime/**`, `scripts/**`, `tests/**`
- `package.json`, `package-lock.json`, `capacitor.config.ts`, `vite.config.ts`, `tsconfig.json`, `public/sw.js`
- All `ios/**`, `dist/**`, `docs/goals/**`, `PRODUCT.md`, `DESIGN.md`
- `/Users/dhananjaybhosale/AndroidStudioProjects/PDFTools/**`

Do not install dependencies, initialize Git, reset/clean files, or edit generated bundles. If a required integration would cross the write boundary, implement the complete UI against the stable contract and report the exact Codex change needed.

After implementation, run focused checks available without changing forbidden files: `npm run lint`, `npm run test:catalog`, and `npm run build`. Fix only Claude-owned failures. Then perform Impeccable harden, polish, adapt, and audit passes plus an Apple Design interaction review and Brand consistency review. Return:

- `CLAUDE_UI_STATUS: COMPLETE | PARTIAL | BLOCKED`
- `MODEL_EVIDENCE`
- `SKILL_EVIDENCE`
- `CONTEXT_LOADER_EVIDENCE`
- changed files
- commands and pass/fail results
- responsive/accessibility/motion review status
- remaining Codex integration requests
- explicit preliminary UI verdict (`ACCEPTED`, `NOT_READY`, or `BLOCKED`); final screenshot acceptance happens after simulator integration.
