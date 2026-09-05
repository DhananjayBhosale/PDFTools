# T031 — native plugin catalogue and registration gates

## Decision

This note freezes the future native bridge catalogue and the implementation-before-registration rule. It does not implement, register, activate, build, or test any new capability.

Current runtime remains exactly:

1. `AndroidLegacyInspectorPlugin`
2. `AndroidLegacySettingsWriterPlugin`
3. `super.onCreate(savedInstanceState)`

No third plugin is authorized by T031. T032 remains the first bounded implementation Worker and adds no plugin or registration.

`PRODUCTION_RELEASE_READY: NO`

## Universal wire rules

- Every request is an own, plain JSON object with exact keys. Unknown, inherited, duplicate, coercible, or missing fields are rejected.
- Safe integers only. Counts, offsets, sizes, and timestamps are non-negative; positive values are required where named.
- Maximum bridge byte chunk is exactly 524,288 decoded bytes. Base64 must be canonical and decode within that bound.
- General arrays are capped at 100 items. External/picker input is additionally capped at 100 items, 128 MiB per item, and 256 MiB aggregate. These are conservative security ceilings, not claims of Kotlin parity; a later task may only lower them without a new Judge.
- General strings are NUL-free and at most 1,024 Unicode code points unless a smaller field bound is named. User-visible display names are at most 120 code points. MIME strings are at most 128 ASCII characters.
- Durable refs are opaque. Accepted legacy refs are canonical `a1_<positive safe base-10 id>`. Future owned refs use `d1_<22..64 base64url characters>`. Write sessions use `w1_`, operations use `o1_`, history transactions use `h1_`, and batches use `b1_` with the same 22..64 base64url payload rule.
- No request or success/error result may contain a filesystem path, stored filename, URI, URL, provider address, bookmark, grant token, intent, raw preference bytes, document-derived text, password echo, stack, exception text, or unrestricted diagnostic object.
- Every rejection uses one fixed allowlisted code and fixed generic message. Retryability is encoded by the code contract, not arbitrary native details.
- Common codes: `INVALID_ARGUMENT`, `UNAVAILABLE`, `NOT_FOUND`, `BUSY`, `CANCELLED`, `LIMIT_EXCEEDED`, `STORAGE_FULL`, `CORRUPT`, `UNSAFE_STATE`, `INTERRUPTED`, `FAILED`. Each plugin prefixes these with its namespace where ambiguity exists.
- Plugin instances own no durable state, session registry, lock, executor, or coordinator. They obtain Application-owned services and act as thin local-origin facades.
- Proxy shape, class presence, reflection, compile success, source ordering, and `capacitor.plugins.json` are not availability evidence.

## Application ownership

- The existing `LegacyMutationCoordinator` and its process-wide lock remain the sole settings/history mutation owner. It may be extended through accepted tasks; no second settings/history coordinator or lock is permitted.
- Future `DocumentLifecycleCoordinator` owns write sessions, pending-import records, ref resolution, picker handoff, export/share sessions, and owned-document state.
- Future `PdfOperationCoordinator` owns one bounded executor, operation journal, cancellation, result acknowledgement, and family-plugin delegation. There is no generic processor-control plugin.
- Future `LaunchCoordinator` owns `onCreate`/`onNewIntent` routing and stages external content before JavaScript readiness.
- Future Smart Forms coordinator owns install/launch state and returns outputs through owned pending imports.
- Application construction remains no-I/O. Coordinators are eagerly owned or lazily initialized without touching storage; all storage work begins only on an explicit method/intent.
- No release secondary process may mutate settings, history, documents, or operation journals. A future process must be read-only or route mutations to the main-process owner.

## Frozen existing plugins

### `AndroidLegacyInspectorPlugin` / `AndroidLegacyInspector`

Methods remain exactly:

- `readHistory({}) -> AndroidLegacyHistorySnapshot`
- `readSettings({}) -> AndroidLegacySettingsSnapshot`

