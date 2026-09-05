# T050 Reader Backend Contract

Status: **ACTIVE**  
Evidence scope: **NONVISUAL BACKEND ONLY**  
Production release ready: **NO**

The reader backend follows the frozen coordination boundary. Codex owns dependency/toolchain configuration, private reader sessions, native share actions, canonical launch/result validation, AndroidDocuments `openReader`, strict TypeScript/platform seams, focused tests, and verifiers. Exact Opus exclusively owns `PdfReaderActivity` and all reader UI/resources.

No reader URI, path, provider address, bytes, password, filename from storage, or native exception detail may cross the bridge. The Activity receives only canonical opaque ref plus safe public display name and returns only `closed` or an allowlisted viewer-tool route.

## Focused backend API freeze — 2026-08-30

This is the handoff boundary for the exact-Opus Activity/dispatch pass. It does
not accept the combined Activity/manifest/runtime milestone.

### Dependency and toolchain

- `androidx.pdf:pdf-viewer-fragment:1.0.0-beta01` is the only reader dependency.
- App `compileSdk` uses AGP 8.13 Groovy `release(36)` with `minorApiLevel = 1`.
- Root SDK variables, AGP, Gradle, Capacitor, and the non-Compose app shell are unchanged.

### Activity-facing Java API

`PdfReaderLaunchContract`:

```java
public static Intent createIntent(Context context, String ref, String displayName) throws Failure
public static Intent closedResultIntent()
public static Intent toolResultIntent(String toolPath) throws Failure
public static Result parseResult(int resultCode, Intent data) throws Failure
public static boolean isCanonicalRef(String value)
public static boolean isSafeDisplayName(String value)
public static Set<String> toolPaths()
```

The explicit component name is
`com.dhananjaytech.zenpdf_allpdftoolsinoneplace.reader.PdfReaderActivity`.
Input extras are exactly `EXTRA_REF` and `EXTRA_DISPLAY_NAME`. Results must use
`RESULT_OK` with either `closedResultIntent()` or `toolResultIntent(path)`.
The accepted tool paths are `/compress`, `/merge`, `/split`, `/edit`,
`/make-fillable`, `/sign`, `/watermark`, `/protect`, `/unlock`, `/delete-pages`,
`/page-numbers`, `/reorder`, `/rotate`, `/flatten`, `/extract`, `/pdf-to-jpg`,
`/pdf-to-word`, `/ocr`, `/metadata`, `/repair`, and `/compare`.

`DocumentLifecycleCoordinator`:

```java
public synchronized PdfReaderDocumentSession prepareReader(String ref, String displayName) throws Failure
public synchronized List<DocumentRecord> listOwnedDocuments() throws Failure
public synchronized boolean deleteOwnedDocument(String ref) throws Failure
public synchronized int clearOwnedDocuments() throws Failure
```

`PdfReaderDocumentSession`:

```java
public synchronized Uri documentUri()
public String ref()
public String displayName()
public long sizeBytes()
public void close()
```

Create the session off the main thread, pass its native-only `documentUri()` to
`PdfViewerFragment`, keep the session for the Activity lifetime, and close it
idempotently when the Activity is permanently finished. It stages one unique
read-only private snapshot using `.part` plus atomic publication. The 128 MiB
limit is enforced before launch. Owned inputs perform one integrity-validation
pass plus one 512 KiB-chunk copy pass through one pinned channel; no URI is
exposed over Capacitor and the existing share provider is not broadened. Each
copy window and the final publish boundary check thread interruption, fail with
fixed `DOCUMENT_INTERRUPTED`, and remove the partial snapshot.

`PdfReaderActions`:

```java
public PdfReaderActions(Activity activity, DocumentLifecycleCoordinator coordinator)
public void share(String ref, PdfReaderActions.Callback callback)
public void close()
// Callback: void onComplete(PdfReaderActions.Result result)
// Result: boolean completed(); String code()
```

