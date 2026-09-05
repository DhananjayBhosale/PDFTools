# T905 Android durable owned-delete undo acceptance

## Verdict

ACCEPTED as a nonvisual backend milestone. Durable owned Android `d1_` documents now support a bounded crash-safe trash/restore transaction through exact `AndroidDocuments.trashOwned` and `AndroidDocuments.restoreOwned` bridge/client contracts. Existing destructive delete, clear, workspace capabilities, and visible Recent behavior remain unchanged.

Visible rename and undo remain intentionally disabled until the combined normal-phone mobile activation owned by exact Claude Code Opus 5 High. `full_outcome_complete: false` and `production_release_ready: NO` remain unchanged.

## Frozen contract

- Native bridge: `trashOwned({ref}) -> {undoRef,expiresAt}` and `restoreOwned({undoRef}) -> {status:"completed"}`.
- Only canonical available durable `d1_` records can enter undo trash. `u1_` tokens are opaque, and the exact DTOs expose no document name, URI, path, provider identity, payload identity, bytes, or native exception.
- The undo window is exactly 10 minutes. Restored tombstones remain for 24 hours so response-loss retries complete idempotently without resurrecting later renamed or irreversibly deleted documents.
- Forced `PREPARED`, `TRASHED`, `RESTORING`, `RESTORED`, and `PURGING` journals plus strict no-follow moves, file-identity validation, directory fsync, and verified cleanup converge every supported crash point without duplicate or lost payloads.
- Journal count is capped at 10,000. Token allocation, expiry cleanup, and tombstone cleanup are bounded to four candidates per explicit trash/restore mutation. Read/list paths do not trigger recovery or cleanup.
- Restore reserves active-document capacity before publishing payload or metadata. Limit failure and clock rollback preserve the restorable trash transaction.
- Existing `deleteOwned` and `clearOwned` retain their current strict destructive semantics and are not routed through undo in this tranche.

## Focused evidence

- `npm run lint`: PASS.
- Focused Android documents/workspace/reader TypeScript: PASS, 28/28.
- Focused `OwnedDocumentWriter`, `DocumentLifecycleCoordinator`, and `AndroidDocumentsPlugin` JVM contracts: PASS, 50/50.
- Dedicated undo verifier and intersecting documents/catalogue/delivery/picker-pending/export-share/rename/reader/release-security verifiers: PASS.
- Milestone `:app:testDebugUnitTest`, `:app:assembleDebug`, and `:app:assembleDebugAndroidTest`: PASS; 105 tasks, 8 executed and 97 up-to-date.
- The installed host runtime is JDK 25.0.2; the Android module remains compiled with the frozen Java 21 source/target contract. This receipt does not mislabel the host runtime as JDK 21.
- Disposable API 36.1 normal-phone bridge test `nativeOwnedUndoIsOpaqueDurableAndRetrySafe`: PASS, 1/1. It proves trash response retry, Activity relaunch, restore response retry, exact invalid-input handling, and no bridge data leakage.
- Disposable `emulator-5566` was closed. Chrome was not opened. Existing `emulator-5554` (`Pixel7QA36`) was not used or closed.

The focused instrumentation uses Activity relaunch to exercise bridge reattachment and durable private state. A literal OS force-stop/relaunch sequence was not separately automated in this tranche; crash-point restart convergence is covered by the focused JVM transaction matrix. This narrower boundary is explicit rather than being reported as physical process-death proof.

## Accepted hashes

### Production source

- `OwnedDocumentWriter.java`: `7f431eeb2f7568ed80f81c86ec4dcf581baa88467f56d2832adec2e0d7dd7381`
- `DocumentLifecycleCoordinator.java`: `107ca0303ff05482327ba479253b99d90bc1288cf97fc3c4111b5a5a3e717a44`
- `AndroidDocumentsPlugin.java`: `f3964cdcb47a643d30796bb472ad35a2e25e68ef18d81e92aaab28e48c4b19a9`
- `androidDocuments.ts`: `f2ce7d524ce3e9e415532211857075a855cfc5b239852d838653348e971870bb`

