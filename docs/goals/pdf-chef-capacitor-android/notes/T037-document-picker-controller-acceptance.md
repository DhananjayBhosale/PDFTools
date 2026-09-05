# T037 Document Picker Controller Acceptance

Result: **ACCEPT**  
Evidence scope: **LOCAL_TEST_AND_EMULATOR_ONLY**  
Production release ready: **NO**

## Accepted boundary

- `INTENT_POLICY: PASS`
- `OPAQUE_RESULT: PASS`
- `CONTENT_RESOLVER_ADAPTER: PASS_EMULATOR`
- `MEDIASTORE_PROVIDER_REMOVAL_AFTER_COPY: PASS_EMULATOR`
- `FAKE_RESOLVER_MATRIX: PASS_SIMULATED`
- `PARTIAL_BATCH_RETRY: PASS_SIMULATED`
- `DOCUMENTSUI_INTERACTION: NOT_CHECKED`
- `PHYSICAL_DEVICE: NOT_CHECKED`
- `NO_ACTIVATION: PASS`

The inactive controller creates only an explicit user-initiated `ACTION_OPEN_DOCUMENT` request with the frozen MIME and item limits. Results contain only status, an opaque batch ref, and immutable ordered opaque item refs. MIME, size, content hash, timestamp, URI, provider address, filename, and filesystem path do not cross the result boundary.

The production `ContentResolver` adapter was exercised on a disposable API 36 emulator using one exact test-created MediaStore PDF. The controller queried its type and size, opened its stream, attempted optional persistable read access, staged owned bytes, and returned one deterministic ref. The test then deleted only that exact MediaStore item, proved provider-backed access was unavailable, and loaded the owned record successfully.

A simulated two-item partial failure staged the first item and failed the second without returning an accepted result. Restoring the same request and retrying returned the original ordered deterministic refs, retained exactly two pending records without duplication, and persisted no source URI, provider authority, or source filename.

This does not prove user interaction with DocumentsUI or a system-issued picker grant. It also does not prove physical-device, signing, Play, or production behavior.

## Verification

- Picker-policy JVM tests: 5/5 PASS.
- Full Android JVM tests: 88/88 PASS.
- Exact-class disposable-emulator instrumentation: 6/6 PASS on API 36.
- Full JDK 21 Gradle gate: 267/267 tasks rerun and PASS for unit tests, lint, debug, unsigned release, and Android-test assembly.
- Production build: PASS with deterministic offline cache `7f70a553b218`.
- Offline, Android packaged-asset, WebView, host, release-security, legacy-inspector, legacy-writer, catalogue, and browser parity verifiers: PASS.
- The browser parity verifier first encountered `ERR_CONNECTION_REFUSED` while its required local Vite server was absent; its server-backed rerun passed every tool assertion.
- Disposable emulator stopped after the test. The connected OnePlus was never targeted.
- Independent Sol Judge: **ACCEPT**; T037-C1 complete.

## Accepted hashes

- `AndroidDocumentPickerController.java`: `b555de034390824bd24f51ec5b0fedae4c11daf52456de92a4c9edd7f9c46da8`
- `AndroidDocumentPickerControllerInstrumentedTest.java`: `483a0bf5364ee465acbc8fb4cf093e6992c930adbd4ac2a4e0084d4adfebc695`
- `PickerRequestPolicy.java`: `3a8ae90c005fff0c702ca05b9c4c4a06d7bae19a82f3fafa1d47c07582c87a52`
- `PickerRequestPolicyTest.java`: `c7af51502fc20906a5c51207063bbb1622914a6e00f76daeb2f9abb064e01ac5`
- Debug APK: `b3e46191288a556fecbfb8fc770533040f4c8c82cfc90101174fd3d6806a02af`
- Unsigned release APK: `0aad7c0dcb4131c564efaa4d0e845888ce50844be2dc84eea076bf50630d6b6e`
- Android-test APK: `22f32f92536a817379788d4c4a19d08f7236dce51ca8f3e734bcdf75fc51dba0`

The frozen T036 sources/tests, manifest, MainActivity, frontend entries, legacy plugins, and dependencies remained byte-identical.
