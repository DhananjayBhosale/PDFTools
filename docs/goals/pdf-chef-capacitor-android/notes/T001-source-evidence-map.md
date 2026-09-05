# T001 Source Evidence Map

## Receipt

T001 completed as a read-only, ten-scout source-mapping task. No product files were changed. No builds, tests, emulators, devices, signing checks, credentials, or Play Console operations were run.

## Workspace Truth

- `/Users/dhananjaybhosale/Documents/PDFTools-main` is a non-Git React 18 + TypeScript 5.8 + Vite 6 + Capacitor 8.5 workspace. It contains the shared web application and an iOS Capacitor host, but no Android host and no `@capacitor/android` dependency.
- `/Users/dhananjaybhosale/AndroidStudioProjects/PDFTools` is a non-Git Kotlin Android project and remains read-only. It is the current authority for the live Android host, data formats, native tools, manifests, build behavior, and historical verification.
- `capacitor.config.ts` and the Kotlin app Gradle file independently declare `com.dhananjaytech.pdfchef`. The Kotlin namespace is intentionally `com.dhananjaytech.zenpdf_allpdftoolsinoneplace`.
- Checked Kotlin source values are versionCode 21, versionName 2.2.4, minSdk 29, targetSdk 36, and compile SDK 36.1. These do not prove the highest Play version.

## Shared Product and Adapter Evidence

- Shared entrypoints are `index.tsx` and `App.tsx`; build output is `dist` and is packaged offline through Capacitor/service-worker asset tooling.
- Typed platform contracts already exist in `services/platform/contracts.ts`; the iOS bridge and aggregate adapter live in `services/platform/capacitor/pdfChefDocuments.ts` and `iosDocumentServices.ts`.
- The iOS native implementation already proves useful patterns: opaque document references, bounded chunked reads, atomic durable storage, pending-import queues, process-recovery behavior, native picker/export/share, haptics, metadata, and storage stats.
- The existing `legacyWorkspaceMigration.ts` migrates browser IndexedDB into iOS native storage. It is not an Android legacy bridge.
- No Android TypeScript adapter, native Capacitor plugin, Android host, or Android synchronization command exists.
- Android directory/multi-file outputs do not fit the current single-document `StoredDocument` contract without an explicit collection policy.
- `index.tsx`, `App.tsx`, `components/**`, `hooks/**`, design system, tokens, brand assets, UX copy, responsive behavior, accessibility presentation, motion, and visible states are Claude Code Opus 5 High-owned. Codex may implement services/contracts/native code/tests but must return Android activation or any visible behavior change to Claude.

## Legacy Data That Must Be Preserved

- History index: `context.filesDir/processed_index.json`.
- Owned output root: `context.filesDir/processed/`.
- History schema keys: `id`, `displayName`, `toolName`, `sizeBytes`, `createdAtMillis`, `storedFileName`, `mimeType`, `isDirectory`, `itemCount`.
- `storedFileName` is basename-only; loads resolve beneath the canonical processed root. Invalid, missing, traversal, out-of-root, root-itself, and escaping-symlink entries are rejected.
- Missing/blank index yields empty history. Corrupt/unreadable index yields empty history without deleting outputs. Orphan deletion is gated on index readability.
- History is newest-first and capped at 300; entries beyond the cap are recursively deleted from disk. This behavior needs focused tests before reuse.
- Writes use `processed_index.json.tmp` then rename, with direct-write fallback; mutations are serialized by `Mutex`.
- Settings DataStore name is `app_settings`. Exact keys are `theme_mode`, `app_font_option`, `onboarding_completed`, `tool_usage_memory`, `savings_tally`, `tool_option_memory`, and `last_privacy_line_index`.
- Tool usage, tool option, savings, onboarding, theme, font, and privacy-line state must remain readable without rewriting or resetting the underlying DataStore.
- Backup and device-transfer rules exclude processed outputs, index, and DataStore. Upgrade safety must rely on in-place package sandbox continuity, not backup restore.

## Native Capability and Fallback Evidence

- The Kotlin app implements 25 tools through `OfflinePdfRepository`, `OfflinePdfToolProcessorRegistry`, PDFBox processors, raster fallbacks, WebView PPTX rendering, document scanner integration, and an on-demand Smart Forms dynamic feature using ONNX Runtime.
- The host also owns incoming VIEW/SEND/SEND_MULTIPLE intents, SAF imports, persistable grants, FileProvider open/share, MediaStore export, recent rename/delete/undo/clear, widget, shortcuts, and early PDFBox/application cleanup.
- All native processing runs in-process on `Dispatchers.IO`; no WorkManager/foreground durable processing path was found. Process death interrupts long work, so the new compatibility surface must report/recover honestly.
- Native fallback cannot be reduced to Android `PdfRenderer`; current mutation authority is PDFBox. Smart Forms cannot be silently folded into the base app without its model/dynamic-delivery lifecycle.
- Known production crash risk remains around PDFBox font resolution. Any copied fallback needs targeted corpus and telemetry-aware checks.

