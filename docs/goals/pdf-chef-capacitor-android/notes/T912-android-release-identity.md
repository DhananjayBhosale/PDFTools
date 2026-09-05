# T912 — Android release identity and update eligibility

Date: 2026-08-30

## Verdict

T912 establishes the exact local identity boundary. It does **not** establish genuine Google Play update eligibility.

- Production application ID in source: `com.dhananjaytech.pdfchef`.
- Current candidate source and APK version: `versionCode 1`, `versionName 1.0`.
- Known predecessor artifacts reach `versionCode 21`; therefore the current candidate version is not eligible for an ordinary update.
- The current production-package release APK is unsigned.
- The only local production-package v21 artifact is signed by the Android debug certificate, not the known upload certificate.
- The exact v20 release APK is signed by the known upload certificate `932ad2a73f09c3ccb40711e51e3808c22a0aaced1af3fd10f9a7222f357747ce`.
- Highest active/internal Play versionCode: **UNKNOWN / NOT CHECKED**.
- Play App Signing certificate SHA-256: **UNKNOWN / NOT CHECKED**.
- No version metadata, APK, signing material, Play state, device, or Kotlin reference bytes were changed by this task.

## Exact local artifacts

| Artifact | Package | Version | Debuggable | Signer | SHA-256 | Local update meaning |
|---|---|---:|---|---|---|---|
| Current debug | `com.dhananjaytech.pdfchef.debug` | 1 / 1.0 | Yes | Android debug `68d93880...e41a0c` | `8457e59db852888659cf1900d1054cee5126915a33c2bf5c5e8462a286e9ee0d` | **INELIGIBLE** for an ordinary update over legacy debug v21 because 1 < 21. T910's `-d` path was a controlled debuggable downgrade only. |
| Current release unsigned | `com.dhananjaytech.pdfchef` | 1 / 1.0 | No | Unsigned | `9e9b51453524d48f5817646b434b89e136ea36f6cfb082f1a9df23a3ae609913` | **INELIGIBLE**: unsigned and lower than known v20/v21. |
| Legacy debug v21 | `com.dhananjaytech.pdfchef.debug` | 21 / 2.2.4-debug | Yes | Android debug `68d93880...e41a0c` | `a64cb59c8686d08fedb219cc3d83af7e66da4067faf16f4d76761e1cd8be23f1` | Exact controlled-debug predecessor only; not production/Play identity. |
| Legacy benchmark v21 | `com.dhananjaytech.pdfchef` | 21 / 2.2.4 | No | Android debug `68d93880...e41a0c` | `f45d88c46cb672311c9bf02a70c8bd2879e6b3c35e37b6d70742cfc6cbb2d441` | **INELIGIBLE** over upload- or Play-signed production installs because its signer differs. |
| Legacy production v20 | `com.dhananjaytech.pdfchef` | 20 / 2.2.3 | No | Known upload certificate `932ad2a7...7747ce` | `6438eb992c06970ae56fda23dc483e4c61d4bac6868641b5b7ee0e3c270b0d89` | Exact local upload-certificate identity. It does not reveal Google's Play App Signing identity. |

Full machine-readable evidence: `output/t912-android-release-identity/local-artifacts.json`.

## Source cross-check

- `android/app/build.gradle` SHA-256 `77dfcf55e0ad3423cc9640641973873935f6cb182ed3a220b167aeb208b15208`.
- `android/variables.gradle` SHA-256 `2488763e986ea629c13e771ba9d886608fca8cb97809c1c0b3603011b4dba217`.
- Production `applicationId` is exact; debug adds `.debug`.
- Namespace and launch activity remain `com.dhananjaytech.zenpdf_allpdftoolsinoneplace` and are not the production application ID.
- Current source remains `minSdk 29`, `targetSdk 36`, `versionCode 1`, `versionName 1.0`.

## Eligibility matrix

| Path | Verdict | Reason |
|---|---|---|
| Legacy debug v21 → current debug v1, ordinary install | **INELIGIBLE** | Same debug package/certificate, but version decreases. |
| Legacy debug v21 → current debug v1, controlled `adb -r -d` | **ELIGIBLE FOR LOCAL DEBUG ONLY** | Requires debuggable downgrade semantics; it is not release or Play evidence. |
| Legacy production v20 → current unsigned release v1 | **INELIGIBLE** | Candidate is unsigned and version decreases. |
| Legacy production v20 → legacy benchmark v21 | **INELIGIBLE** | Package/version align, but the benchmark APK uses the Android debug certificate rather than the upload certificate. |
| Existing Play install → a future upload-signed AAB | **UNKNOWN** | Play App Signing certificate and highest active/internal Play versionCode are not yet verified. Play re-signing identity is authoritative for delivered updates. |

## Read-only Play check

One new Google Chrome tab opened `https://play.google.com/console/`. It redirected to `https://play.google.com/console/u/0/signup`; no authenticated PDF Chef app, track, or App Integrity surface was available. The tab was closed. No login, account, browser data, Play data, track, upload, or rollout change was attempted.

Evidence: `output/t912-android-release-identity/play-console-check.json`.

## Verification

- `node scripts/inspect-android-release-identity.mjs --self-test`: PASS.
- Read-only inspector over five exact APKs: PASS.
- Android SDK Build Tools 36.1.0 `aapt` and `apksigner` bound package/version/debuggable/certificate facts to artifact hashes.
- Source cross-check against current Gradle files: PASS.
- Build/sign/install/device/physical/Play mutation: NOT RUN by design.

## Next safe action

Sign in to Google Play Console in the user's Google Chrome, then rerun a read-only T913 check for:

1. the highest active/internal PDF Chef versionCode across relevant tracks; and
2. the public Play App Signing SHA-256 from App Integrity.

Only after those facts are captured may a strictly higher candidate versionCode be selected. Release signing must then use the registered upload identity without exposing credentials, followed by an internal-track Play-signed update test. Until then:

`SIGNING_UPDATE_COMPATIBILITY: FAIL`

`PLAY_INTERNAL_UPGRADE: NOT CHECKED`

`PRODUCTION_RELEASE_READY: NO`

`full_outcome_complete: false`
