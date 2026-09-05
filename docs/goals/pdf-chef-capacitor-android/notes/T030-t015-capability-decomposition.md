# T030 — T015 capability decomposition

## Outcome

Broad T015 must not be activated as one implementation task. It combines unrelated storage, URI, mutation, processing, UI, security, release, and external-evidence risks. The safe path is a dependency-ordered series of separately reviewed slices.

This is a read-only architecture result. No product source, Kotlin reference, build, emulator, physical device, signing credential, or Play state was changed.

`PRODUCTION_RELEASE_READY: NO`

## Accepted foundations

- T012: frozen Android legacy DTOs, health states, opaque refs, file/collection distinction, privacy rejection, and deterministic fixtures.
- T013/T021: registered, side-effect-free native history/settings reader and positive Capacitor runtime proof.
- T014/T029: exactly one accepted settings mutation, `setThemeMode`, behind one Application-owned coordinator per process with debug-variant crash proof.
- T016: non-activated TypeScript client for the read-only inspector.
- T024/T026: Claude-accepted shared Home/Tools presentation and byte-aligned Android web bundle.

These are preserved foundations, not proof that Android product data or document capabilities are activated.

## Current system truth

The Android host registers only `AndroidLegacyInspectorPlugin` and `AndroidLegacySettingsWriterPlugin`. The shared runtime bootstrap recognizes the iOS document platform only; Android falls through to browser/localStorage/IndexedDB behavior.

That fallback is not safe for release:

- Valid legacy entries can be listed by opaque ref but cannot be safely opened, exported, or shared through Android native storage.
- A bridge failure or absent Android activation can show unrelated empty browser Recent state, which could look like lost history.
- Collections cannot be truthfully coerced into the current file-only `StoredDocument` presentation contract.
- The accepted writer verifier intentionally freezes exactly two native registrations, so a document/intake plugin cannot be added until a Judge explicitly supersedes that contract.

The Kotlin reference remains the read-only behavior authority. Its destructive read-time pruning, orphan sweep, `file://` ingress, direct-write fallback, and in-process-only mutation recovery are not safe to copy.

## Capability dependency map

### 1. Native plugin catalogue and registration contract

Read-only Judge task first.

Define:

- the minimum native plugin catalogue;
- whether document intake, opaque document access, export/share, storage metadata, and pending intents are one bounded plugin or several;
- exact registrations and ordering in `MainActivity`;
- how T013/T014 verifiers are superseded without weakening their frozen reader/writer guarantees;
- stable method names, DTO envelopes, error codes, size/count limits, and privacy boundaries;
- which components remain inactive until runtime proof and Claude activation.

No third plugin may be added before this decision.

### 2. Inactive secure content-URI policy and durable owned import staging

Native engineering only; no manifest or React activation initially.

Contract requirements:

- accept only exact `VIEW`, `SEND`, and `SEND_MULTIPLE` semantics;
- accept `content://` only; reject `file://`, BROWSABLE document ingress, arbitrary schemes, and raw string routes;
- validate grants, readability, MIME, PDF header, count, size, cancellation, and duplicate ordering;
- copy accepted content into bounded, owned app-private staging before treating it as durable; an external grant is not a durable document;
- fsync and atomically publish an owned pending-import record, then queue it before JavaScript readiness and require explicit acknowledgement;
- never expose provider addresses or raw URIs to JavaScript;
- use opaque request/document refs and redacted errors;
- do not add permissions, network access, Google services, scanner SDK, FileProvider, or visible behavior in this slice.

Manifest activation and native plugin registration are later, separately audited slices after trusted-origin/WebView gates pass.

### 3. Opaque legacy document open/read

Depends on the intake and registration contracts.

- Re-resolve every `a1_<id>` against the current validated committed index immediately before access.
- Use canonical no-follow containment under `files/processed`.
- Reject missing/unavailable records generically.
- Reject direct-open for collections; do not expose collection children or raw stored names.
- Preserve the existing bounded chunk protocol; never send paths or URIs across the bridge.
- Use direct descriptors where safe and a bounded owned temp fallback with exact cleanup.
- Perform no index rewrite, pruning, orphan cleanup, migration, rename, or delete.

### 4. Local document picker

The user-initiated picker is not the same contract as external `VIEW`/`SEND` ingress.

