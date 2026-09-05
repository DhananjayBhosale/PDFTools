# T904 Android durable owned-document rename acceptance

## Verdict

ACCEPTED as a nonvisual backend milestone. Durable owned Android `d1_` documents now have a crash-safe metadata-only rename transaction and an exact `AndroidDocuments.renameItem` bridge/client contract. Legacy `a1_` records remain read-only.

Visible rename remains intentionally disabled (`persistentRename: false`) until rename and durable undo can be activated together in one normal-phone UI milestone. `full_outcome_complete: false` and `production_release_ready: NO` remain unchanged.

## Frozen contract

- Native bridge: `renameItem({ref,displayName}) -> {status:"completed"}`.
- Only canonical available `d1_` records are accepted.
- The existing safe-name contract rejects empty/dot names, separators, NUL, malformed UTF-16, and names over 180 characters or 720 UTF-8 bytes.
- The transaction decodes and structurally validates the canonical owned record and payload, writes and fsyncs one exact per-ref private part record, atomically replaces only the metadata record, fsyncs the records directory, and strictly cleans an unpublished part on failure.
- `ref`, MIME, size, content hash, creation time, availability, payload bytes, and payload file identity remain unchanged. The payload is never moved, rewritten, or re-hashed by rename.
- No URI, path, provider identity, old name, bytes, filename, or native exception crosses the bridge.

## Focused evidence

- `npm run lint`: PASS.
- Focused Android documents/workspace/reader TypeScript: PASS, 27/27.
- Focused `OwnedDocumentWriter`, `DocumentLifecycleCoordinator`, and `AndroidDocumentsPlugin` JVM contracts: PASS, 40/40.
- Dedicated rename verifier and all intersecting documents/catalogue/delivery/picker/export-share/reader/WebView/release-security verifiers: PASS.
- JDK 21 debug + Android-test milestone build: PASS, 101 tasks.
- Focused Android-test APK correction build after narrowing the emulator assertion: PASS.
- Disposable API 36.1 normal-phone live bridge test `nativeOwnedRenameIsDurableExactAndPayloadPreserving`: PASS, 1/1.
- Disposable `emulator-5566` was closed. Chrome was not opened. Existing `emulator-5554` (`Pixel7QA36`) was not used or closed.

One initial broad historical bridge method timed out in its unchanged legacy `readChunk` step before reaching rename. It is not counted as rename evidence. The milestone was narrowed to the changed contract and passed; the timeout remains explicit rather than being reported as a product PASS.

## Accepted hashes

### Production source

- `OwnedDocumentWriter.java`: `f1a39ba0bdf795863eafec4578d2b3924cc5a8cc18a134c1ba9e76e944c166d2`
- `DocumentLifecycleCoordinator.java`: `f9c42e8b7498d49b6fd4d8d8541a28d0d3e06c6b96fbe763dac6b2bdee9c35f6`
- `AndroidDocumentsPlugin.java`: `4a7f43edf52362240539d482d0ceb4c880dba7dc334e71d273e1f7f5730d21de`
- `androidDocuments.ts`: `f63993a3fb0e6ea90242499dd44d6744acef81229ab97edb964530748d0d67ea`

### Focused tests

- `OwnedDocumentWriterTest.java`: `4ac99c17c936c34f9a473e526be70ceaa390e71ea905b12f8f529f36dd473e47`
- `DocumentLifecycleCoordinatorTest.java`: `05a047a025237dd13c31789f57b85aa2a670fa67eecb51dd20d67fd863122732`
- `AndroidDocumentsPluginContractTest.java`: `6a4557ae7a8535a661ac52aa660bdf79a11b07edf9b72e617f1c2e9db2707e8e`
- `AndroidDocumentsPluginInstrumentedTest.java`: `d191c35529c9e4152c2acd3254ecf7626952a21c0dfc8762e781666ab9f44d98`
- `androidDocuments.test.ts`: `8430c4da62847295499b9af897aacbc39af7662d80696960c11a701728a38ace`
- `androidWorkspacePlatform.test.ts`: `aad5604bb888885a099f8a61d2235a3bc9ab16fad1f44213b822680b8380d5b9`
- `androidPdfReader.test.ts`: `fb82163bd41f4bf4be17a7deb32586cf9323db7d9174129ab4dccf03ea4aa88f`

### Verifiers and artifacts

- `verify-android-document-rename.mjs`: `7267cbcf10a5ec92c5dbbcf0cd5db6736ee38f81db7b4508668a7e737630f3af`
- `verify-android-documents.mjs`: `d178656dcd2844c6467a790537d69347da6a0da951f9b09e8017dfcd895874c7`
- `verify-android-plugin-catalogue.mjs`: `2e58dd69f497274320123aa9941d7add10a688c6ec98a71268529cb4af2f1b5e`
- `verify-android-document-delivery.mjs`: `0adb9b57ea25792932358337f5bd46c74819b3f5cddd7e3d2ef17fd864e7bbbb`
- `verify-android-document-picker-pending.mjs`: `8cb15b03917a69d1f1678cb13f27ab51f7c528ccdb3da2c8f7ec028b3aea842d`
- `verify-android-document-export-share.mjs`: `a47707aa4b7538525d83d0b261c755375ede19e70a56d9e5f584df91cf5a79a9`
- `verify-android-reader-backend.mjs`: `3692235790a2e4564c9e9d189870a396d511b24b2e5884074061d46d45bf4b61`
- Debug APK: `c1186e16bb84953d5625e1bc8eeb1dfe82dd85fb40a60acae5c8010b55c678e2`
- Android-test APK: `1c9dc04b34b717edc359435a91d439f5ae55df29ed26e8c72eb4d1244565a62b`

## Preserved freeze

- Shared `dist/index.html`: `8b99b43d9b787e806b0d39fa176a3aa3cf297ff1f7238de05ebd19ed4ee2289c`.
- Shared `dist/sw.js`: `3d3d96dc93ad14ca998e14f72c380c44b9d7421d4ba6d86493259bfeecaea4db`.
- Protected Dashboard/ViewPDF/OCRPDF/FileUpload/useOpenedPdf hashes remain exact.

## Not checked

- Broad legacy `readChunk` runtime after the one timeout: NOT CHECKED again in this tranche.
- Physical OnePlus behavior: NOT CHECKED.
- Same-signer production upgrade, signing fingerprints, Play internal upgrade, and production publish: NOT CHECKED.

## Next boundary

T905 owns the nonvisual durable undo transaction for owned `d1_` deletion. It must keep current destructive delete and visible behavior unchanged until a combined mobile activation milestone.
