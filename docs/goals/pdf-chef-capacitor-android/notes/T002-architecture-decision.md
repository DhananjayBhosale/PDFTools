# T002 Final Sol Architecture Decision

## Decision

Select Option B: create a new Capacitor Android host under `/Users/dhananjaybhosale/Documents/PDFTools-main/android`, carrying forward the minimum proven Kotlin compatibility/runtime layer. Reject Option A under current authority because it requires writes to the read-only Kotlin reference and has unresolved Compose/BridgeActivity, SplitCompat, manifest, and lifecycle ownership collisions. Reject a generated TypeScript-only Android shell as non-compatible.

## Host Contract

- Base application ID: `com.dhananjaytech.pdfchef`.
- Debug application ID: `com.dhananjaytech.pdfchef.debug`.
- Namespace and stable MainActivity component: `com.dhananjaytech.zenpdf_allpdftoolsinoneplace` and `com.dhananjaytech.zenpdf_allpdftoolsinoneplace.MainActivity`.
- Capacitor Android exactly 8.5.0; bundled `dist` only; no remote server/bridge content.
- minSdk 29, targetSdk 36, compileSdk 36, Java 21. The original Java 17 planning rule was corrected after the generated and installed Capacitor 8.5 Gradle contracts proved Java 21 is required.
- `allowBackup=false`, `usesCleartextTraffic=false`, and no INTERNET permission without a later approved task.
- Preserve exclusions for `processed/`, `processed_index.json`, and file-domain `datastore/app_settings.preferences_pb`; retain the legacy shared-preference exclusion defensively.
- Generated icon/splash assets are unaccepted placeholders, not shipping UI proof.
- Host skeleton provides no release version, signing, upgrade, history, settings, fallback, feature-parity, or release-readiness proof.
- Cordova access origins must be an explicit empty list; generated `config.xml` must contain no wildcard or other `<access>` entry.

## Data and Collection Contract

- Read legacy storage in place. Do not copy, relocate, duplicate, re-home, or physically migrate the document library or settings.
- Read states are explicit: `ok`, `missing`, `blank`, `corrupt`, and `partial_invalid`.
- Listing is side-effect-free: no pruning, repair, orphan sweep, cap deletion, DataStore rewrite, or direct index-overwrite fallback.
- Missing/unreadable records remain unavailable/recoverable, not fabricated empty/default success.
- Validate basename, canonical containment, root rejection, and escaping symlinks on every operation.
- Opaque refs are re-resolved through the current validated index; no stored filename, absolute path, raw URI, preference bytes, or document bytes cross the bridge.
- File and collection outputs are distinct. Collections are never stream-opened as PDFs, assigned pseudo-MIME types, implicitly zipped, duplicated, or flattened.
- One Application-scoped Kotlin coordinator is the sole writer for history/files/settings. Settings patches preserve unknown keys and expose no reset/clear API in the first compatibility release.

## Fallback and Rollback

- Preserve native processors and PDFBox initialization/fallback until named parity gates pass.
- Candidate must include an offline recovery route for bridge/history failure, never clear data, and never present false-empty Recent.
- Unchanged legacy native UI may be carried forward mechanically where necessary; new visible recovery presentation belongs to Claude Code Opus 5 High.
- Rollback means halt rollout plus a higher-version forward fix. The old APK and Play downgrade are not rollback mechanisms.

## Ordered First Tranche

1. T010: safe Capacitor Android host/identity skeleton only.
2. T011: artifact/device/fixture hashes and performance measurement schema; predecessor baseline and empty-host tax when eligible evidence exists.
3. T012: additive TypeScript Android capability, health, opaque-ref, file-versus-collection contracts and focused fixtures/tests; no React activation.
4. T013: strictly read-only native legacy history/settings inspector with containment and corrupt/partial-state tests.
5. T014: Application-scoped single-writer coordinator and explicit user-driven mutations; no launch-time cleanup.
6. T015+: intents, import/export/share, recovery, processors, scanner/PPTX/widget/shortcuts, then Smart Forms as a separately verified dynamic feature.
7. T900: Claude-owned activation/presentation and UI acceptance.
8. T999: genuine upgrade, signing, device, performance, and release audit.

## Performance Gate

No numeric budget exists yet. Freeze predecessor/candidate/fixture/device/OS hashes and measure Kotlin predecessor, empty host, read-only bridge, genuine first upgrade, first Recent, later launch, and integrated steady state separately. Use release-like/profileable artifacts, identical devices/fixtures, warmups, and at least ten measured iterations. Record distributions, Java/native/JS heaps, total/WebView PSS, frames/stalls, battery/thermal, sizes, crashes, ANRs, and LMKs. A later Sol Judge sets non-inferiority margins from the baseline. New crash, ANR, LMK, main-thread history scan, read-triggered mutation, data loss, or persistent steady-state regression is an automatic failure.

## Blocked Gates

- Any Kotlin-reference edit without explicit new authority.
- UI activation without exact Claude Code Opus 5 High and frozen/tested schemas/native registration.
- Release version/signing until highest active Play version and separate public upload/Play signing fingerprints are verified.
- Play upload/internal/rollout without explicit approval.
- Production acceptance without genuine Play-installed predecessor update and current physical-device evidence.

## Completion

- Architecture selection: complete.
- Implementation: incomplete.
- Full owner outcome: incomplete.
- `PRODUCTION_RELEASE_READY: NO`.

No builds, tests, devices, credentials, signing, or Play operations were performed by T002.