- Use Android's document picker with an exact MIME allowlist and multiple-selection bound.
- Copy accepted inputs into the same owned staging protocol before acknowledgement.
- Treat persistable grants only as an optimization; surface grant failure honestly and never depend on it for durable access.
- Keep picker launch/result mechanics inactive and presentation-free until Claude owns the visible trigger and cancellation/error behavior.

### 5. Retain, export, and share

Separate native slices after opaque open/read is accepted.

- Retain/write: owned staging, complete write, fsync, atomic commit, low-storage refusal, and no duplicate full-library copy.
- Export: MediaStore with `IS_PENDING`, explicit rollback of partially created destinations, and truthful ownership semantics.
- Share: non-exported FileProvider, read-only grants, named processed/share-staging roots only, delayed-recipient-safe staging, and explicit cleanup/revocation.
- FileProvider must never expose files root, cache root, index, DataStore, or WebView data.
- Collections require a separate bounded export/share contract; they are not directly streamable files.

### 6. Non-activated TypeScript Android platform and device adapters

Only after the native document lifecycle is proven.

- Add Android-specific adapter/client files and focused tests.
- Preserve T012 health/ref/collection semantics.
- Do not alter `index.tsx`, `App.tsx`, hooks, components, CSS, or design-system files.
- Do not report a capability as available unless the underlying native action is real.
- Do not collapse bridge failure into the browser/localStorage platform.

Keep these as distinct adapter slices even if T031 later places their native methods in one plugin:

- document lifecycle adapter;
- read-only settings adapter;
- app metadata adapter;
- storage stats adapter;
- haptics adapter.

The duplicate `WorkspacePlatform` shapes in `services/platform/contracts.ts` and `hooks/useWorkspaceRuntime.tsx` are a drift hazard, but consolidation requires a separate contract-owner task.

### 7. Claude-owned Android activation and no-false-empty recovery presentation

Claude Code Opus 5 High exclusively owns:

- Android selection in the shared bootstrap;
- Recent collection/recovery/error/retry presentation;
- visible pending-import behavior;
- explicit `READY`, `BRIDGE_UNAVAILABLE`, `HISTORY_CORRUPT`, `PARTIAL_INVALID`, `BUNDLE_FAILED`, and `RETRYABLE` routing without browser-state substitution;
- picker, reader, save/share, destructive confirmation, and privacy copy;
- theme/font/onboarding activation;
- screenshots and final interaction acceptance.

Activation is gated on positive native discovery plus import, opaque open, export/share, collection refusal/routing, and no-false-empty evidence. No separate Android React frontend is allowed.

### 8. History mutation foundation and one-operation slices

History reads stay frozen and side-effect-free.

Extend and reuse the already accepted Application-owned `LegacyMutationCoordinator` and its process-wide lock; do not create a second coordinator or lock. Add canonical no-follow containment, identity/hash revalidation, durable journal/staging, atomic document/index commit, directory fsync, and deterministic restart behavior behind that same owner.

Then authorize one mutation per slice:

1. rename by opaque ref;
2. single delete with explicit record/document semantics;
3. durable undo begin/undo/commit;
4. batch delete with per-ref outcomes;
5. clear records and clear documents as distinct operations;
6. explicit prune/orphan maintenance last.

No slice may use direct overwrite, copy/delete fallback, read-triggered cleanup, generic temp sweep, missing/corrupt index as deletion authority, or an in-memory-only process-death contract.

### 9. Settings slices

- The existing inspector remains the read authority.
- `setThemeMode` remains the only accepted mutation until separately superseded.
- Theme activation requires Claude to resolve `DYNAMIC` versus shared `system/light/dark` semantics.
- Font, onboarding, privacy index, tool usage, savings, and tool options are separate operations; no generic settings writer.
- Encoded JSON memory may be exposed read-only first, without decode/reserialize migration.
- Every mutation must preserve unrelated keys, duplicate entries, unknown fields, ordering, noncanonical encodings, and untouched bytes exactly.
- Storage/history settings remain blocked until document/history ownership exists.

### 10. Processor parity families

There is no native processor bridge in the shared Android host. Current Android execution is browser/WASM/JavaScript. The Kotlin catalogue has 25 tool entries, but the base processor registry has 24 processors; `MAKE_FILLABLE` is the separate Smart Forms path.

Processor work must follow document lifecycle acceptance and be split by risk:

1. structural page operations: merge, split, extract, delete pages, reorder, flatten, repair;
2. credential operations: protect/unlock, with exact password preservation and no logging;
3. geometry overlays: watermark, page numbers, sign, rotate, edit;
4. image conversion: create/image-to-PDF/PDF-to-image with EXIF and bitmap bounds;
5. metadata/text/report: metadata, `OCR_TEXT` as selectable-text extraction rather than OCR, and Compare PDF as a report artifact;
6. office conversion: PDF-to-Word, Word-to-PDF, and PPTX-to-PDF with honest fidelity contracts;
7. compression last, with structure-preserving versus raster behavior and measured memory/time budgets.

Web-only crop, header/footer, extract-images, sanitation/removal tools, and Batch do not have equivalent Kotlin processor contracts. They require explicit Android parity definitions rather than being silently classified as native parity.

### 11. Special Android capabilities

Each is independent:

- ML Kit document scanner and scanner-import persistence;
- dynamic launcher shortcuts and share targets;
- stateless scan widget;
- Smart Forms dynamic feature, Play Feature Delivery, model lifecycle, ONNX dependencies, and output import last.

Do not invent WorkManager, notification, or background-processing behavior; the reference does not provide durable background processing. Interrupted work must be reported honestly.

### 12. Deterministic host security and offline integrity

Required independent slices:

- remove or explicitly fail on latent Google-services activation;
- exact source, merged-manifest, APK/AAB permission/component allowlists;
- content-hash every precached asset byte, not only filenames;
- require exact `dist` to packaged-Android tree parity;
- redact diagnostics: no filenames, paths, URIs, passwords, provider addresses, document-derived text, raw bytes, or stacks;
- add CSP/navigation/WebView bridge-origin hardening before privileged plugin activation;
- expand backup/data-transfer verification for WebView, staging, import, and cache domains while preserving the approved backup-disabled policy.

Only the launcher may be exported initially. New components require their own artifact-level security proof.

Security and trusted-origin work must land before any privileged document plugin is registered or any runtime intent filter is activated. Durable owned import staging must exist before external grants are consumed as product documents.

### 13. Identity, release hardening, upgrade, and performance

Current package identity and min/target SDK match, but release readiness does not:

- candidate version is `1 / 1.0`; it cannot update the checked predecessor `21 / 2.2.4`;
- never copy version 21 blindly—production version must be strictly greater than the highest active Play version;
- release shrinking is disabled and R8 rules are incomplete;
- current unsigned release is not signing or update evidence;
- no genuine predecessor-to-candidate update, API 29 matrix, physical candidate, or Play internal update exists.

Verification order:

1. freeze privacy-safe source/artifact/fixture/device manifests;
2. build genuine installed predecessor states for 0/1/50/300/301/large histories and every settings/corruption/interruption case;
3. create same-test-certificate, update-capable release-like predecessor/candidate artifacts;
4. run strict `adb install -r` update matrices on disposable API 29 and 36 without uninstall, clear, downgrade, or `-d`;
5. measure predecessor, empty Capacitor host, and bridge tax on the same hardware;
6. measure first-upgrade and steady-state behavior separately with repeated samples;
7. prove final minified offline runtime, R8, APK/AAB, crash/ANR/LMK, memory, frame, battery, and thermal gates;
8. only with approval, verify public upload and Play App Signing fingerprints separately and run an actual Play internal-track update.

Evidence labels remain distinct: `LOCAL_TEST_ONLY`, `EMULATOR`, `PHYSICAL_DEVICE`, `SIGNING`, `PLAY_INTERNAL`, and `PRODUCTION`.

## Execution-ready slice contracts

These are sequential ownership contracts, not authorization to implement all slices now. A future Judge may narrow an allowlist but may not silently widen it. Generated artifacts are never hand-edited.