T012/T013 own every DTO and health state. No mutation, defaulting, repair, prune, orphan cleanup, path exposure, recursive children, or extra method is allowed.

Implementation task: accepted T013. Registration/runtime proof: accepted T013/T021. Verifier: `verify-android-legacy-inspector.mjs` plus its 24-test contract. Activation remains non-product until Claude-owned Android bootstrap.

### `AndroidLegacySettingsWriterPlugin` / `AndroidLegacySettingsWriter`

Current method remains exactly:

- `setThemeMode({mode:"SYSTEM"|"DYNAMIC"|"LIGHT"|"DARK"}) -> {mode, changed:boolean}`

Reserved future exact operations, each requiring its own implementation and exposure gate:

- `setAppFontOption({option:<closed approved font id>}) -> {option, changed}`
- `setOnboardingCompleted({completed:boolean}) -> {completed, changed}`
- `setLastPrivacyLineIndex({index:non-negative integer}) -> {index, changed}`
- `recordToolRun({toolId:<closed tool id>, previousToolId?:<closed tool id>}) -> {changed}`
- `addSavings({bytesSaved:non-negative integer, filesReduced:non-negative integer}) -> {changed}`
- `setToolOption({toolId:<closed tool id>, option:NUL-free bounded opaque string}) -> {changed}`

Forbidden forever: `saveSettings`, `replaceSettings`, `clearSettings`, writable encoded JSON maps, generic key/value methods, and whole-map serialization. Every future operation patches only its target raw protobuf slices and preserves all unrelated/unknown/duplicate/noncanonical bytes.

Implementation/runtime proof: accepted only for `setThemeMode` in T014/T029. Verifier: `verify-android-legacy-theme-writer.mjs`. Product activation remains Claude-gated.

## Document plugin

### `AndroidDocumentsPlugin` / `AndroidDocuments`

One document facade is used for owned document lifecycle and validated legacy reads. It excludes settings, history mutations, device adapters, processors, scanner, shortcuts, and Smart Forms.

Common item DTOs:

```text
FileItem = {
  kind:"file", ref, displayName:string|null, mimeType:string|null,
  sizeBytes:non-negative integer, contentHash:lowercase SHA-256|null,
  createdAt:non-negative integer|null, available:boolean, pending:boolean
}

CollectionItem = {
  kind:"collection", ref, displayName:string|null,
  itemCount:positive integer, sizeBytes:non-negative integer|null,
  createdAt:non-negative integer|null, available:boolean, pending:boolean
}
```

No collection child list crosses the bridge. Collections may be listed, statted, exported, or shared only through an explicit collection outcome; `readChunk` always rejects them.

Exact methods:

- `beginWrite({displayName?:string,mimeType?:string}) -> {sessionRef, maximumChunkBytes:524288}`
- `appendWrite({sessionRef,data:<bounded base64>}) -> {acceptedBytes}`
- `finishWrite({sessionRef}) -> {item:FileItem}`
- `abortWrite({sessionRef}) -> {aborted:boolean}`
- `readChunk({ref,offset,length:1..524288}) -> {data:<bounded base64>,nextOffset,done:boolean}`
- `stat({ref}) -> {item:FileItem|CollectionItem}`
- `exists({ref}) -> {exists:boolean}`
- `listItems({limit:1..300,cursor?:<opaque bounded token>}) -> {items:(FileItem|CollectionItem)[],nextCursor:string|null}`
- `takePendingImports({}) -> {batchRef,items:FileItem[]}` with non-destructive peek semantics
- `acknowledgePendingImports({batchRef,refs:d1_ref[1..100]}) -> {acknowledgedCount}`
- `pickDocuments({acceptedMimeTypes:<closed subset>,maximumItems:1..100}) -> {status:"accepted"|"cancelled",batchRef:string|null,items:FileItem[]}`
- `exportItem({ref,displayName?:string,mimeType?:string}) -> {status:"completed"|"cancelled"}`
- `shareItem({ref,displayName?:string,mimeType?:string}) -> {status:"completed"|"cancelled"}`
- listener `pendingImportReady({batchRef,itemCount})`

