# T903 Android native export/share acceptance

## Verdict

ACCEPTED. Durable Android `a1_` and `d1_` records now use the accepted native MediaStore exporter and read-only FileProvider share path. Browser/session records and fresh in-memory results keep their existing web behavior.

`full_outcome_complete: false` and `production_release_ready: NO` remain unchanged.

## Frozen bridge contract

- `exportItem({ref,displayName?,mimeType?}) -> {status:"completed"|"cancelled"}`
- `shareItem({ref,displayName?,mimeType?}) -> {status:"completed"|"cancelled"}`

Requests are exact plain objects. `ref` is canonical `a1_` or `d1_`; optional names and MIME types use the bounded native validation contract. Responses contain only `status`. No document bytes, URI, path, provider identity, source filename, or native exception crosses the bridge.

Native preparation and copying run off the main thread through the sole `DocumentLifecycleCoordinator`. Export preserves MediaStore pending/publication/rollback durability. Share preserves the existing narrow read-only FileProvider, exact `ClipData`, and read grant; chooser launch is completion, not recipient consumption, and only a never-launched exact stage is cancelled.

## Focused evidence

- `npm run lint`: PASS.
- Focused Android documents/workspace/reader TypeScript tests: PASS, 26/26.
- Focused AndroidDocuments bridge and coordinator JVM tests: PASS, 18/18.
- Export/share, documents, catalogue, delivery, picker/pending, host-skeleton, WebView-security, release-security, and packaged-offline verifiers: PASS.
- Corrected Android-only web bundle: PASS, 194 offline assets, 8 OCR assets, 64 font assets.
- Disposable API 36.1 normal-phone emulator instrumentation: PASS, 3/3, covering owned `d1_` and legacy `a1_` export/share without bridge addresses.
- Disposable emulator closed; Chrome was not opened; the physical OnePlus was untouched.

The first emulator package exposed an old packaged Blob dispatcher. The Android asset package was rebuilt in a temporary output directory, verified there, and synchronized only to `android/app/src/main/assets/public`. The shared `dist` and iOS package were not rebuilt or copied and their frozen hashes remain exact.

## Accepted hashes

### Source and focused tests

- `AndroidDocumentsPlugin.java`: `b86029b3c2fb37871fd187c9908581caefe98a5682570a9ec45fe1b9fc01b8bd`
- `androidDocuments.ts`: `44f3a3a4752888de3c3aaff23284ec418b1aaa677fc7b88646db68f125bc6f15`
- `androidWorkspacePlatform.ts`: `e95cccb1f89b2b8a3daf68e7b7c3feb5c8b275b3ab19e4f74ce5ec5cfa778296`
- `AndroidDocumentsPluginContractTest.java`: `891706811413ed8670c48b75a1d8c8b80051c09119b6c8403bd6d84325c8a904`
- `AndroidDocumentsPluginInstrumentedTest.java`: `a36600dc7be2acd90f3cb20a5f19c4d1b27ea6369ac6347a1b4d90961f12f723`
- `androidDocuments.test.ts`: `003fa4025b7cb29d5c6d5daa4bda9250ede48ec7b25caca8cb0763ed126036b2`
- `androidWorkspacePlatform.test.ts`: `42195ddc0c8a559ceca7310ab5e3bcb236dd7a4874326b1e1778dedbb791e070`
- `androidPdfReader.test.ts`: `ecfb9d6dbe225abca8fb1328a6f40061af6f69dbbfd02a87cda84ee0b1f1d4f3`

### Verifiers

- `verify-android-document-export-share.mjs`: `7f4d2abad4aa09768a35da381a8113b9211acec33ef57ab2f6cebeb4ec7d1ebd`
- `verify-android-documents.mjs`: `193f5db9a2c414747751474eae55f9a636f2540c5f469d808a2648f2329aac20`
- `verify-android-plugin-catalogue.mjs`: `664f67af2a98439a8c2fb72b6a3a1a941e3dc8abe975ce7d35aa8b2f9cd54842`
- `verify-android-document-delivery.mjs`: `c1fa6e9e59044eed5d5e7c6d1c5d7fa622c93cf434308b92817c04f11f918373`
- `verify-android-document-picker-pending.mjs`: `5f8a9fd6e7d0a02bf64a91e3568fcb9dc60c833110b8a84ae3e36528ab0a51ce`
- `inject-service-worker-manifest.mjs`: `f7443140ea44f9629a3ec7444410c0f98ccbdce3323698eadaafe74960b531cf`
- `verify-offline-assets.mjs`: `91cfd900e86dcbb8b2085d86d6d036169a5cdcd3d45c550365247735a1fc3541`
- `verify-android-host-skeleton.mjs`: `4e57a2df92b646e96be4378cffa3effed40873896f94a841eb610270a2e766fe`

### Android package and artifacts

- Packaged `index.html`: `2c85c3329aa410aaef26b740526f576aec5577a3bc8a8ca38791a51f9ec696c8`
- Packaged `sw.js`: `8942817e5c2996aade8337d9034927807d069580529ed15410f92fed653f2f86`
- Packaged main JS `index-BFpNPAGh.js`: `5872c8887414a0934e773a402fff868922ece6d2c53893576805174df503a168`
- Packaged CSS `index-DOfgCbVQ.css`: `c7f112e8ba2fad5b7d899944ba001de4606efec02fe9a506cf7645148dac1a35`
- Debug APK: `d27f3f1c16caa7a2c5c1a19576bcdbf09799f889a2709b5a8b6ab481a98c7956`
- Android-test APK: `dff6d6b3936eea8c9b0c9f719849b5eb3f6e8987074aa2aea878f515012cb6f4`

### Preserved shared freeze

- Shared `dist/index.html`: `8b99b43d9b787e806b0d39fa176a3aa3cf297ff1f7238de05ebd19ed4ee2289c`
- Shared `dist/sw.js`: `3d3d96dc93ad14ca998e14f72c380c44b9d7421d4ba6d86493259bfeecaea4db`

## Not checked

- Physical OnePlus behavior: NOT CHECKED.
- Same-signer install-over-production upgrade: NOT CHECKED.
- Upload/Play App Signing certificate compatibility: NOT CHECKED.
- Play internal upgrade or production publish: NOT CHECKED.

## Next boundary

T904 owns the nonvisual persistent rename transaction for durable owned `d1_` records and its strict Android bridge/client seams. Legacy `a1_` records remain read-only. The visible Recent capability stays disabled until rename and durable undo can be activated together in one normal-phone UI milestone.