Construct one instance per Activity. `share` returns immediately, prepares the
existing read-only share staging on its private executor, launches the chooser
on the main thread, and reports a fixed result on the main thread. Disable the
Share action while the callback is pending. Search or share failure must leave
the document open. `close()` suppresses later callbacks and chooser launches,
cancels only prepared-but-never-launched shares, and never deletes a stage after
`startActivity` has returned; interrupted post-launch finalization is covered by
bounded share expiry.

### Capacitor and TypeScript API

`AndroidDocuments.openReader({ ref, displayName })` keeps its promise pending
until the Activity callback and resolves only to `{action:'closed'}` or
`{action:'tool',toolPath:<allowlisted route>}`. A process-scoped atomic guard is
acquired before launch and released on callback or launch failure, including a
null/dangling restored `PluginCall`.

`WorkspacePlatform` has optional `documentScanner?: DocumentScannerService` and
`pdfReader?: PdfReaderService`. `createAndroidPdfReaderService()` accepts only
available durable `a1_`/`d1_` PDFs at or below 128 MiB; transient browser `File`
objects remain on the web reader. Its public-name sanitizer is aligned with the
native contract. `isAndroidNativePdfReaderAvailable()` intentionally remains
`false` until Activity declaration and final runtime dispatch acceptance.

No `androidWorkspacePlatform.ts` file was created or edited by this slice. The
final Android workspace assembly, runtime service injection, and visible native
versus web dispatch are reserved for exact Opus.

### Focused evidence

- Reader/core/plugin JVM tests: **PASS**, `BUILD SUCCESSFUL in 10s`, JDK 21.
- Post-freeze interruption/cleanup session test: **PASS**, `BUILD SUCCESSFUL in
  6s`, JDK 21.
- AndroidDocuments and Android PDF-reader TypeScript tests: **PASS**, 22/22.
- Repository TypeScript check: **PASS**, `tsc --noEmit`.
- Combined Activity/manifest build, emulator, and runtime dispatch: **NOT RUN**
  by design; they belong after this handoff.

### Frozen source hashes (SHA-256)

```text
77dfcf55e0ad3423cc9640641973873935f6cb182ed3a220b167aeb208b15208  android/app/build.gradle
ee6a9fbe2230eb09386b1271165daf62efd00d812e53258e80225a7e20fba79d  reader/PdfReaderLaunchContract.java
ca6b5c99dd11d6d2aa42166783192d534f47732f200a3958538e2ac57ffe260a  reader/PdfReaderDocumentSession.java
a30918132abf37c9f1013c205389528afaeac01379600c90e000393818959c41  reader/PdfReaderActions.java
b168aa78cb83c5cd2733d0a9060fa777f0b0fff9390c62bed7a2976d2036142f  documents/DocumentLifecycleCoordinator.java
3d2cbc171f5897887b26646907267d65f51ac8a489e44eff3107cb70a08516e5  documents/OwnedDocumentWriter.java
d291da5e100a69898640fcb6ff1cf4488e6339035ab456dda49b0a35dd48e5ba  documents/LegacyDocumentOpenResolver.java
d002fab7bcb9d9155a0711409eed919c8f5bfc7d00ce6e2ac72ac077f123063b  documents/AndroidDocumentsPlugin.java
bbb8351d9327c372f724570eba056ca23a2a032dec7975fb83819232bcea7315  services/platform/contracts.ts
ccf716456542d9956cdefb6f220c8a3bcdaab1f3792687dfa4de195d53b0fb12  services/platform/android/androidDocuments.ts
a7d2e31573b36378c5ee7d3013c18bcb0bb003a59328fd86b9a14ef464a9b5a5  services/platform/android/androidDocumentScanner.ts
3ef418421fbb6bdd5332c7dddab028863aebd6a53b757c8fa26d758efd4b56ff  services/platform/android/androidPdfReader.ts
```
