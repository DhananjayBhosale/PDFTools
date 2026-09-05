# T916 — legacy history and settings ordinary-update matrix

Date: 2026-08-30

## Verdict

`LEGACY_HISTORY_UPDATE: PASS`

`LEGACY_THEME_UPDATE: PASS`

`LEGACY_INTERFACE_FONT_UPDATE: FAIL`

The exact v21 debug predecessor created one synthetic PDF through its real `OfflinePdfRepository`, persisted Dark + Manrope + completed onboarding, and upgraded to the exact v22 candidate through ordinary `adb install -r`. History bytes, PDF bytes, the entire legacy settings DataStore, onboarding, Dark theme, Recent visibility, native reopening, and cold relaunch all survived. The candidate did not bring the predecessor’s Manrope choice into its existing Interface font setting; it showed Inter on both candidate launches.

T916 is therefore a successful upgrade/data-integrity proof with one concrete settings-surface failure, not a production-readiness pass.

## Real predecessor-owned fixture

The read-only Kotlin project was not built or edited. Its existing debug Android-test APK (`a37d7ba9540791d60f4045dbcb5f8efa131103a13c32e7803f88e02527138152`) targets `com.dhananjaytech.pdfchef.debug` and shares the exact debug certificate with predecessor/candidate.

Existing `PdfReaderInstrumentationTest` passed 1/1 and used the production `OfflinePdfRepository` to create a genuine saved output/history row:

- ID 1, `reader-smoke.pdf`, `Create PDF`, 10,461 bytes, application/pdf.
- `processed_index.json` SHA-256 `f1d47e9977e99da971608afa776b60ea9c8c12ec6d28c524da18b4b6d04a215e`.
- managed PDF SHA-256 `0872a4517fefdd74b950bd76ef4449f12ad626752ab9f1443086012e6cb75b4e`.

The predecessor UI then visibly selected Dark and Manrope after onboarding completion. Its DataStore SHA-256 was `5a6a3bc6e3a6a42df57220a6fa5390a1363af9445192c62559ea81eec2f25b96`.

## Ordinary update and byte continuity

The exact command was `adb -s emulator-5566 install -r <candidate-debug-apk>`. It returned `Success`; no `-d`, uninstall, clear-data, restore, or signer workaround was used.

Installed candidate metadata is 22 / 2.2.4. All three private hashes were exact immediately after install and after the candidate cold relaunch:

| Private state | Before | After install | After relaunch |
|---|---|---|---|
| Legacy index | `f1d47e99...a215e` | exact | exact |
| Legacy PDF | `0872a451...5b4e` | exact | exact |
| Legacy settings DataStore | `5a6a3bc6...f25b96` | exact | exact |

The candidate did not rewrite, relocate, promote, or corrupt the legacy files.

## Candidate behavior

- First launch and cold relaunch opened Home/Tools rather than onboarding.
- Dark was applied before the first captured candidate Home and remained selected in Settings after cold relaunch.
- Recent showed exactly one `reader-smoke.pdf` row as `Older Android file · read-only here` on first launch and relaunch; no false-empty state occurred.
- Reopen launched the sealed native reader, which showed `reader-smoke.pdf`, `Page 1 of 24`, and rendered the synthetic page text.
- Package-PID-only logcat contained zero fatal, ANR, or security exceptions.
- The candidate Interface font field showed Inter on first launch and relaunch even though the predecessor selected Manrope and the DataStore was byte-identical.

## Root cause boundary

The existing Android settings integration imports/writes only `theme_mode`. `LegacySettingsInspector` already validates and exposes `app_font_option`, and the existing shared Settings page already has a supported `interfaceFont` field. There is no one-time precedence-aware adapter that maps the valid legacy value into that shared setting.

The smallest repair is nonvisual behavior: when Android has no valid explicit shared `interfaceFont`, read the valid legacy value once, map supported values canonically (including `MANROPE` → `manrope`), store it through the existing workspace settings authority, and never write or repair the legacy DataStore. A valid shared choice must always win. Unknown legacy fonts must leave the shared default unchanged rather than inventing a value.

## Safety and cleanup

- Normal-phone API 36 only; no desktop QA.
- Only synthetic fixture content was used.
- No source/build/dist/iOS/Kotlin-reference/signing/Play change occurred.
- No Chrome tab was opened.
- `emulator-5566` was killed; only pre-existing `emulator-5554` remained and it was never targeted.

Machine-readable receipt: `output/t916-android-legacy-state-upgrade/evidence.json`.

## Next safe action

Implement and focus-test the smallest precedence-aware legacy interface-font import through the existing shared workspace settings authority, then repeat only the Settings/history portion of the ordinary update matrix on a disposable normal-phone emulator. Because the selected font changes rendered typography but not layout or controls, bind the final current-hash mobile Settings evidence to exact Claude Opus 5 review before acceptance.

`SIGNING_UPDATE_COMPATIBILITY: NOT CHECKED`

`PLAY_INTERNAL_UPGRADE: NOT CHECKED`

`PHYSICAL_DEVICE: NOT CHECKED`

`PRODUCTION_RELEASE_READY: NO`

`full_outcome_complete: false`
