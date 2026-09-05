# T921 Android minified QA runtime receipt

## Decision

`ACCEPTED_R8_RUNTIME_WITH_SCANNER_COMPLETION_NOT_CHECKED`

The isolated `com.dhananjaytech.pdfchef.minifiedqa` artifact is release-inherited, R8/resource-shrunk, non-debuggable, and signed only with the known Android debug certificate. Production `release` remains unsigned and its APK/AAB hashes are unchanged.

## Artifact

- APK SHA-256: `c95bfcf49687cadffbc794610ee2ced183d21c2d74ee863db0fd10523e2fe50a`
- Size: 20,138,595 bytes
- Package/version: `com.dhananjaytech.pdfchef.minifiedqa`, `22`, `2.2.4-minified-qa`
- Public signer SHA-256: `68d93880fda2a6d340e58207d010471711d1e5c25e139b76aa587dfff4e41a0c`
- R8 mapping SHA-256: `4420acc73506a536e36ecd1bd979bd29c57ca806ce899d2659115db37e8b7719`
- Zip alignment: PASS

## Normal-phone runtime

PASS on disposable API 36.1 emulator-5566 for cold host launch, actual plugin discovery, application metadata/storage facts, packaged Home/Tools/Recent/Settings routes, durable `d1_` bridge write/list/process-relaunch visibility, native reader open/close, exact durable deletion, and package-scoped fatal/ANR/security cleanliness.

The actual ML Kit delegate Activity launched and cancellation returned neutrally. Completion is **NOT CHECKED** because Google Play services could not download the document-scanner module on this disposable AVD. This is an external runtime dependency limitation, not a claim that full minified scanning passed.

No Chrome was opened. The temporary WebView forward, QA/test packages, public fixture, and emulator were removed. No device remains attached; the physical OnePlus was not targeted. No release credential, production signing, or Play state was accessed.

## Verification boundary

`assembleMinifiedQa` and all focused R8/security/catalogue/scanner-dependency/offline/packaged-asset verifiers passed. `lintMinifiedQa` found six source/resource compatibility errors: one API-34-only `Path.of(URI)` call and five AppCompat tint attributes. These are recorded for T922 and are not hidden with a lint baseline. T921 accepts the runtime proof only; production readiness remains `NO`.

Machine-readable evidence: `output/t921-android-minified-runtime/evidence.json`.