## Architecture Comparison Evidence

### A: Add Capacitor to the Existing Kotlin Host

Pros: direct installed-data continuity, existing native engines, intents, provider, widget, shortcuts, Smart Forms, and rollback source remain in one host.

Risks: collides with the current Compose `ComponentActivity`, `PdfChefApplication`/SplitCompat, manifest, Gradle, and lifecycle ownership. It also requires writes to the Kotlin reference, which are not currently authorized.

### B: Create a Capacitor Android Host in the Shared Workspace

Pros: respects the writable-workspace boundary, keeps the shared React source as product authority, provides a clean Capacitor ownership model, and can still reuse the same app-private sandbox in a correctly signed in-place update.

Risks: currently absent; must introduce `@capacitor/android`, a host, manifest parity, Android plugin, in-place history/settings adapter, intent queue, import/export/share, storage stats, native processing/fallback, dynamic feature strategy, and exact release identity. A thin bridge is insufficient unless all required native capabilities have a proven shared replacement.

Neither option is release-safe until signing continuity and genuine update behavior are proven. There must be exactly one writer for legacy history/files.

## Security and Privacy Findings

- Positive: backups are disabled/excluded, FileProvider is non-exported and narrow, PPTX WebView blocks network/file/content loads, shared service-worker caching is same-origin, and no production document/filename telemetry was found.
- P0 reference issue: exported MainActivity accepts `file://` VIEW intents without a content-scheme gate. Do not copy this behavior; require `content://`, expected MIME/content validation, and appropriate grants.
- P2 reference issue: `PdfEditImageStore.pruneUnused` deletes stored path strings without rechecking canonical containment.
- P2 reference issue: orphan reconciliation compares non-canonical stored absolute paths before deletion decisions.
- iOS `config.xml` contains `<access origin="*"/>`; determine whether it affects the Capacitor release and keep the native bridge unreachable from remote content.
- The Android application must remain bundled/offline and must not add remote processing or document/filename telemetry.

## Verification and Fixture Gaps

- Shared workspace has TypeScript tests but no package-level `test` script. Current supported invocations must be confirmed before standardizing one.
- Existing Android coverage is broad, but there is no explicit reproducible 0/1/50/300/301 upgrade fixture ladder, shared cross-platform fixture format, deterministic interruption-at-every-index-write harness, or actual nearly-full-disk harness.
- Required future fixtures include files and directories, multiple tools, renamed outputs, Unicode/long names, missing files, corrupt/truncated/temp indexes, full 300 history, 301 cap behavior, settings variants, and process-death/low-storage cases.
- Fresh install is not upgrade proof. Final acceptance requires candidate installation over the predecessor without uninstall/clear and then a Play internal-track update over a Play-installed predecessor.

## Performance Evidence and Gaps

- Kotlin source contains Macrobenchmark/Baseline Profile infrastructure for startup, frame timing, max memory, reader/tool journeys, and synthetic fixtures.
- Shared source contains repeatable browser benchmark and build-size scripts.
- No current paired physical-device baseline versus Capacitor candidate exists. No WebView-specific startup/main-thread/JS/native heap/PSS/battery/thermal campaign or numeric budget has been accepted.
- Budgets must be established from identical artifacts, devices, fixtures, warmups, at least ten iterations per scenario, distribution metrics, and explicit tolerance. Emulator/debug results cannot establish physical release budgets.

## Release Gates

- Source proves the expected application ID but not the upload key, Play App Signing certificate, highest active Play version, Play acceptance, genuine Play update, or physical-device behavior.
- Protected signing variable names exist; their values were not read and must never be printed or stored.
- No Play write, upload, track change, or rollout is authorized.
- Final status must separate local, emulator, physical-device, signing, Play-internal, and production evidence.

## Candidate Non-Overlapping Worker Scopes

1. Capacitor Android host and identity/build skeleton in the shared workspace only.
2. Shared Android TypeScript adapter and contract tests only; no React entrypoint/UI edits.
3. Android native legacy history/settings compatibility plugin and containment tests only.
4. Android native import/export/share/pending-intent bridge and tests only.
5. Native processing/fallback compatibility modules and all-tool contract tests only.
6. Upgrade-fixture generator/harness only.
7. Performance/size/manifest/artifact evidence scripts only.

The Sol Judge must choose the host architecture, in-place-versus-copy policy, multi-file/directory contract, retained native feature floor, rollback boundary, first Worker scope, and verification stop conditions.