| Slice | Depends on | Capability owner | Activation state | Minimum evidence before acceptance |
|---|---|---|---|---|
| T031 catalogue Judge | T030 | Judge documentation only | design-only | `LOCAL_TEST_ONLY` source/contract audit |
| T032 host dependency/security | T030 | Android build-security Worker | inactive; no new capability | `LOCAL_TEST_ONLY` JVM, merged manifest, APK audit |
| T033 offline content integrity | T032 | packaging-integrity Worker | inactive; generated assets only | `LOCAL_TEST_ONLY` deterministic build and byte manifests |
| T034 trusted WebView shell | T031, T032 | Android host-security Worker | existing two plugins only | `LOCAL_TEST_ONLY` plus `EMULATOR` hostile-navigation proof |
| T035 Claude frontend security | T033, T034 | Claude Code Opus 5 High | shared web/iOS/native shell behavior only | Claude PASS, browser/build and packaged-native proof |
| T036 owned pending imports | T031, T032, T034 | Android document-staging Worker | inactive; no plugin/manifest | `LOCAL_TEST_ONLY` JVM crash/restart/low-storage matrix |
| T037 local picker | T036 | Android picker Worker | inactive | `LOCAL_TEST_ONLY` plus `EMULATOR` picker/grant/lifecycle proof |
| T038 opaque legacy open | T031, T032, T034 | Android document-read Worker | inactive | `LOCAL_TEST_ONLY` plus `EMULATOR` bounded-read/no-mutation proof |
| T039 retain/export/share | T032, T034, T038 | Android delivery Worker | inactive; provider unregistered | `LOCAL_TEST_ONLY` plus `EMULATOR` MediaStore/provider/grant proof |
| T040 document plugin activation | T035–T039 | Android integration Worker | privileged native bridge and content intent filters | `LOCAL_TEST_ONLY` plus `EMULATOR` bridge/origin/manifest journeys |
| T041 Android document adapter | T040 | TypeScript platform Worker | non-activated | `LOCAL_TEST_ONLY` strict DTO/adapter tests |
| T042a metadata | T031, T032, T034 | Android metadata Worker | inactive until its own registration gate | local DTO/JVM then emulator discovery |
| T042b storage stats | T031, T032, T034 | Android storage Worker | inactive until its own registration gate | local privacy/JVM then emulator discovery |
| T042c haptics | T031, T032, T034 | Android haptics Worker | inactive until its own registration gate | local enum/JVM then emulator discovery |
| T043 Android settings adapter | T013, T014, T031, T032, T034 | TypeScript settings Worker | non-activated | `LOCAL_TEST_ONLY` health/DTO/no-default tests |
| T044 Android bootstrap/recovery | T040–T043 | Claude Code Opus 5 High | product activation | Claude PASS plus `EMULATOR` no-false-empty journeys |
| T045 history transaction foundation | T029, T038, T039 | sole-coordinator Android Worker | inactive | local fault matrix plus debug-variant emulator crash proof |
| T046a–f history mutations | T045 sequentially | one Android operation Worker per slice | inactive, then Claude-gated | operation-specific local/emulator crash and preservation proof |
| T047a–g processor families | T039, T040 | one Android processor-family Worker per slice | inactive, then Claude-gated | family corpus, offline, cancellation, artifact and performance evidence |
| T048a–d special Android | T036, T039, T040 and named family prerequisites | one special-capability Worker per slice | separately gated | manifest/dependency/privacy plus local/emulator evidence |
| T049 release campaign | all accepted product slices | Sol PM/Judge plus separately authorized operators | release-like, then approval-gated external | local, emulator, physical, signing, Play internal kept distinct |

### T031 — native plugin catalogue Judge

- Allowed files: `docs/goals/pdf-chef-capacitor-android/notes/T031-native-plugin-catalogue.md` and the T031 receipt/status fields in `docs/goals/pdf-chef-capacitor-android/state.yaml` only.
- Verify: read `MainActivity.java`, both legacy verifiers and contract tests, the iOS `PdfChefDocuments` protocol, T012/T013/T014/T016, and this note; emit exact plugin names/methods/DTOs/registration order plus the first worker allowlist.
- Stop: any implementation edit, plugin registration, manifest/Gradle/UI change, raw path/URI DTO, generic writer, or weakening of frozen reader/writer contracts.

### T032 — deterministic host dependency/security baseline

- Allowed files: `android/build.gradle`, `android/app/build.gradle`, new `scripts/verify-android-release-security.mjs`, new `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/HostSecurityContractTest.java`.
- Verify: focused JVM contract test, debug/release merged manifests, APK permissions/components, debug lint, unsigned release assembly, and both frozen legacy verifiers.
- Stop: network/Google/analytics dependency becomes required, signing values are read, or any reader/writer/UI/Kotlin-reference/device/Play file changes.

