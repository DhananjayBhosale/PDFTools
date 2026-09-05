# T002 Specialist Review Synthesis

Ten independent read-only architecture reviewers evaluated host structure, legacy data, native parity, release identity, security, performance, fixtures, TypeScript contracts, rollback, and Claude ownership. No product files were edited and no builds/tests/devices/credentials/Play operations were performed by the review tranche.

## Host Decision Convergence

- Nine reviews selected Option B: create a new Capacitor Android host under the writable shared workspace and carry forward the minimum proven Kotlin compatibility/runtime layer.
- One security review selected Option A on pure continuity grounds: embed Capacitor into the existing Kotlin host. That same review identified unresolved activity/lifecycle ownership and required writes in the Kotlin project. Under the current explicit read-only boundary, Option A is not executable and must remain rejected unless the user grants new authority.
- All reviewers rejected a clean TypeScript-only/generated Capacitor shell as a compatibility release.
- Data continuity depends on exact application ID, accepted signing lineage, and a genuine in-place update. Source location and matching app ID alone do not prove continuity.

## Common Non-Negotiable Architecture

- Production `applicationId` remains exactly `com.dhananjaytech.pdfchef`.
- Preserve the legacy Kotlin namespace and stable component names where widgets, shortcuts, pending intents, and manifest references depend on them.
- The candidate uses the bundled `dist` assets only: no remote `server.url`, live reload, cleartext remote content, remote processing, or document/filename telemetry.
- The first release reads legacy data in place. Do not copy, relocate, duplicate, rename, hash-migrate, or re-home `processed_index.json`, `processed/`, or `app_settings`.
- One process-wide Kotlin coordinator is the sole writer for history/files/settings across React bridge, native processing, and fallback. Separate repository-instance mutexes are insufficient.
- Startup/history listing must be side-effect-free: no prune, orphan cleanup, repair, migration, DataStore rewrite, or direct index overwrite fallback.
- Corrupt/unreadable index and DataStore states are explicit unavailable/recovery states, never fabricated empty/default success that can be written back.
- Native paths, URIs, preference bytes, passwords, filenames, and document content never cross the JavaScript bridge or diagnostics. Use strict opaque refs.
- Accept validated granted `content://` inputs only. Do not copy the reference's `file://` VIEW behavior.
- Keep backup disabled and preserve data/backup exclusions and a non-exported, narrow FileProvider.
- Directory/batch outputs are first-class collections. They must not be coerced to a streamable PDF, pseudo-MIME type, implicit ZIP, or duplicate store.
- Preserve all currently shipped native processors and PDFBox initialization/fallback until each shared implementation passes named corpus, behavior, error/cancellation, offline, memory, and same-device performance parity.
- Preserve Smart Forms as an on-demand dynamic feature; do not silently bundle, remove, or replace it.
- Preserve import/export/share, reader, scanner, PPTX, widget, shortcuts, durable pending intents, rename/delete/undo/clear, and offline recovery boundaries.
- The old APK cannot be an in-app fallback after update. The candidate must include a safe native recovery path and remain readable by a forward-fix build; Play downgrade is not a rollback plan.

## Host/Gradle Direction

- Add `@capacitor/android` matching the existing Capacitor 8.5.0 versions.
- New host lives under `/Users/dhananjaybhosale/Documents/PDFTools-main/android` only; the reference remains untouched.
- Initial base module should stay simple. Retain `:smartforms` as the only dynamic feature after its dedicated slice.
- Candidate policy: legacy namespace, minSdk 29, targetSdk 36, Java 17, backup disabled, bundled assets, protected release-signing provider names, and no release version assumption.
- Debug builds require an application ID suffix and are never production-update evidence.
- Release version remains blocked until the highest active Play version is verified; signed candidate remains blocked until public upload and Play App Signing fingerprints are separately verified.
- A host skeleton is not feature, history, settings, fallback, signing, upgrade, or release proof.

## Data and Contract Direction

- Native legacy refs should be stable opaque handles resolved through the validated index on every operation; one proposal is `a1_<positive legacy id>`.
- A side-effect-free reader reports `ok`, `missing`, `blank`, `corrupt`, and partial-invalid health separately.
- First launch reads at most the newest 300 without destructive enforcement; cap pruning becomes a later explicitly tested transaction.
- Preserve all exact history fields and DataStore keys/types. Any future settings patch preserves unknown/unrelated keys and exposes no reset/clear.
- The current shared document contract needs an additive, backward-compatible file-versus-collection model and capability flags before legacy Recent integration.
- Existing iOS/browser platforms must remain valid and behaviorally unchanged.
- React activation stays out of Codex scope; `index.tsx` is Claude-owned.

## Security Rules Not to Copy

- `file://` VIEW intent acceptance.
- Raw-path deletion in `PdfEditImageStore.pruneUnused`.
- Non-canonical orphan comparison/deletion.
- Direct index overwrite fallback.
- Launch-time destructive pruning or orphan sweeping.
- Cordova wildcard remote access or any remote bridge exposure.

## Performance Gate

- Freeze predecessor/candidate/fixture/device hashes and measure the Kotlin release baseline first.
- Then measure the empty Capacitor host to isolate WebView tax before broad integration.
- Then measure genuine first upgrade, first Recent, later launch, and integrated steady state.
- Same devices/fixtures/artifact modes; at least ten measured iterations after warmups; record P50/P90/P95, spread, Java/native/JS heaps, total/WebView PSS, frames/stalls, battery/thermal, sizes, crashes, ANRs, and LMKs.
- Provisional non-inferiority suggestions require final Judge approval after the baseline exists; no numeric PASS exists now.
- Non-visible React performance markers require Claude ownership.

## Claude Handoff Boundary

- Codex owns Android host/native plugins, non-visible TypeScript services/contracts, tests, scripts, build/config, and generated synchronization.
- Claude Code Opus 5 High owns `index.tsx`, all React/UI files, visible platform activation/presentation, copy, accessibility presentation, responsive behavior, motion, haptics decisions, themes, screenshots, and final UI verdict.
- Earliest Claude handoff is after native plugin method/result schemas, Android factory/availability predicate, collection semantics, readiness/pending-import failures, focused TypeScript checks, and host plugin registration compile are frozen.

## Competing First Worker Proposals

Reviewers proposed five possible first slices:

1. Deterministic TypeScript upgrade-fixture/contract harness only (three new test/harness files; no host).
2. TypeScript Android adapter/collection contract and mock tests only (no host/native/activation).
3. Capacitor Android host and release-identity skeleton only.
4. Host plus a strictly read-only legacy history/settings inspection plugin.
5. Host plus performance scaffold/measurement schema.

The final Sol Judge must select and order these so each slice has non-overlapping ownership, focused verification, explicit stop conditions, and no false compatibility claim. The plan should favor the earliest slice that most reduces irreversible data/update risk while keeping later host/performance feedback timely.

## Required Final Sol Judge Output

- Selected and rejected host architecture, including authority rationale.
- Exact data/collection/single-writer/fallback contracts.
- Ordered first implementation tranche.
- Exact first Worker `allowed_files`, `verify`, and `stop_if`.
- Performance-instrumentation gate.
- Signing/Play/Claude blocked gates.
- `full_outcome_complete: false` unless all final requirements are somehow proven (they are not currently).