Closed picker MIME set: `application/pdf`, `image/jpeg`, `image/png`, `image/heic`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, and `application/vnd.openxmlformats-officedocument.presentationml.presentation`.

Owned-document mutation methods are deliberately absent from the first registration. A later documents-mutation task may add `renameOwned`, `deleteOwned`, and `clearOwned` only after atomic owned-index semantics and per-method positive proof. These methods never accept `a1_` legacy refs. Legacy history mutation remains the separate history writer.

Implementation tasks: T036 staging, T037 picker, T038 legacy open, T039 owned retain/export/share, and any separately installed owned-mutation task. T038 is explicitly independent of T036: it depends only on T031, T032, and T034 and may proceed concurrently with intake work. T036 and T038 converge only at registration.

Registration task: T040, only after T032–T035 and every method included in the registered class has completed focused proof. T040 may initially register only the exact method set above that has real implementation; the TypeScript T041 interface must match that exact set and must not declare absent methods. Verifier: new `verify-android-documents.mjs`, document plugin contract tests, and the master catalogue verifier described below.

Privacy boundary: incoming/picker bytes are copied into owned app-private staging before acknowledgement. Temporary grants are not durable storage. External actions are exact VIEW/SEND/SEND_MULTIPLE, `content://` only, never BROWSABLE/file/http/https. MediaStore export uses pending/rollback; FileProvider share is non-exported, read-only, and limited to named processed/share-staging roots.

## Device plugins

### `AndroidAppMetadataPlugin` / `AndroidAppMetadata`

- `getMetadata({}) -> {name:non-empty string,version:non-empty string,build:string|null}`

Public manifest/package values only. No installer identity, signer, path, device ID, channel, or telemetry. Implementation T042a-i; registration/discovery T042a-r after T032–T035. Verifier: `verify-android-app-metadata.mjs`.

### `AndroidStorageStatsPlugin` / `AndroidStorageStats`

- `getStorageStats({}) -> {retainedBytes,availableBytes:integer|null,capacityBytes:integer|null}`

Retained bytes count only approved owned roots and must not emit/enumerate names. Implementation T042b-i; registration/discovery T042b-r after T032–T035. Verifier: `verify-android-storage-stats.mjs`.

### `AndroidHapticsAdapter` / `AndroidHaptics`

- `signal({signal:"selection"|"commit"|"warning"|"error"}) -> {}`

No arbitrary duration/amplitude/pattern or permission. Implementation T042c-i; registration/discovery T042c-r after T032–T035. Verifier: `verify-android-haptics.mjs`.

## Legacy history mutation plugin

### `AndroidLegacyHistoryWriterPlugin` / `AndroidLegacyHistoryWriter`

The class is not registered until its first implemented operation is accepted. Each later annotated method has a separate exposure gate and positive runtime invocation; plugin-level availability is never interpreted as support for an absent method.

Reserved exact operations:

- `rename({ref:a1_ref,displayName:string,transactionRef:h1_ref}) -> {ref,displayName,changed}`
- `deleteOne({ref:a1_ref,transactionRef:h1_ref}) -> {deleted:boolean,freedBytes}`
- `beginUndoableDelete({refs:a1_ref[1..100],transactionRef:h1_ref}) -> {transactionRef,acceptedCount}`
- `undoDelete({transactionRef}) -> {restoredCount}`
- `commitDelete({transactionRef}) -> {deletedRefs:a1_ref[],retainedRefs:a1_ref[],freedBytes}`
- `deleteBatch({refs:a1_ref[1..100],transactionRef:h1_ref}) -> {deletedRefs,retainedRefs,freedBytes}`
- `clearRecords({transactionRef}) -> {clearedCount}`
- `clearDocuments({transactionRef}) -> {deletedCount,retainedCount,freedBytes}`
- `planMaintenance({}) -> {planRef:h1_ref,candidateCount,estimatedBytes}`
- `commitMaintenance({planRef,transactionRef}) -> {deletedCount,retainedCount,freedBytes}`

