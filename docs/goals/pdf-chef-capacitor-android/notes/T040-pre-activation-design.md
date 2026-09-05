# T040 pre-activation design

## Judge decision

`ACCEPT` the smallest honest registration: `AndroidDocuments` exposes exactly one method, `readChunk`. T040 also installs the already accepted T036-T039 graph and the T039 FileProvider boundary. It does not expose write, abort, stat, exists, list, pending-import, picker, export, share, listener, or mutation methods. Class presence, coordinator methods, and provider registration are not method availability.

This deliberately narrows the initial T031 catalogue. The omitted methods require DTO/default/lifecycle adapters that are not yet accepted: write metadata is not durably carried across sessions, picker results do not yet expose complete `FileItem` values through the coordinator, and optional export/share metadata cannot be derived through the frozen facade. Adding placeholders or stricter-but-different versions would be a false compatibility claim. T041 must type only `readChunk`; each later method repeats implementation, registration, runtime, and client gates.

## Exact bridge surface

Plugin annotation: `@CapacitorPlugin(name = "AndroidDocuments")`. The public final plugin has a public zero-argument constructor, no permissions, request codes, listeners, durable state, resolver, store, service graph, or fallback coordinator, and exactly one promise method:

```text
readChunk({ref, offset, length})
  -> {data:<canonical base64>, nextOffset, done}
```

- Input has exactly three own fields. `ref` is a canonical `a1_<positive decimal>` or `d1_<accepted opaque payload>` string; `offset` is an integer in `0..9007199254740991`; `length` is an integer in `1..524288`. Null, coercion, whitespace normalization, raw URI/path/filename, extra fields, and non-finite/fractional numbers are rejected.
- `a1_` reads delegate to the accepted T038 resolver. `d1_` reads delegate to the accepted T039 owned source. Both paths revalidate identity around the bounded read; `offset == EOF` returns empty data with `done=true`; past EOF is invalid. A legacy collection returns the fixed collection-unsupported outcome and is never coerced to a file.
- The coordinator returns a cloned bounded chunk. Base64 is produced only after the bounded native read. Output contains only `data`, `nextOffset`, and `done`; no address, name, MIME, exception text, raw record, or filesystem state crosses the bridge.
- The plugin obtains the coordinator only from `PdfChefApplication.getDocumentLifecycleCoordinator()`. It never constructs a coordinator or a reader. Fixed allowlisted error codes/messages are used for invalid argument, not found, corrupt, unavailable, unsafe state, and collection unsupported; unexpected exceptions become generic unavailable without logging or exception text.
- Every other T031 `AndroidDocuments` method and `pendingImportReady` remain absent from the class and therefore unavailable to Capacitor.

The only T039 source extension is a synchronized, read-only coordinator `readChunk` facade for `a1_` and `d1_`. It may compose existing accepted reader/source primitives but may not change T036-T039 persistence, cleanup, bounds, refs, error semantics, or hashes of any other accepted service. Focused tests must cover both ref families, EOF, bounds, collection refusal, replacement/identity failure, cloned bytes, and no mutation.

## Application ownership

Both build-type `PdfChefApplication` classes own exactly these sibling domain coordinators:

```text
one Application
  -> one final LegacyMutationCoordinator (T014; debug remains crash-controller decorated)
  -> one final DocumentLifecycleCoordinator (sole T036-T039 graph owner)
```

`DocumentLifecycleCoordinator` remains graph-lazy: constructing it creates no directory, file, store, resolver, picker, writer, exporter, or sharer and performs no storage I/O. To make a final Application field safe before Android attaches the base context, its production constructor may retain the supplied `Application` when `getApplicationContext()` is temporarily null; a null application context from any non-`Application` context is rejected. The first explicit document method alone may construct the graph. There is no `onCreate`, `attachBaseContext`, lifecycle callback, static singleton, second persistence owner, or cross-process document component.

Release adds exactly one private final document field and public getter while preserving the accepted legacy field/getter. Debug adds the same field/getter while preserving exactly one disarmed `LegacyThemeCrashController`, exactly one controller-decorated legacy coordinator, the package-private crash-controller accessor, and all T014 process-kill behavior. The document coordinator is never decorated by or exposed to the crash controller. Normalizing away the exact document import/field/getter must reproduce the accepted release and debug Application sources. No accepted T014 reader, patcher, coordinator, crash service/controller, writer plugin, or process-kill harness changes.

## Registration and trusted-origin boundary

`MainActivity.onCreate` is exactly:

```text
registerPlugin(AndroidLegacyInspectorPlugin.class);
registerPlugin(AndroidLegacySettingsWriterPlugin.class);
registerPlugin(AndroidDocumentsPlugin.class);
super.onCreate(savedInstanceState);
```

The new import and third registration are the only authorized MainActivity changes. Normalizing them away must reproduce accepted hash `e686675ebe6d29a695dfdf3fe8d20d4d6435c5fa439b77d7a88088ccec0e7ba5`. T034's pre-Bridge `load()` hardening, exact `https://localhost` origin, WebView and ServiceWorker remote refusal, popup/redirect refusal, and external HTTP(S)/mailto handoff remain byte-identical. Debug and release use the same three-plugin order.

## FileProvider contract and runtime proof

The production manifest adds exactly one provider:

```xml
<provider
    android:name=".documents.ReadOnlyDocumentFileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>
```

`ReadOnlyDocumentFileProvider` is a minimal `androidx.core.content.FileProvider` subclass that accepts only read mode and rejects `openFile` write modes plus insert, update, and delete. It has no state or path logic. No permission, intent filter, write/persistable/prefix grant, storage permission, dependency, or broad root is added. `file_paths.xml` stays byte-identical to accepted hash `ef9f6c8b2cdd1e50d964eae3057e9d33aa404939e4ababdd72499bf50a4326f5`: only `files/pdfchef_documents/share/` is exposed; files/cache roots, `.`, processed/index, pending, DataStore, WebView, external, and root paths remain excluded. Debug/release authority expansion must be exactly `com.dhananjaytech.pdfchef.debug.fileprovider` and `com.dhananjaytech.pdfchef.fileprovider`.

A disposable-emulator test APK may contain one explicit exported recipient probe service solely to run under the test-package UID. It must not merge into target debug/release manifests or DEX. The test must prove all of the following with real Binder/provider calls:

1. An accepted staged file produces the one canonical FileProvider URI and the coordinator accepts that exact URI.
2. The separate test UID cannot read before a grant.
3. Dispatching the exact T039 intent with only `FLAG_GRANT_READ_URI_PERMISSION` lets that UID read exact bytes.
4. That UID cannot open for write, truncate, insert, update, or delete; no write grant exists.
5. `getUriForFile` rejects an app-private file outside the one XML root, and crafted traversal/out-of-root URIs cannot be opened.
6. Revocation removes recipient access; source/stage manifests show no unintended mutation. Cleanup removes only test-created nodes.

The emulator must be newly disposable/API 36, selected by exact `ANDROID_SERIAL`, and prove QEMU identity. A visible physical device is never targeted or used as fallback.

## Verifier supersession

Add `verify-android-documents.mjs`, `verify-android-plugin-catalogue.mjs`, and their focused contracts. Supersession is mechanical, not a relaxation:

- legacy inspector verifier/contract: change only the expected registration list/count to the three-item order;
- legacy writer verifier/contract: make the same registration change and allow only the exact document field/getter in both Applications; retain every T013/T014 method, DTO, privacy, frozen-source, sole legacy owner, debug-controller, release exclusion, and crash assertion;
- WebView verifier: change only the registration list/count and require the normalized MainActivity to equal the accepted source;
- host-skeleton and release-security verifiers: replace only the obsolete no-FileProvider/component catalogue assertion with the exact provider above; retain no INTERNET/storage permission, no remote server, no telemetry SDK, exact identities, and all other component/permission/DEX assertions;
- document-delivery verifier: retain every frozen T036-T039 source/limit/state/privacy assertion, update only the coordinator hash for the additive read/context change and replace its T040-negative assertions with exact Application ownership, plugin subset, provider, and release/test separation assertions.

The master catalogue requires exactly the accepted three registrations, exactly `readChunk` on `AndroidDocuments`, a plugin-specific verifier/contract/receipt, identical variant order, and `super` last. It rejects every absent method name and any frontend registration. `index.tsx` and `App.tsx` remain byte-identical to `bcea3c2eadedd0040f51e393d3862967a403db0d24d225744c37637e4834f537` and `3ab4644e3ffa7bd910a18a994452cab8c89a50420e76746356f3b23679b9fcd5`.

## Exact T040 Worker allowlist

No file outside this list may change:

- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/DocumentLifecycleCoordinator.java`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentsPlugin.java`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/ReadOnlyDocumentFileProvider.java`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/release/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/PdfChefApplication.java`
- `android/app/src/debug/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/PdfChefApplication.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/DocumentLifecycleCoordinatorTest.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentsPluginContractTest.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/AndroidPluginCatalogueContractTest.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacyInspectorContractTest.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterContractTest.java`
- `android/app/src/androidTest/AndroidManifest.xml`
- `android/app/src/androidTest/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/DocumentRecipientProbeService.java`
- `android/app/src/androidTest/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentsPluginInstrumentedTest.java`
- `android/app/src/androidTest/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentFileProviderInstrumentedTest.java`
- `scripts/verify-android-documents.mjs`
- `scripts/verify-android-plugin-catalogue.mjs`
- `scripts/verify-android-document-delivery.mjs`
- `scripts/verify-android-legacy-inspector.mjs`
- `scripts/verify-android-legacy-theme-writer.mjs`
- `scripts/verify-android-webview-security.mjs`
- `scripts/verify-android-host-skeleton.mjs`
- `scripts/verify-android-release-security.mjs`

`file_paths.xml`, all T013/T014/T036-T039 files not named above, Gradle/dependencies, Capacitor config, assets, React/TypeScript, and the Kotlin reference are frozen.

## Required verification

```sh
node scripts/verify-android-documents.mjs
node scripts/verify-android-plugin-catalogue.mjs
node scripts/verify-android-document-delivery.mjs
node scripts/verify-android-legacy-inspector.mjs
node scripts/verify-android-legacy-theme-writer.mjs
node scripts/verify-android-webview-security.mjs
node scripts/verify-android-host-skeleton.mjs

env JAVA_HOME=/Users/dhananjaybhosale/.local/share/pdf-chef/toolchains/temurin-21/Contents/Home android/gradlew -p android --no-daemon :app:testDebugUnitTest --tests '*documents.DocumentLifecycleCoordinatorTest' --tests '*documents.AndroidDocumentsPluginContractTest' --tests '*AndroidPluginCatalogueContractTest' --tests '*legacy.AndroidLegacyInspectorContractTest' --tests '*legacy.AndroidLegacySettingsWriterContractTest'

env JAVA_HOME=/Users/dhananjaybhosale/.local/share/pdf-chef/toolchains/temurin-21/Contents/Home android/gradlew -p android --no-daemon --rerun-tasks :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleRelease :app:assembleDebugAndroidTest

node scripts/verify-android-release-security.mjs
```

On a newly created disposable API 36 emulator only, after recording exact serial and `ro.kernel.qemu=1`, run exact-class instrumentation for:

- `documents.AndroidDocumentsPluginInstrumentedTest`: `Capacitor.isPluginAvailable("AndroidDocuments") === true`, strict `a1_` and `d1_` `readChunk` success/EOF/error, identical Application coordinator identity, no mutation, and the two legacy plugins still available/functional;
- `documents.AndroidDocumentFileProviderInstrumentedTest`: the six cross-UID provider outcomes above;
- the accepted legacy inspector, legacy writer, and WebView policy instrumented classes as regression gates.

Use `ANDROID_SERIAL=<disposable-emulator>` on every connected-test/adb command. Inspect merged debug/release manifests and APK DEX/component catalogues: the provider is exact in both variants; `AndroidDocumentsPlugin` and the provider exist in both APKs; the recipient probe exists only in the androidTest APK; debug T014 crash components remain excluded from release. Record source and artifact SHA-256 values. Runtime discovery and provider grant claims remain `NOT_CHECKED` unless these exact emulator gates pass.

## Stop conditions and next gate

Stop T040 without workaround if any absent method is needed; a second coordinator/store/resolver is introduced; Application construction performs I/O or cannot remain one-instance; any T014 normalized source/behavior drifts; T034 normalized MainActivity or trusted-origin checks drift; provider proof is same-UID, write-capable, broad-rooted, or test code reaches release; any permission/dependency/frontend/generated-asset/Kotlin-reference change is needed; a disposable emulator is unavailable; a physical device/signing/Play/credential action is requested; or a required verifier/runtime regression fails.

After independent T040 acceptance, the next allowed task is `T041`: add only `services/platform/android/androidDocuments.ts` and `tests/platform/androidDocuments.test.ts`, type and strictly decode only availability plus `readChunk`, preserve unhealthy/error states and payload bounds, and do not export it through a barrel or activate React/UI. Broad T015 and every omitted document method remain queued behind their own implementation/registration gates.

`full_outcome_complete: false`  
`PRODUCTION_RELEASE_READY: NO`
