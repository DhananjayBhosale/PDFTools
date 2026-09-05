# T039 pre-worker design acceptance

Status: **ACCEPTED**  
Scope: inactive retain/export/share implementation only  
Full outcome complete: **false**  
`PRODUCTION_RELEASE_READY`: **NO**

## Frozen limits

| Limit | Value |
|---|---:|
| Append chunk | 524,288 decoded bytes |
| One write session / finished file | 128 MiB |
| Concurrent open write sessions | 4 |
| Aggregate bytes across open sessions | 256 MiB |
| Write-session inactivity expiry | 30 minutes |
| Write-session absolute lifetime | 2 hours |
| Simultaneous export operation | 1 |
| Simultaneous share preparation | 1 |
| Retained share stages | 8 |
| Aggregate retained share bytes | 256 MiB |
| Share-stage lifetime | 24 hours |
| Incomplete export recovery lifetime | 30 minutes |
| Completed operation-record retention | 24 hours |
| Cleanup inspection per explicit document call | At most 4 session, 1 export, and 8 share records |

Finished owned documents are durable and have no automatic expiry. Future deletion needs a separately approved API. Every write, export, and share preserves a 1 MiB free-space reserve.

## Ownership and activation boundary

- `DocumentLifecycleCoordinator` is the sole documents lock, session registry, operation-journal owner, and owner of exactly one instance of each T036-T039 service.
- It never reads or mutates legacy settings/history metadata. `LegacyMutationCoordinator` remains the sole settings/history writer.
- T039 constructors perform no I/O. Recovery and bounded expiry cleanup begin only on an explicit document method.
- T039 does not change either `PdfChefApplication`. T040 may install exactly one coordinator as an Application final field/getter, with no lifecycle I/O, only after a separate T014 contract/verifier adjudication.
- No plugin, service, static singleton, or secondary process may construct another coordinator or persistence store.

## Reference and collection contract

- `d1_` is owned/pending file authority. It may be retained, exported, or staged for sharing.
- `a1_` is read-only legacy authority resolved afresh through accepted T038. It may be exported/shared only after a bounded snapshot copy; it is never retained, renamed, or mutated.
- Raw paths, filenames, URI/provider addresses, and noncanonical refs are rejected.
- Collections return fixed `DOCUMENT_COLLECTION_UNSUPPORTED`; no ZIP, traversal, flattening, or file coercion is permitted.

## Retain state machine

- Append writes only to an owned-session part, forces bytes, then atomically publishes a forced committed-length journal. Journal publication is the append linearization point.
- Recovery truncates any unjournaled tail. An ambiguously interrupted append makes the session `INTERRUPTED`; it cannot silently replay or duplicate bytes.
- Finish forces data, publishes finalization intent, atomically moves data, fsyncs its directory, atomically publishes the `d1_` record, and fsyncs metadata. Record publication is the finish linearization point.
- Recovery completes an intent whose data moved, or removes only its exact pre-linearization temp. Repeated finish/retain returns the same committed `d1_`; repeated abort never deletes committed data.
- Retaining a T036 pending item preserves its `d1_`, atomically moves data without a second full copy, publishes owned metadata, then removes only that exact pending marker.

## MediaStore export state machine

- Persist a forced `ALLOCATING` intent before insertion. Insert an app-owned pending row with an internal opaque operation-token name and `IS_PENDING=1`.
- The private journal may retain the app-created destination URI only for exact recovery. It must never cross a DTO, log, or error.
- Copy bounded bytes, fsync the destination descriptor, verify size/hash, then update final display name, MIME, and `IS_PENDING=0` together. Clearing `IS_PENDING` is the publication point.
- Before publication, cancellation/failure/recovery deletes only the exact pending row. After publication it never deletes the user-visible export and returns completed or durability-uncertain.
- No automatic client retry is claimed after process-death ambiguity; recovery itself is idempotent.

## Share staging state machine

- Copy the resolved file into an operation-specific app-private stage, force the file and directory, and atomically publish metadata before creating an intent.
- Only `ACTION_SEND`, `content://`, `ClipData`, and `FLAG_GRANT_READ_URI_PERMISSION` are allowed.
- Write, persistable, prefix, BROWSABLE, file, and HTTP(S) grants/paths are forbidden.
- The stage remains for 24 hours for delayed recipients. Explicit document calls revoke/delete only expired coordinator-owned stages within the frozen eight-record bound.
- Cancellation before dispatch deletes the exact stage; after dispatch it remains until expiry.

## Exact provider path policy

```xml
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <files-path
        name="pdfchef_share_staging"
        path="pdfchef_documents/share/" />
</paths>
```

No `.`, cache, root, external, media, `processed/`, index, DataStore, WebView, pending-import, session, journal, or owned-library root is exposed. Both `a1_` and `d1_` shares use the bounded share copy.

## T039/T040 evidence split

T039 proves writer/recovery logic, actual disposable-emulator MediaStore pending/publish/rollback, share staging, exact intent flags, exact XML allowlist, release non-activation, and frozen-source preservation. T039 must not claim a usable FileProvider URI or runtime grant.

T040 exclusively owns provider manifest registration, `exported=false`, `${applicationId}.fileprovider`, `grantUriPermissions=true`, real read-only recipient access, denial of write/out-of-root access, Application ownership, plugin registration, and runtime bridge proof.

## Exact T039 Worker allowlist

- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/DocumentLifecycleCoordinator.java`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/OwnedDocumentWriter.java`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentExporter.java`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentSharer.java`
- `android/app/src/main/res/xml/file_paths.xml`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/DocumentLifecycleCoordinatorTest.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/OwnedDocumentWriterTest.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentExporterTest.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentSharerTest.java`
- `android/app/src/androidTest/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentDeliveryInstrumentedTest.java`
- `scripts/verify-android-document-delivery.mjs`

No existing source or verifier may change.

## Verification

Use the accepted temporary Temurin 21 path for this workspace if the durable path below is absent.

```sh
env JAVA_HOME=/Users/dhananjaybhosale/.local/share/pdf-chef/toolchains/temurin-21/Contents/Home android/gradlew -p android --no-daemon :app:testDebugUnitTest --tests '*documents.DocumentLifecycleCoordinatorTest' --tests '*documents.OwnedDocumentWriterTest' --tests '*documents.AndroidDocumentExporterTest' --tests '*documents.AndroidDocumentSharerTest'
node scripts/verify-android-document-delivery.mjs
node scripts/verify-android-legacy-inspector.mjs
node scripts/verify-android-legacy-theme-writer.mjs
node scripts/verify-android-release-security.mjs
env JAVA_HOME=/Users/dhananjaybhosale/.local/share/pdf-chef/toolchains/temurin-21/Contents/Home android/gradlew -p android --no-daemon --rerun-tasks :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleRelease :app:assembleDebugAndroidTest
ANDROID_SERIAL=<disposable-emulator> env JAVA_HOME=/Users/dhananjaybhosale/.local/share/pdf-chef/toolchains/temurin-21/Contents/Home android/gradlew -p android --no-daemon :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents.AndroidDocumentDeliveryInstrumentedTest
```

## Stop conditions

Stop on activation; manifest/Application/plugin/frontend/dependency edits; any T013/T014/T036-T038 change; generic cleanup; a second persistence owner; write/storage permission; a broad provider root; direct overwrite or non-atomic fallback; implicit archive; unbounded retention; raw-address persistence outside the private export-recovery exception; physical-device use; signing; or Play access.