All mutations reuse the existing Application-owned `LegacyMutationCoordinator`. No read-triggered recovery, generic mutation, broad stale-temp sweep, direct overwrite, copy/delete fallback, path input, or second lock exists.

Implementation: T045 foundation then one T046 operation task at a time. First registration/exposure gate: T046a-r after the first operation's crash/restart proof. Later methods use T046b-r onward. Verifier: `verify-android-legacy-history-writer.mjs` plus master catalogue verifier.

## Processor family plugins

Every family is a separate plugin, implementation, verifier, registration gate, and availability claim. There is no generic `process(toolId,options)` or shared processor-control plugin.

All start methods return `{operationRef:o1_ref}`. Every family repeats:

- `getStatus({operationRef}) -> {state:"queued"|"running"|"succeeded"|"failed"|"cancelled"|"interrupted",progressPercent:integer|null,resultRefs:d1_ref[],errorCode:string|null}`
- `cancel({operationRef}) -> {cancelled:boolean}`
- `acknowledgeResult({operationRef}) -> {acknowledged:boolean}`

Only `succeeded` may contain result refs. Status exposes no filenames, paths, messages, passwords, or engine details. Every plugin delegates to the one Application-owned `PdfOperationCoordinator`.

### `AndroidPdfStructuralPlugin` / `AndroidPdfStructural`

- `merge({inputRefs:ref[2..100]})`
- `split({inputRef,mode:"pagesPerFile"|"maximumBytes",pagesPerFile?:positive integer,maximumBytes?:positive integer})`
- `extractPages({inputRef,pageIndices:unique non-negative integer[1..10000]})`
- `deletePages({inputRef,pageIndices:unique non-negative integer[1..10000]})`
- `reorderPages({inputRef,pageOrder:non-negative integer[1..10000]})`
- `flatten({inputRef})`
- `repair({inputRef})`

Implementation T047a-i; registration T047a-r; verifier `verify-android-pdf-structural.mjs`.

### `AndroidPdfCredentialsPlugin` / `AndroidPdfCredentials`

- `protect({inputRef,password:NUL-free 4..1024 code points})`
- `unlock({inputRef,password:NUL-free 1..1024 code points})`

Passwords are preserved exactly, including leading/trailing whitespace, and never logged, echoed, persisted, or placed in operation journals. Implementation T047b-i; registration T047b-r; verifier `verify-android-pdf-credentials.mjs`.

### `AndroidPdfOverlaysPlugin` / `AndroidPdfOverlays`

- `watermark({inputRef,text,opacityPermille:0..1000,rotationDegrees:-360..360,position:<closed position>,pageIndices?:unique indices})`
- `addPageNumbers({inputRef,position:<closed position>,startNumber:integer,format:<closed format>,pageIndices?:unique indices})`
- `sign({inputRef,signatureRef:d1_ref,placements:<bounded placement>[1..1000]})`
- `rotatePages({inputRef,pageIndices:unique indices,degrees:-359..359})`
- `applyEdits({inputRef,edits:<strict bounded edit union>[1..5000]})`

Placement/edit DTOs use normalized or page-space numeric geometry only; no arbitrary scripts/HTML/fonts/paths. Exact geometry unions are frozen by T047c before implementation and may not add a generic map. Implementation T047c-i; registration T047c-r; verifier `verify-android-pdf-overlays.mjs`.

### `AndroidPdfImagesPlugin` / `AndroidPdfImages`

- `makePdf({inputRefs:ref[1..100],layout:<closed layout>,pageSize:<closed size>})`
- `imagesToPdf({inputRefs:ref[1..100],layout:<closed layout>,pageSize:<closed size>})`
- `pdfToImages({inputRef,format:"jpeg"|"png",qualityPercent:1..100,scalePermille:100..4000,pageIndices?:unique indices})`

Implementation T047d-i; registration T047d-r; verifier `verify-android-pdf-images.mjs`.

### `AndroidPdfReportsPlugin` / `AndroidPdfReports`