### Focused tests

- `OwnedDocumentWriterTest.java`: `ea6b9d7deb58f7ce36aaaed6d01562c1d2db114ff4183b7e822e18a48dff1ddc`
- `DocumentLifecycleCoordinatorTest.java`: `84265891b1c19c5a31e962fbcd4aee27c4704b2a5d89923ca7e297a0f9e305a6`
- `AndroidDocumentsPluginContractTest.java`: `aaae9ef0370e108b35397f1b456820b53b2391f5c8938aa75ab771b7edb50ef4`
- `AndroidDocumentsPluginInstrumentedTest.java`: `98cf6fab0ca72cc35e3bc2ebfc73e863728723444f927b6e191082a66abbf20d`
- `androidDocuments.test.ts`: `e69bd35d4018b3538c47a880433a66b5e130be5fafac73b36c21525aedb2c426`
- `androidWorkspacePlatform.test.ts`: `f3b27f9c5dbe8c7878a648083a73f01b3960859dfba159180b96cef79d576e35`
- `androidPdfReader.test.ts`: `cd184971208e470c3d4236771613fcbe3c1ea2c1e77b70284da4dc2714e22ada`

### Verifiers and artifacts

- `verify-android-document-undo.mjs`: `a421c1e2aa478ae3a34fe8fdf2535f0ee20ef9a25e42727e33e2dff46a03d7b2`
- `verify-android-document-rename.mjs`: `7267cbcf10a5ec92c5dbbcf0cd5db6736ee38f81db7b4508668a7e737630f3af`
- `verify-android-documents.mjs`: `00962903c9d87a5e90f7ef33e5cdb9e1db595cf9567d232f02e57feefb751890`
- `verify-android-plugin-catalogue.mjs`: `2324639eb05b877230b70dea53ef024d94a52b4fa328a1c943283735c464cfb3`
- `verify-android-document-delivery.mjs`: `ccdd0e249aa7a250938672f90db4508951d1cd418190f7ba5f79bb98c2bd7914`
- `verify-android-document-picker-pending.mjs`: `f3cce5ee4a44ce7ffa4cbb290f9604a2c197e2834204e1de0c87ae5a24cc4696`
- `verify-android-document-export-share.mjs`: `a6aef91dd4192dcb012be37786db4fc7e1ce00cd07fdbc11c901839faafa3f27`
- `verify-android-reader-backend.mjs`: `2eeb963526665e8e7d0b2146283ea9c3b4e1bc7ddf68f40bc98d36a48bbbc842`
- Debug APK: `91447f428531c015e114cd288f6679e69ce5d72a0ee85bd35794abfff2be90ac`
- Android-test APK: `29ad8dab5626907da1dec7f050d3e2ec5d7f36d64570876148e61342968053da`

## Preserved freeze

- `App.tsx`: `97a83a529a620a6487a8e7f36dc1f723050bbd5c06ad1ebff4f5744dfc3aece0`.
- Shared `dist/index.html`: `8b99b43d9b787e806b0d39fa176a3aa3cf297ff1f7238de05ebd19ed4ee2289c`.
- Shared `dist/sw.js`: `3d3d96dc93ad14ca998e14f72c380c44b9d7421d4ba6d86493259bfeecaea4db`.
- Protected Dashboard/ViewPDF/OCRPDF/FileUpload/useOpenedPdf hashes remain exact.

## Not checked

- Literal OS force-stop/relaunch undo sequence: NOT CHECKED separately.
- Physical OnePlus behavior: NOT CHECKED.
- Same-signer production upgrade, signing fingerprints, Play internal upgrade, and production publish: NOT CHECKED.

## Next boundary

T906 owns the combined exact-Claude normal-phone activation of durable `d1_` rename and undo. It must preserve current destructive clear semantics and keep legacy `a1_` rename/undo disabled.
