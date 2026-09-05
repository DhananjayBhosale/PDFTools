# T915 — ordinary Android v21-to-v22 update

Date: 2026-08-30

## Verdict

`ORDINARY_LOCAL_DEBUG_UPDATE: PASS`

The exact v21 Kotlin-reference debug predecessor upgraded to the current v22 Capacitor debug candidate through ordinary `adb install -r`. No downgrade flag, uninstall, clear-data, signer workaround, restore, physical device, signing credential, or Play action was used.

This is local same-debug-certificate evidence only. It does not prove Play App Signing compatibility, a Play internal update, production signing, or physical-device acceptance.

## Bound artifacts

| Artifact | Package | Version | SHA-256 |
|---|---|---|---|
| Kotlin predecessor debug APK | `com.dhananjaytech.pdfchef.debug` | 21 / 2.2.4-debug | `a64cb59c8686d08fedb219cc3d83af7e66da4067faf16f4d76761e1cd8be23f1` |
| Capacitor candidate debug APK | `com.dhananjaytech.pdfchef.debug` | 22 / 2.2.4 | `e1ac319842882dd15cde1fd026c66aee822b47577d33055312456223601b46fa` |

Both artifacts use Android debug certificate SHA-256 `68d93880fda2a6d340e58207d010471711d1e5c25e139b76aa587dfff4e41a0c`.

## Controlled sequence

- Created and booted disposable normal-phone AVD `PdfChefT915Api36` on explicit serial `emulator-5566`; API 36, 1080×2400, 420 dpi.
- Confirmed PDF Chef was absent before installing the exact v21 predecessor.
- Installed v21 fresh, launched it, and completed onboarding through the visible Skip action.
- Created one zero-byte app-private sentinel and hashed the onboarding DataStore.
- Installed the exact v22 candidate with `adb -s emulator-5566 install -r <candidate>`; result `Success`.
- Confirmed installed `versionCode=22`, `versionName=2.2.4`; `firstInstallTime` remained 19:56:28 and `lastUpdateTime` became 19:58:03.
- Verified the private sentinel and onboarding DataStore hashes after the first candidate launch and again after a force-stop/cold relaunch.
- Captured normal-phone screenshots for predecessor Home, first post-update Home, and candidate relaunch Home.
- Captured package-PID-only logcat and found zero fatal, ANR, or security exceptions.
- Killed `emulator-5566`; only the pre-existing `emulator-5554` remained and was never targeted.

## State continuity

The bounded private state remained byte-identical across the update and relaunch:

- Sentinel SHA-256 before/after: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Onboarding DataStore SHA-256 before/after: `f9d7306b870e550d11e067e3f06ee998c01145a8a8da1f61aef0303772d042d5`.

Both candidate launches rendered the Tools/Home surface rather than onboarding. The relaunch accessibility tree contains `PDF Chef`, `Recent`, and `Settings`; exact onboarding `Skip` and `Continue` controls are absent. Cold launch timings were 969 ms for the first post-update launch and 1,142 ms after force-stop.

## Evidence

Machine-readable receipt: `output/t915-android-ordinary-upgrade/evidence.json`.

Screenshots:

- `01-predecessor-v21-home.png` — `889d31db344a3c0f78fd81e320025d64bfa75406dec502517d009f713a50bc82`
- `02-post-update-v22-home.png` — `ca9f36b468e1c92dc140f029d01bdcd4bf4b1250bc68b3a887f74ea69a4cbde1`
- `03-relaunch-v22-home.png` — `89b8a41e8ff96477cbed820c0f9f298730535c097362eb29a44024817c366e2a`

Additional exact evidence hashes are recorded in `evidence.json`.

## Safety boundary

- The Kotlin project was read-only; only its prebuilt debug APK was installed.
- No frontend, Android source, build metadata, bundled assets, iOS files, signing configuration, credentials, or Play state changed.
- No Chrome tab was opened.
- The disposable AVD configuration remains stopped; it was not destructively deleted.
- No desktop QA was run.

## Next safe action

Prove actual legacy history and settings survival across the same ordinary v21-to-v22 update using bounded, privacy-safe predecessor-created fixtures on a fresh disposable normal-phone run. Keep production signing and Play internal update as separate explicit gates.

`SIGNING_UPDATE_COMPATIBILITY: NOT CHECKED`

`PLAY_INTERNAL_UPGRADE: NOT CHECKED`

`PHYSICAL_DEVICE: NOT CHECKED`

`PRODUCTION_RELEASE_READY: NO`

`full_outcome_complete: false`