- `updateMetadata({inputRef,title?:string|null,author?:string|null,subject?:string|null,keywords?:string|null,clearAll:boolean})`
- `extractText({inputRef})`
- `compare({leftRef,rightRef})`

`extractText` means existing selectable text, not OCR. Compare returns an owned report ref, not raw document text. Implementation T047e-i; registration T047e-r; verifier `verify-android-pdf-reports.mjs`.

### `AndroidOfficeConversionPlugin` / `AndroidOfficeConversion`

- `pdfToWord({inputRef})`
- `wordToPdf({inputRef})`
- `powerPointToPdf({inputRef})`

PPTX belongs only here, not in a second fallback plugin. Fidelity/limits are explicit result metadata owned by T047f; no remote rendering. Implementation T047f-i; registration T047f-r; verifier `verify-android-office-conversion.mjs`.

### `AndroidPdfCompressionPlugin` / `AndroidPdfCompression`

- `compress({inputRef,profile:"gentle"|"balanced"|"strong",rasterFallback:boolean,targetBytes:positive integer|null})`

Target bytes are a goal, not a promise. Raster fallback must be explicit. Implementation T047g-i last; registration T047g-r; verifier `verify-android-pdf-compression.mjs` plus measured performance gates.

## Special Android plugins and non-plugin components

### `AndroidDocumentScannerPlugin` / `AndroidDocumentScanner`

- `scan({}) -> {status:"queued"|"cancelled",batchRef:b1_ref|null}`

No scanner URI or image path crosses the bridge. Output enters T036 owned staging and ordinary pending-import delivery. Implementation T048a-i; registration T048a-r after scanner dependency/privacy/offline/lifecycle proof and T036/T039/T040. Verifier: `verify-android-document-scanner.mjs`.

### `AndroidToolShortcutsPlugin` / `AndroidToolShortcuts`

- `replaceDynamicShortcuts({toolIds:<closed tool id>[0..4]}) -> {appliedCount}`

Labels, URIs, history payloads, and arbitrary routes are native-owned. Implementation T048b-i; registration T048b-r after launch-route/content-only ingress and Claude routing proof. Verifier: `verify-android-tool-shortcuts.mjs`.

### `AndroidSmartFormsPlugin` / `AndroidSmartForms`

- `getStatus({}) -> {status:"unsupported"|"not_installed"|"installing"|"installed"|"failed"}`
- `requestInstall({}) -> {status:<same closed status>}`
- `launch({inputRef}) -> {status:"queued"|"cancelled",operationRef:o1_ref|null}`

Outputs return only through owned refs/pending imports. Implementation T048d-i; registration T048d-r last after dynamic-feature/SplitCompat/Play Delivery/model digest/ONNX/native-lib/memory/cancellation/output-import evidence and Claude-visible install-state review. Verifier: `verify-android-smart-forms.mjs`.

The scan widget is not a plugin. T048c activates only a stateless `AppWidgetProvider`, RemoteViews/resources, immutable explicit PendingIntent, manifest receiver, `updatePeriod=0`, and APK component audit. Incoming content parsing/copying, picker/scanner ActivityResult controllers, pending stores, resolvers/readers, writers/exporters/sharers, launch routing, processor engines, coordinators, FileProvider, MediaStore services, shortcut/share-target XML, widget internals, and Smart Forms feature/model internals are not plugins.

## Exact registration order and gates

Registration is append-only and identical in debug/release for accepted production plugins:

1. `AndroidLegacyInspectorPlugin`
2. `AndroidLegacySettingsWriterPlugin`
3. `AndroidDocumentsPlugin` — T040
4. `AndroidAppMetadataPlugin` — T042a-r
5. `AndroidStorageStatsPlugin` — T042b-r
6. `AndroidHapticsAdapter` — T042c-r
7. `AndroidLegacyHistoryWriterPlugin` — first T046 registration gate
8. processor plugins in T047a through T047g order
9. `AndroidDocumentScannerPlugin` — T048a-r
10. `AndroidToolShortcutsPlugin` — T048b-r
11. `AndroidSmartFormsPlugin` — T048d-r
12. `super.onCreate(savedInstanceState)`

