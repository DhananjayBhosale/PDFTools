# T902 Android picker and pending-import acceptance

Decision: **ACCEPTED** as a nonvisual Android activation slice.

The registered `AndroidDocuments` bridge now exposes the frozen local-picker and
pending-delivery surface without changing React, reader UI, manifest, permissions,
providers, Gradle, packaged web assets, iOS, signing, or Play state:

- `pickDocuments({acceptedMimeTypes, maximumItems}) -> {status, batchRef, items}`
- `takePendingImports({}) -> {batchRef, items}`
- `acknowledgePendingImports({batchRef, refs}) -> {acknowledgedCount}`
- `pendingImportReady -> {batchRef, itemCount}` (delivery hint only)

Requests accept only the frozen six MIME types and `maximumItems` 1..100. Results
contain opaque `b1_`/`d1_` references and bounded public metadata; no URI, path,
provider identity, source filename, native exception, or raw bytes cross the bridge.
Cancellation remains a neutral result.

Pending imports use a bounded durable ordered batch manifest. The manifest is
published complete only after all selected items have been privately staged. Its
versioned batch reference binds the exact item order and membership, so reordered,
partial, duplicate, mixed, and recomputed-subset acknowledgements fail. Acknowledgement
promotes the exact pending payloads into the owned store, tolerates crash/retry through
mixed pending/owned state, and retains a bounded acknowledgement receipt for exact
idempotent retry. Ordinary list/read paths never promote pending content. Startup
registers the listener first and then performs an authoritative durable peek; recovery
failure propagates instead of presenting an empty Recent list.

Verification:

- Repository TypeScript no-emit: PASS.
- Focused Android documents/workspace/reader TypeScript tests: PASS 24/24.
- Focused store/controller/coordinator/plugin JVM tests: PASS 34/34.
- Picker/pending, documents, delivery, reader-backend, and plugin-catalogue verifiers: PASS.
- JDK 21 milestone build: PASS for debug APK and Android-test APK (101 tasks in the full gate); the final assertion-only Android-test rebuild also passed.
- Disposable API 36.1 normal-phone emulator: PASS 8/8 for picker/controller and bridge instrumentation, including real MediaStore copy, cancellation, revoked-provider and duplicate rejection, partial-batch retry, activity-state restoration, and runtime bridge discovery.
- Cleanup: disposable emulator closed; only the untouched physical OnePlus remained listed. Chrome was not opened.

Accepted SHA-256:

- `OwnedPendingImportStore.java`: `b4bae855ba5bf4d3ad63d772231b1b1731150642f53b4bbc153e487094328ff8`
- `PendingImportBatch.java`: `363b55b5feb5f53dc785d549984d52409e395f1f744ceacace2ee38c7398ad16`
- `AndroidDocumentPickerController.java`: `c80aa43e1efcc129a987e81d706009cf69019eeaae49e0f4c18a01b15e344975`
- `DocumentLifecycleCoordinator.java`: `576ededef10b908f4b101f918e28b3827459b0714e13297eb1cdcd297170f02a`
- `AndroidDocumentsPlugin.java`: `47f0b0c6ba07be739b2fb3fb58d950dc951a2c66f09e23c3171d31f8a4288221`
- `androidDocuments.ts`: `2e5e6bb0698ab19029a81901cde5f750fbf86d07b2f816272691a9a7553d72a8`
- `androidWorkspacePlatform.ts`: `12fd01027d1cb8f65e2c29d63c9e6ed79a24629ec447c2b6f5816879d1f2aa11`
- picker/pending verifier: `86792ddb8695b40592c15ea6eaa2946013b1c5d318e84ef0842e78246a9fdd84`
- debug APK: `f9f6d2234b90c345334dc8bf96f17eefca59284881f8e8b872417578aec67dfe`
- Android-test APK: `192dac3c5a6cbc777acabb84b385c780935800f1f478782cd5aff610869382d7`

Protected shared source and final `dist/index.html`/`dist/sw.js` hashes were
rechecked unchanged. The Android packaged web bundle was intentionally not recopied.

Evidence scope: `LOCAL_JVM_TYPESCRIPT_AND_DISPOSABLE_EMULATOR_ONLY`.

Not checked: physical-device behavior, signing/update compatibility, Play internal
upgrade, production publish, performance re-baseline, persistent rename, durable undo,
or native export/share activation. Full goal outcome remains false and
`PRODUCTION_RELEASE_READY` remains `NO`.

Next allowed task: `T903`, the separate nonvisual native export/share activation.
