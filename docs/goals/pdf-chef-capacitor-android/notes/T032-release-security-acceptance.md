# T032 release security baseline acceptance

## Decision

- `T032`: ACCEPT and done.
- Evidence classification: `LOCAL_TEST_ONLY`.
- Full migration outcome: incomplete.
- Production release ready: NO.

The dormant Google Services buildscript classpath and conditional app-plugin activation were removed. No plugin, manifest capability, runtime intent, UI, signing, credential, Kotlin-reference, device, or Play state changed.

## Frozen security baseline

- Production package remains `com.dhananjaytech.pdfchef`; debug remains `com.dhananjaytech.pdfchef.debug`.
- Java 21, SDK values, Capacitor, Cordova, DataStore, Gson, and accepted build-type behavior remain unchanged.
- The resolved release runtime classpath contains the accepted AndroidX, Capacitor, Cordova, DataStore, and Gson stack with no Google Services, Firebase, analytics, advertising, or telemetry SDK.
- The launcher is the only unprotected exported component.
- `androidx.profileinstaller.ProfileInstallReceiver` remains exported but is protected by `android.permission.DUMP`.
- The debug crash service remains non-exported in `:legacyThemeCrash` and is absent from release.
- The artifact verifier requires both merged manifests and both APKs, freezes exact permission/component catalogues, and scans DEX string tables for forbidden telemetry SDK namespaces.

## Fresh verification

- `HostSecurityContractTest`: 2 tests, 0 skipped, 0 failures, 0 errors.
- `:app:lintDebug :app:assembleDebug :app:assembleRelease --rerun-tasks`: BUILD SUCCESSFUL, 236 tasks executed under temporary JDK 21.
- Android release-security verifier: PASS against fresh debug/release merged manifests and APKs.
- Legacy inspector verifier: PASS.
- Legacy settings-writer verifier: PASS.
- Independent Sol Judge verdict: ACCEPT; no remediation required.

## Source and artifact identities

- `android/build.gradle`: `7fbe17fc1bbcc57213ff3e358ba5beb94d29e1d5484e57d2970c1773fea4b8e3`.
- `android/app/build.gradle`: `c5c41098a4fcae46716f8f1d9aaa1ecd804e8cd917cdaf4babe8e10c45776151`.
- Release-security verifier: `a92d31a715cf5702e02a898966f46ea3c23f0a363d7cb2386a9f6acf13a527cb`.
- Host-security test: `da8f74a05705916889828fbe73411e339494a8c45a8ef734055042ad870c24a7`.
- Legacy writer verifier: `af619c84b4254b4ba75359442b4f6df71b8fccec831f4e9f34cf605c974335a0`.
- Debug APK: `8abaacf929db4504acf73fec413b7ebda9663cf8b0362890422e28812acee316`.
- Unsigned release APK: `bd91570e348f7455d50a6c1d3fb5d284b55a7f298af35e46e23a7cc1aaefd42f`.

The writer verifier changed only its two frozen Gradle hash literals. Restoring the prior literals reproduces the exact prior verifier hash `12338b552c5614ce7f120618f837d89b8538b8703ad70bb5a98fba748b8a1a81`.

## Limitations

- The release APK is unsigned and unminified.
- No emulator interaction, physical device, signing compatibility, Play internal update, or production evidence was produced.
- This slice proves the current host security baseline only; it does not complete the migration.