### T033 — offline asset content integrity

- Allowed files: `scripts/inject-service-worker-manifest.mjs`, `scripts/verify-offline-assets.mjs`, new `scripts/verify-android-packaged-assets.mjs`, and focused tests under `tests/offline/`.
- Verify: production build, service-worker content digest determinism, every `dist` file byte-equal to packaged Android, exact documented generated extras only, zero remote runtime asset, and offline verifier PASS.
- Stop: a React/HTML visible decision, remote runtime dependency, native source change, or hand-edited `dist`/Android asset is required.

### T034 — trusted local-origin WebView shell

- Allowed files: `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java`, new `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/security/PdfChefWebViewPolicy.java`, new focused JVM/instrumentation tests under the matching `security/` package, and new `scripts/verify-android-webview-security.mjs`.
- Verify: local packaged origin works; attempted remote, file, content, intent, javascript, redirect, and popup navigation cannot invoke plugins; mixed/file/content access and release debugging are off; external-link behavior remains unchanged unless Claude owns it; legacy bridge runtime remains PASS.
- Stop: Capacitor internals must be patched, existing plugin discovery weakens, a visible link/recovery choice is required, or registration count changes.

### T035 — Claude-owned packaged frontend security

- Allowed files: `index.tsx`, `index.html`, new `tests/security/nativeFrontendShell.test.ts`, `DESIGN.md`, and the relevant design-system page override only.
- Verify: Claude Code Opus 5 High verdict, production build, browser tests, native-aware service-worker behavior, CSP/navigation contract, web/iOS parity, and screenshot/console review if visible output changes.
- Stop: exact Claude model unavailable, CSP requires remote assets, or unrelated React/tool styling changes.

### T036 — inactive owned pending-import staging

- Allowed files: new `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentIngressPolicy.java`, `OwnedPendingImportStore.java`, `PendingImportRecord.java`, and matching JVM tests under `android/app/src/test/java/.../documents/`.
- Verify: exact action/scheme/MIME/count/size/magic/grant matrices; bounded owned copy; fsync and atomic pending-record publication; restart/idempotence/low-storage/cancellation; no raw URI/path in records or errors; no source/index/settings mutation.
- Stop: `file://`, HTTP(S), raw provider address, unbounded copy, grant-only durability, manifest/MainActivity/plugin/React change, or a generic cleanup sweep appears.

### T037 — inactive local picker controller

- Allowed files: new `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentPickerController.java`, `PickerRequestPolicy.java`, and matching JVM/instrumentation tests under `.../documents/`.
- Verify: exact MIME and count bounds, cancellation, revoked/failed persistable grants, owned staging handoff through T036, lifecycle recreation, and no visible routing.
- Stop: picker UI/copy is required, raw URI crosses the bridge, grant persistence is treated as durability, or T036 staging must change.

### T038 — inactive opaque legacy open resolver

- Allowed files: new `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/LegacyDocumentOpenResolver.java`, `BoundedDocumentReader.java`, and matching JVM/instrumentation tests under `.../documents/`.
- Verify: reparse committed index for each ref, canonical no-follow containment, identity revalidation, 512 KiB maximum chunks, missing/revoked/corrupt/refusal errors, collection rejection, and recursive no-mutation manifests.
- Stop: a prior snapshot is trusted, path/name/URI is accepted from JavaScript or returned, read triggers repair/prune/cleanup, or frozen T013 source changes.

### T039 — inactive retain/export/share services

- Allowed files: new `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/OwnedDocumentWriter.java`, `AndroidDocumentExporter.java`, `AndroidDocumentSharer.java`, new `android/app/src/main/res/xml/file_paths.xml`, and matching tests under `.../documents/`.
- Verify: bounded staged retain with fsync/atomic commit; MediaStore pending/rollback; non-exported narrow FileProvider configuration; read-only grants; delayed-recipient staging; owned cleanup; file and collection outcomes tested separately.
- Stop: broad provider root, write grant, storage permission, implicit collection ZIP/coercion, direct overwrite, second full-library copy, or manifest activation is required.

### T040 — privileged document plugin and host activation

