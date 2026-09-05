# T925 fresh completion audit

Decision: **NOT COMPLETE — SAFE LOCAL WORK REMAINS**

The historical T999 receipt is stale: it predates the accepted T900–T923 UI,
platform, versioning, update, R8, and minified-runtime work. Its release rejection
remains directionally correct, but its individual blockers are not current evidence.

## Current accepted evidence

- Production identity is exact: `com.dhananjaytech.pdfchef`, versionCode `22`,
  versionName `2.2.4`.
- Current unsigned release APK:
  `f878a8b17c75e371e23e365b1268b248fea4366ccb2092c15ad84e85f8f401d3`
  (20,130,255 bytes).
- Current unsigned release AAB:
  `333c7868ebe083931fb6b05aa2d0cb9e81b4440f7f96745981c08018d0623e93`
  (20,004,829 bytes).
- Public upload and Play App Signing fingerprints are separately evidenced by
  T913.
- T915–T917 prove a bounded same-debug-signer v21-to-v22 update without uninstall
  or clear-data, including one predecessor PDF/index, onboarding, Dark theme,
  Manrope, native reopen, byte preservation, and cold relaunch.
- T919–T923 prove unsigned R8 packaging and bounded minified-QA scanner/reader,
  durable Recent, relaunch, Settings, and package-scoped crash/ANR cleanliness.
- Exact Claude Opus 5 High mobile UI gates are accepted for the current bounded
  surfaces. No desktop QA is required by this Android run.

## Safe local blockers

1. **Legacy Recent fail-closed behavior is incomplete.**
   `createAndroidWorkspacePlatform` catches every legacy-inspector failure and
   returns `[]`. It also discards snapshot health. A bridge/corrupt-state failure
   can therefore look like an honestly empty Recent list, contrary to the owner
   fallback contract.

2. **Legacy batch-output directories are not surfaced.**
   The strict legacy contract parses collection records, but the Android workspace
   filters every collection out, and the document resolver rejects collections.
   The objective requires batch-output directories to survive and remain usable.

3. **The full upgrade fixture ladder is not runtime-proven.**
   Decoder fixtures exist for 0/1/50/300 entries, collections, Unicode/long names,
   missing/corrupt/truncated/interrupted states, but installed-predecessor update
   proof covers only the bounded one-record scenario. Non-zero savings, tool usage,
   tool options, low storage, reboot/low-memory interruption, and repeated-launch
   idempotence across the matrix remain partial or missing.

4. **Release-like performance proof is incomplete.**
   T910 provides a useful local debug baseline, while T921/T923 cover selected
   minified-QA surfaces. First Recent timing, representative small/medium/large
   processing, WebView long tasks, JavaScript heap, repeated PSS, battery/thermal,
   LMK/native-fault checks, and a release-equivalent comparator remain incomplete.

5. **Shared packaged assets are not currently aligned.**
   Current `dist` and Android packaged assets match:
   `index.html` `9e8b98549fd4ab10131948726706fd5326430ea3302a63933a15c8d439c75068`,
   `sw.js` `e4df719b74aa4211b532dcfdbf2f5f64b8d7782ad5e1b99d2c0b54b11481f42e`.
   iOS remains on `index.html`
   `8b99b43d9b787e806b0d39fa176a3aa3cf297ff1f7238de05ebd19ed4ee2289c`
   and `sw.js`
   `3d3d96dc93ad14ca998e14f72c380c44b9d7421d4ba6d86493259bfeecaea4db`.
   The project has `ios:sync` but no symmetric Android/all-platform synchronization
   command.

6. **Current comprehensive all-tool and accessibility acceptance is missing.**
   Source/contracts and representative workflows are strong, but the checked-in
   broad 21/21 run is historical. A current normal-phone all-tool smoke and focused
   accessibility pass are still required by the owner objective.

## Authority-only blockers

- Protected upload signing and public upload-certificate comparison.
- Play internal upload acceptance and genuine Play-signed install-over-predecessor.
- Physical OnePlus acceptance and physical release-like performance.
- Production crash/ANR/LMK/native-fault telemetry and every rollout action.

Those remain governed by `T924-release-authority.md`; public fingerprints do not
grant access to signing material, Play mutation, or a physical device.

## Fresh verdicts

- `CLAUDE_UI_VERDICT: PASS` for accepted current bounded mobile surfaces.
- `CODEX_ENGINEERING_VERDICT: FAIL` for the full release objective.
- `HISTORY_PRESERVATION: PARTIAL`.
- `SETTINGS_PRESERVATION: PARTIAL`.
- `FIRST_UPGRADE_PERFORMANCE: PARTIAL`.
- `STEADY_STATE_PERFORMANCE: PARTIAL`.
- `PROCESS_DEATH_RECOVERY: PARTIAL`.
- `SIGNING_UPDATE_COMPATIBILITY: NOT CHECKED`.
- `PLAY_INTERNAL_UPGRADE: NOT CHECKED`.
- `PHYSICAL_DEVICE: NOT CHECKED`.
- `PRODUCTION_RELEASE_READY: NO`.
- `full_outcome_complete: false`.

Next: map the legacy false-empty and collection compatibility boundary from current
source and the preserved Kotlin reference, then execute the smallest data-safe repair
before the broader fixture/performance/synchronization gates.
