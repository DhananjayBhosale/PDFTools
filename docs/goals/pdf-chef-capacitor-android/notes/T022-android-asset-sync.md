# T022 Android Asset Synchronization

## Result

`DONE`. The current already-built shared `dist` was synchronized into Capacitor's generated Android asset directory with `npx cap copy android`. No React, TypeScript, CSS, source-image, Java, Gradle, Kotlin-reference, signing, device, or Play file was intentionally changed.

The shared build changed once during the first assembly, so that intermediate APK was rejected. After `dist` became stable, the copy and assembly were repeated. The accepted artifact binds all three index copies to the same SHA-256:

- `dist/index.html`: `25f165622bb73f71335ebb2cab176d1d9a23229b1e8980b5cb854428a1bc1997`
- `android/app/src/main/assets/public/index.html`: `25f165622bb73f71335ebb2cab176d1d9a23229b1e8980b5cb854428a1bc1997`
- `assets/public/index.html` inside the debug APK: `25f165622bb73f71335ebb2cab176d1d9a23229b1e8980b5cb854428a1bc1997`

## Verification

- `npx cap copy android`: PASS.
- Every `dist` file has a byte-identical packaged counterpart; the only generated extras are `cordova.js` and `cordova_plugins.js`.
- `node scripts/verify-android-host-skeleton.mjs`: PASS.
- `:app:assembleDebug :app:assembleDebugAndroidTest`: BUILD SUCCESSFUL; 101 tasks on the accepted assembly.
- Debug application ID: `com.dhananjaytech.pdfchef.debug`.
- Debug APK SHA-256: `262e6f2a3ef16ce926416ca903a6435d41103c519f154204d25ddfe7e46762e6`.
- Test APK SHA-256: `0eb730f4d2de109e7d03f113e0f4f35a970a7293c0ab3e93b439936e3fad2923`.

This is generated-asset and debug-artifact parity only. It is not a UI verdict or release-readiness claim.