- Allowed files: the exact plugin file(s) named by T031, `MainActivity.java`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/xml/file_paths.xml`, both legacy registration contract tests, both legacy verifiers, and new plugin contract/instrumentation tests only.
- Verify: T031 exact method catalogue and registration order; T032–T039 security/runtime gates; content-only VIEW/SEND/SEND_MULTIPLE; merged manifest/APK allowlist; bridge unavailable off local origin; ordinary legacy reader/writer behavior unchanged.
- Stop: security/origin/staging prerequisites are incomplete, `file://` appears, extra permission/export/provider scope appears, a visible route is required, or frozen data semantics weaken.

### T041 — non-activated TypeScript Android document adapter

- Allowed files: new `services/platform/android/androidDocuments.ts`, `androidDocumentContracts.ts`, `androidWorkspacePlatform.ts`, and new focused tests under `tests/platform/android/`; no existing React/bootstrap file.
- Verify: strict DTO validation, address-field rejection, 512 KiB chunk parity, pending acknowledgement, open/export/share/storage mapping, file/collection distinction, and false capability refusal.
- Stop: `index.tsx`, hooks/components, iOS files, browser fallback behavior, or collection coercion must change.

### T042a/T042b/T042c — device adapters

- T042a app metadata owns new `AndroidAppMetadataPlugin.java`, `services/platform/android/androidAppMetadata.ts`, and their focused tests.
- T042b storage stats owns new `AndroidStorageStatsPlugin.java`, `services/platform/android/androidStorageStats.ts`, and their focused tests.
- T042c haptics owns new `AndroidHapticsAdapter.java`, `services/platform/android/androidHaptics.ts`, and their focused tests.
- Verify each separately through strict DTOs, release registration/exclusion rules, and positive emulator discovery; metadata must expose only public app values, storage must not traverse document names, and haptics must accept a closed signal enum.
- Stop if any adapter needs a UI decision, permission, path/filename, telemetry, generic native method, or another adapter's file.

### T043 — non-activated Android settings adapter

- Allowed files: new `services/platform/android/androidSettings.ts`, new `tests/platform/androidSettings.test.ts`, and, only for theme, a typed client for the already accepted writer method.
- Verify: all T012 health states, strict known-key decoding, no default-on-error, no write except exact theme call, and no localStorage/React activation.
- Stop: `DYNAMIC` mapping requires a product choice, generic settings mutation appears, or T012/T013/T014 files drift.

### T044 — Claude Android bootstrap, collections, and no-false-empty recovery

- Allowed files: `index.tsx`, `hooks/useWorkspaceRuntime.tsx`, `components/Pages/RecentPage.tsx`, the exact Android platform factory from T041, focused tests, `DESIGN.md`, and relevant design-system page overrides.
- Verify: exact Claude Code Opus 5 High PASS; Android native discovery; valid legacy rows never become empty browser state; collection routing; bridge/corrupt/partial/bundle/retry states; import/open/export/share journeys; web/iOS parity; accessibility and screenshots.
- Stop: native prerequisite fails, exact Claude unavailable, destructive history mutation is needed, or a separate Android React frontend is proposed.

### T045 — history transaction foundation on the existing coordinator

- Allowed files: `LegacyMutationCoordinator.java`, new `LegacyHistoryMutationJournal.java`, new `LegacyHistoryMutationIo.java`, their focused tests, `PdfChefApplication` contract tests, and a dedicated new history-writer verifier; no plugin/UI activation.
- Verify: the same Application-owned coordinator and lock serialize settings/history; no second coordinator; no-follow identity/hash revalidation; durable journal/stage/fsync/atomic commit; restart matrix; frozen readers and setThemeMode still PASS.
- Stop: a second coordinator/lock/process writer, direct/copy fallback, read-triggered recovery, index/data loss, or Kotlin/UI/Gradle change appears.

### T046a–T046f — one history mutation per sequential worker

- Unique operation files: `LegacyRenameByRef.java`, `LegacyDeleteByRef.java`, `LegacyUndoDeletion.java`, `LegacyBatchDelete.java`, `LegacyClearRecords.java`, and `LegacyExplicitMaintenance.java`, each with its matching test file. Only the active operation may also edit the dedicated history-writer plugin, its contract test, and verifier.
- Verify each with old/new/crash/retry manifests, opaque ref re-resolution, files/collections, corrupt/missing/301-entry states, settings/index/output preservation, and zero skipped tests.
- Stop on partial ambiguity, unowned deletion, implicit prune/orphan sweep, in-memory-only undo, combined clear semantics, or another operation entering the slice.