No widget plugin exists. Debug crash service/controller are not plugins and remain excluded from release. Build variants may not diverge in registered production plugin order or method catalogue.

Every registration gate follows this sequence:

1. implementation exists but remains unregistered;
2. strict contract/JVM tests and plugin-specific verifier pass;
3. security, storage, dependency, manifest, and release-exclusion prerequisites pass;
4. registration task edits `MainActivity`, the master catalogue contract/verifier, both legacy registration assertions, and the plugin-specific registration contract only;
5. exact debug artifact is built;
6. disposable emulator with explicit serial proves `Capacitor.isPluginAvailable(exactName) === true` and invokes at least one real method with strict success/error validation;
7. unsupported platform/variant does not falsely report availability;
8. ordinary inspector reads and `setThemeMode` remain unchanged;
9. merged debug/release manifests, APK classes, release dex, permission/component allowlists, and plugin order pass;
10. only then may a separately typed client expose the capability; product use remains Claude-gated.

If a plugin later gains a method, that method repeats steps 1–9 before the TypeScript client declares it. No placeholder method, default success, generic unavailable shim, or proxy-only feature claim is allowed.

## Verifier supersession

Until T040, both legacy verifiers continue requiring exactly two registrations.

At T040 only:

- add `scripts/verify-android-plugin-catalogue.mjs` and `AndroidPluginCatalogueContractTest.java`;
- change only the registration-count/onCreate-order assertions in `verify-android-legacy-inspector.mjs`, `verify-android-legacy-theme-writer.mjs`, `AndroidLegacyInspectorContractTest.java`, and `AndroidLegacySettingsWriterContractTest.java`;
- preserve every existing reader/writer method, DTO, privacy, hash, Application/coordinator, debug-crash, and release-exclusion assertion;
- require the first two registrations exactly once and in their original relative order;
- require `onCreate` to contain only the exact accepted append-only registration list followed by `super`;
- require every appended class to have one plugin-specific verifier/contract and one accepted registration receipt.

Each later registration task updates only `MainActivity`, the master catalogue verifier/contract, the relevant plugin-specific verifier/contract, and the legacy registration-order expected list. It may not weaken existing checks.

## Activation boundaries

- T032 is preserved exactly: only `android/build.gradle`, `android/app/build.gradle`, new `verify-android-release-security.mjs`, and new `HostSecurityContractTest.java`. It removes/fails closed on dormant Google Services activation and freezes no-network/no-telemetry release invariants. It adds no plugin.
- T033 offline integrity, T034 trusted local-origin shell, and Claude-owned T035 frontend security must pass before T040 or any later privileged registration.
- T038 opaque legacy open is independent of T036 intake and depends only on T031/T032/T034 plus its own proof.
- No Android bootstrap may fall back to empty browser history when a native bridge is absent or unhealthy. Claude-owned T044 must route closed health/recovery states explicitly.
- No product capability is active merely because its plugin is registered. TypeScript client proof precedes Claude product activation.
- Broad T015 stays queued. T032 is the only next implementation task allowed after T031 acceptance.

## Hard stops

- Any implementation, registration, manifest/Gradle/React/UI/Kotlin-reference/build/device/signing/Play change during T031.
- Any raw address or secret in a DTO, unbounded payload, collection-to-file coercion, generic writer/processor/device method, or plugin-owned durable state.
- Any second history/settings coordinator or process-local writer outside the Application owner.
- Registration before implementation/proof, build-variant catalogue drift, placeholder availability, or source/class presence presented as runtime proof.
- `file://`/HTTP(S)/BROWSABLE document ingress, grant-only durability, broad FileProvider root, write grant, unexpected permission/exported component, remote runtime asset, or Google/analytics auto-activation.
- Any weakening of T012/T013/T014/T016/T021/T029 semantics or evidence honesty.

