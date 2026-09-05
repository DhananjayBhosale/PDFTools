# T909 Android independent clear acceptance

Accepted on 2026-08-30 against the current shared workspace and the Android-only packaged bundle.

## Accepted behavior

- `Clear the list` removes browser-session records plus native `d1_` metadata and payloads. It never touches read-only legacy `a1_` history or files and does not gain Undo.
- `Delete kept files only` removes browser-session and native payload bytes while retaining bounded metadata as `available=false` across refresh and activity recreation.
- Unavailable native rows remain listable but cannot read, open, save, share, rename, or enter reversible delete. Permanent row deletion still removes their metadata.
- Native payload clearing uses one forced `.payload-clear` marker per ref, atomic v3 metadata publication, strict no-follow verified deletion, directory fsync, bounded restart recovery, and idempotent retry. Existing v1/v2 owned records decode as available.
- The Android platform advertises `separateClearActions: true`; the exact-Opus Recent source stayed byte-frozen at `ced30798fc358ae49b0d26089c75aa65b7144485879e927f03a20c38232ac274`.

## Evidence

- TypeScript/UI: `node --test tests/platform/androidDocuments.test.ts tests/platform/androidWorkspacePlatform.test.ts tests/platform/androidPdfReader.test.ts tests/ui/androidIndependentClear.test.ts` — PASS, 43/43.
- TypeScript: `npm run lint` — PASS.
- JVM: focused `OwnedDocumentWriterTest` plus `AndroidDocumentsPluginContractTest` — PASS, 40/40, including every payload-clear crash checkpoint, v2 compatibility, unavailable gating, tamper rejection, and permanent metadata deletion.
- Verifiers: independent clear, Android documents, document delivery, and plugin catalogue — PASS.
- Build: Vite 8.2.2, 2,580 modules, 194 offline assets, cache `c2c396e89f05`; Android copy, debug APK, and Android-test APK — PASS.
- Emulator: `AndroidDocumentsPluginInstrumentedTest#payloadClearKeepsUnavailableRecordAcrossActivityRecreation` — PASS, 1/1 on disposable API 36.1 normal-phone emulator. The bridge proved exact DTOs, unavailable relaunch persistence, blocked read, idempotent retry, and permanent delete.
- Normal-phone evidence: `output/t909-android-final/02-recent-independent-clear.png` shows both live, independent destructive actions without the old coupled-clear note.
- Exact Claude Code Opus 5 High screenshot review — `UI_VERDICT: PASS`, session `52a8e67f-7cdb-4011-96ad-da5f32c96901`, `SOURCE_CHANGED: NO`, `REMAINING_VISUAL_GATES: NONE`.
- Cleanup: the disposable seed was deleted, the localhost WebView forward was removed, emulator-5566 was shut down, Chrome was not opened, and emulator-5554 remained untouched.

## Bound hashes

- `services/workspace.ts` `eb14e00cc61dfa8f43502ff1b55ac83d9cd418b61de9b41c03c037d662e165c3`
- `hooks/useWorkspaceRuntime.tsx` `c998fd03b57187c84f624fcd81de7829a7c7212fd627e2effe339665ff96096a`
- `services/platform/android/androidDocuments.ts` `03dbf90abda61e42968fbb9809a2b08f9ec21585b373e12c94acdff68624660f`
- `services/platform/android/androidWorkspacePlatform.ts` `f7f2a58c03fbbaeb850f4988dcb1e948e13917e500d7533549b82194be832da3`
- `OwnedDocumentWriter.java` `38329e4f88420a1f9c1fa2786c25a1c38f1057d762bc2883334439d8be0eed6e`
- `DocumentLifecycleCoordinator.java` `f05487f02136509ccfb6ec8a3600cadb00011b407ad08ce878da8f35155df92c`
- `AndroidDocumentsPlugin.java` `46e8a034cf41834fefec8de5e7a2d454390673bf5077fa47fca08ec239815220`
- dedicated verifier `16268e8096baf899f97719f1f59496bc4d235351d05cf2074a56ebeb93ea0eb7`
- instrumentation source `dd359026dd4ba3ff29eadf0d81aa925537b2fd7377d97948b8233ce73966553d`
- `dist/index.html` `03a3d46939ee0a26b4b60d6e2ad99ad43045a10c293acb6cc365c61327ceb648`
- `dist/sw.js` `dc1fc53a3697a2044d86528f3b94acf040805f4df980e6dacf909a0ca3866ac0`
- main JS `2d74132dd0de28f57a5c4862445d023c94a3ec565bacd3e5bd0f4e4f82342768`
- Recent chunk `dc655b37ea10e241e45b8c04292613c7470e534f854ea42fe501fbe64b658c1b`
- debug APK `25d0aa61cec60ac083040468efed5e946198271c5e724cbd19b09e20b3196213`
- Android-test APK `41fcefc2697ac194fc27be356eaac3821a0999b0f7ac602d6ca749b55d359f15`
- normal-phone capture `a70afa3226e58482a4752d7659fb918da7ef693e4bc6366d96b0701bb22faa91`

## Remaining boundary

This acceptance closes only independent clear semantics. It does not prove release readiness. Candidate version/update eligibility, paired first/steady-state performance, production signing/Play compatibility, physical-device behavior, and the explicit iOS package reconciliation after the Android bundle advance remain open. `full_outcome_complete: false`; `production_release_ready: NO`.