### T047a–T047g — processor-family workers

- Each worker owns only a new family package under `android/app/src/main/java/.../processors/<family>/`, matching tests under `android/app/src/test` and `androidTest`, its exact assets, and one family-specific plugin contract; storage/registration/UI remain frozen.
- Families: structural; credentials; geometry/edit; image conversion; metadata/text/compare; office including PPTX; compression last.
- Verify against named Kotlin-reference fixtures/tests plus TypeScript contract fixtures, artifact hashes/page geometry/reopenability, cancellation, generic errors, offline behavior, and family-specific memory bounds.
- Stop if parity is inferred from names/screenshots, passwords are normalized/logged, PPTX is duplicated into a special-capability worker, output/history semantics must change, or another family enters the slice.

### T048a–T048d — special Android workers

- Scanner owns only its new scanner controller/plugin, scanner staging tests, and scanner dependency declaration.
- Shortcuts/share targets own only the shortcut router, `shortcuts.xml`/`share_targets.xml`, manifest metadata, and focused tests.
- Widget owns only `ScanWidgetProvider`, widget XML/drawables, manifest receiver, and focused tests.
- Smart Forms owns only a separately approved dynamic-feature module/config/controller/contracts/tests/model-delivery metadata.
- Verify each with merged-manifest/dependency/permission audits, offline/refusal/lifecycle behavior, and no base capability drift.
- Stop on implicit network/Google/analytics activation, document data leaving an approved boundary, invented WorkManager/notification behavior, UI decision without Claude, or Smart Forms entering the base module silently.

### T049 — release, genuine upgrade, performance, signing, and Play campaign

- Allowed files must be installed by separate Judge tasks for version/R8, privacy-safe manifests, predecessor-state harness, benchmark harness, and public-certificate receipts; credentials and Play writes are never source-file inputs.
- Verify in order: source/fixture/artifact hashes; update-capable minified test artifacts; strict API 29/36 `adb install -r` matrices; same-hardware predecessor/host/bridge tax; first-upgrade and steady-state repeated measurements; offline/R8/APK/AAB; physical candidate; public upload/Play fingerprints; approved Play internal update.
- Stop on uninstall/clear/downgrade/`-d`, version not greater than selected predecessor and highest Play version, mismatched signer, data loss, repeated migration, crash/ANR/LMK, unmeasured persistent regression, credential exposure, or unapproved Play action.

## Smallest next task

The next task is T031, the read-only Judge contract for the future native plugin catalogue and registration verifier. It must not add a plugin or edit implementation. T031 owns only `notes/T031-native-plugin-catalogue.md` and its board receipt. It must define exact plugin names, methods, DTO envelopes, registration order, verifier supersession, and the security prerequisites for registration.

The first implementation Worker after that design gate is exactly T032. It removes/fails closed on dormant Google Services activation and freezes the current no-network/no-telemetry release manifest and APK contract. T032 owns only `android/build.gradle`, `android/app/build.gradle`, new `scripts/verify-android-release-security.mjs`, and new `HostSecurityContractTest.java`; its complete verify and stop contract is above. T032 does not add or register a plugin.

No privileged plugin registration or runtime intent activation is allowed until T032, T033, T034, and the Claude-owned T035 gate are accepted. T036/T038 may be implemented inactive after their listed prerequisites, but T040 is the only document registration/manifest activation slice.

Broad T015 remains queued until these slices are individually completed.

## Still not checked

- Android product activation and false-empty recovery
- import/open/export/share document lifecycle
- history mutations beyond theme setting
- native processor parity
- scanner, widgets, shortcuts, native PPTX, Smart Forms
- minified/R8 candidate
- genuine installed update continuity
- first-upgrade and steady-state performance
- physical-device candidate behavior
- signing compatibility and highest Play version
- Play internal update and production telemetry

`FIRST_UPGRADE_PERFORMANCE: NOT CHECKED`

`STEADY_STATE_PERFORMANCE: NOT CHECKED`

`SIGNING_UPDATE_COMPATIBILITY: NOT CHECKED`

`PLAY_INTERNAL_UPGRADE: NOT CHECKED`

`PHYSICAL_DEVICE: NOT CHECKED`

`PRODUCTION_RELEASE_READY: NO`
