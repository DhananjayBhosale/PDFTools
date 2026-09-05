# T914 — Android migration release metadata

Date: 2026-08-30

## Verdict

The Capacitor Android application now uses the accepted migration candidate identity:

- Production application ID: `com.dhananjaytech.pdfchef` — unchanged.
- Debug application ID: `com.dhananjaytech.pdfchef.debug` — unchanged.
- Namespace: `com.dhananjaytech.zenpdf_allpdftoolsinoneplace` — unchanged.
- versionCode: **22**.
- versionName: **2.2.4**.

VersionCode 22 is above both the authoritative Play maximum 20 and the known local Kotlin/debug predecessor 21. No signing or Play action occurred.

## Exact source delta

Only these release-metadata contracts changed:

- `android/app/build.gradle`: versionCode `1` → `22`; versionName `1.0` → `2.2.4`.
- `scripts/verify-android-release-security.mjs`: exact debug/release APK expectation updated to `22 / 2.2.4`.

Application ID, namespace, debug suffix, SDK levels, Java contract, dependencies, ML Kit scanner, AndroidX reader, manifests, permissions, signing configuration, UI, shared source, `dist`, iOS, and the Kotlin reference were not edited.

## Build and artifacts

The first build invocation used the shell's Java 25 and failed before project compilation with `Unsupported class file major version 69`. A second sandboxed JDK 21 invocation could not acquire the existing Gradle wrapper lock outside the workspace. The authorized retry used the previously pinned Temurin 21.0.12.1 with process-local `JAVA_HOME` and passed:

```text
./gradlew --no-daemon :app:assembleDebug :app:assembleRelease
BUILD SUCCESSFUL in 12s
188 actionable tasks: 53 executed, 135 up-to-date
```

Exact artifacts:

| Variant | Package | Version | Signing | Bytes | SHA-256 |
|---|---|---|---|---:|---|
| Debug | `com.dhananjaytech.pdfchef.debug` | 22 / 2.2.4 | Android debug certificate `68d93880...e41a0c` | 38,435,765 | `e1ac319842882dd15cde1fd026c66aee822b47577d33055312456223601b46fa` |
| Release | `com.dhananjaytech.pdfchef` | 22 / 2.2.4 | Unsigned | 33,561,956 | `fe6a69915fef3ea304b6e036afda40d45dec846f4dca76772a9614c91d383032` |

Machine-readable evidence: `output/t914-android-release-metadata/artifacts.json`.

## Focused verification

- `node --check scripts/verify-android-release-security.mjs`: PASS.
- `node scripts/verify-android-settings-device-facts.mjs`: PASS.
- Combined JDK 21 debug/release build: PASS.
- `node scripts/verify-android-release-security.mjs`: PASS against current source, merged manifests, APK manifests, and DEX namespace catalogue.
- `aapt dump badging`: both artifacts are exact `22 / 2.2.4`; production/debug package separation is exact.
- `apksigner`: debug verifies with the expected debug certificate; release is explicitly unsigned.
- Generated `output-metadata.json`: both variants report `22 / 2.2.4`.
- Android packaged assets: PASS, 197 byte-identical `dist` files plus two documented empty Cordova extras.

`scripts/verify-android-app-metadata.mjs` was also attempted but failed its historical assertion that registration must remain gated. T907 intentionally superseded that inactive contract by registering AndroidAppMetadata; the current `verify-android-settings-device-facts.mjs` is the accepted active verifier. T914 did not broaden scope to rewrite historical verifier debt.

## Safety boundary

- No signing credential, key, alias, password, or private certificate material was accessed.
- No release APK/AAB was signed.
- No app was installed and no emulator or physical device was used.
- No Chrome tab was opened for this task and no Play state changed.
- The existing Kotlin project remained read-only.

## Next safe action

Use the v21 debug predecessor and current v22 debug candidate on one disposable normal-phone emulator to prove an ordinary same-package/same-certificate `adb install -r` update without `-d`, uninstall, or data clear. Preserve onboarding/settings/history evidence and close the emulator afterward.

`SIGNING_UPDATE_COMPATIBILITY: NOT YET PASSED`

`PLAY_INTERNAL_UPGRADE: NOT CHECKED`

`PRODUCTION_RELEASE_READY: NO`

`full_outcome_complete: false`
