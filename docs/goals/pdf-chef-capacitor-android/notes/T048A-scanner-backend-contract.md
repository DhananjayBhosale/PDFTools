# T048A Scanner Backend Contract

Status: **REACCEPTED AFTER T051 DURABILITY REPAIR**  
Evidence scope: **NONVISUAL SOURCE, CONTRACT, FOCUSED JVM, TYPESCRIPT, AND SECURITY PROOF**  
Production release ready: **NO**

## Superseding decision

The owner-directed scanner contract supersedes the older queued `b1_` batch design in T031. A successful scan imports the returned native PDF stream directly through the sole Application-owned `DocumentLifecycleCoordinator` and resolves with a durable `d1_` item. The scanner URI, JPEG URIs, paths, provider addresses, raw bytes, scanner-supplied filenames, native exceptions, and passwords never cross the bridge; the item carries only the fixed safe display name `Scanned document.pdf`.

```text
scan({}) ->
  {status:"completed", item:AndroidOwnedDocument,
   pageCount:positive integer, jpegPageCount:positive integer}
| {status:"cancelled", item:null, pageCount:0, jpegPageCount:0}
```

Cancellation is a successful, distinct result. Launch, result, import, storage, limit, interruption, and unavailable failures use a fixed scanner-specific error allowlist with generic messages.

## Native behavior

- Dependency: exact official plain `com.google.android.gms:play-services-mlkit-document-scanner:16.0.0`.
- R8: retain only the constructor of `com.google.mlkit.common.internal.CommonComponentRegistrar`.
- Options: gallery allowed, `SCANNER_MODE_FULL`, `RESULT_FORMAT_PDF`, and `RESULT_FORMAT_JPEG`.
- Lifecycle: one in-flight scan, one bounded background import, exact-session abort on every incomplete import, and no external/public staging.
- Storage: PDF content is streamed in at most 512 KiB chunks through the singleton coordinator to an owned `d1_` record.
- Activation: exact Opus may import the strict TypeScript adapter in Make PDF, but client construction is guarded by native availability. The native plugin remains unregistered and therefore unavailable until a separate runtime gate.

## Frozen boundaries

Protected frontend, `MainActivity`, manifest, generated `dist/public` bundles, reader Activity/UI/resources, the read-only Kotlin reference, the physical OnePlus, signing, and Play state are outside this implementation slice.

## Verification receipt

- Focused scanner importer/plugin/dependency/host-security JVM contracts: PASS.
- Strict TypeScript scanner adapter: PASS, 7/7; repository `tsc --noEmit`: PASS.
- Scanner dependency/surface, plugin catalogue, legacy, WebView, documents, delivery, and exact release-security verifiers: PASS.
- JDK-21 milestone gate: PASS, 267 tasks covering unit tests, lint, debug APK, unsigned release APK, and androidTest APK.
- Emulator scanner launch/result and native plugin discovery: NOT CHECKED because registration is deliberately deferred.
- Physical device, signing, and Play: NOT CHECKED.

Frozen API:

```text
AndroidDocumentScanner.scan({})
  -> {status:"completed",item:<durable d1_ item>,pageCount,jpegPageCount}
   | {status:"cancelled",item:null,pageCount:0,jpegPageCount:0}
```

Primary SHA-256:

- importer `8a0adf949c1273da3f43529350b89d5b9209c78ae9c3d9739ac3ecec5f311732`
- plugin `bfbd33db9cf1092c5c4f835c0ba20b6a4a1da4e23812a9687e4f6d98f20057b4`
- TypeScript adapter `9804d738217a20b9341f491cdd2218ef046eac03b88017d710f446e129f2c279`
- dependency verifier `1e2a06b203ef37112578e04a78c94617ce69232f69080794f1a678d04612647a`
- scanner verifier `904d22068f465e6756ae5bdabf4157ea3a159635a5d1569ca73a8debc0fc444f`
- debug APK `898ccb7ce8d3e89847c21e67c847b861b88585c9cba9c7c41dea3fd78363e41e`
- unsigned release APK `887c7611f4b88c39605d5d6190a816a86460a21188c4200337c67a82db7f73d8`

## T051 durability reacceptance

The scanner now distinguishes an intent-sender failure before genuine cancellation and uses Capacitor 8's annotated Activity callback path without a plugin-owned launcher or in-memory pending call. Its process operation survives BridgeActivity recreation, suppresses delivery to null/dangling restored calls, accepts content results plus strictly contained no-symlink ML Kit private-cache files, removes trusted PDF/JPEG staging in `finally`, and coalesces fragmented provider reads into bounded 512 KiB appends.

The same tranche also repaired the native document substrate used by scanner results and the reader:

- Explicit owned deletion no longer requires a content digest. Strict NOFOLLOW deletion, absence verification, directory fsync, and a retained journal marker prevent false success; corrupted owned payloads remain deletable.
- Reader snapshots make and fsync the part read-only before atomic publication, reject writable recovered finals, delete and fsync strictly, keep close retryable, normalize interruption, and recover bounded directory batches convergently.
- Legacy reader input uses one identity-pinned channel across sequential windows.
- Durable `d1_` reader startup hashes during the single snapshot-copy pass instead of doing a full validation pass and then a second full copy. The source is opened under the coordinator lock, while bounded copy I/O runs outside it. A 512 KiB+37 fixture proved two source windows, zero preliminary digest passes, exact hash rejection after same-size corruption, and concurrent coordinator progress.
- A normally returning but unaccepted Capacitor reader launch now releases the instance and process single-flight locks. Direct Activity preparation preserves fixed interrupted, storage, limit, and cancellation messages.

T051 focused evidence:

- JVM: PASS, 65 focused scanner/document/reader tests.
- TypeScript bridge contracts: PASS, 22/22.
- Repository `tsc --noEmit`: PASS.
- Scanner surface and dependency verifiers: PASS.
- Legacy inspector and WebView security verifiers: PASS.
- R8 constructor rule: contract-only proof; release minification remains disabled.
- Emulator, physical OnePlus, scanner/reader runtime discovery, signing, and Play: NOT CHECKED by design.
- Plugin catalogue, release-security component count, legacy-theme frozen Gradle hash, and host packaged-index checks remain intentionally deferred/red until the coordinated registration/manifest/bundle activation tranche.

T051 primary SHA-256:

- scanner plugin `0687647d059bcb56481ba9e4e8548093921fbcea15614106672c0239db490cd9`
- scanner importer `95d8dfcddbea01d2988990b3d4ac3cc979b5c1a13e69f84265f174f189b87202`
- scanner result source `4f216408dd4c74849c4fefc650e2939bb2857732d81724c3147a6778631f60c8`
- owned writer `eb122b176f6a20a1bab0b11dcd75f0b03555f53fa770fee951ee9fa0cfe44e85`
- reader session `229b35352ae29466dee16af7cc9c4f25eead75ae742dcff6653fec64c52d7cff`
- legacy resolver `65ba8223e922a5a408826a901bcc715c00b6374d4a00633358dec3d11526c804`
- coordinator `15a674ddffcec30001d9f1b0ab1e2ce7b793831a39f5169a3f4cb9d1fa32cdd2`
- AndroidDocuments plugin `0825c7e181a7b862ea6d11f9fc7f7c11081c9ea4c29f190afe8a3779bd1e0350`
- scanner verifier `3a999aca2b7414e0f6e9e17d911f0f82874ca1982c95e7957d6d095a5d8f2db4`
