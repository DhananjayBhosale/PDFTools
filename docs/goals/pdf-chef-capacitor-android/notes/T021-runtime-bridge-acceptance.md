# T021 Runtime Bridge Acceptance

## Verdict

`ACCEPTED` on a newly created disposable `PdfChefT021Api36` API 36 emulator. The connected OnePlus was excluded by `ANDROID_SERIAL=emulator-5574` and was not tested.

- `RUNTIME_PLUGIN_DISCOVERY: PASS`
- `RUNTIME_HISTORY_READ: PASS`
- `RUNTIME_SETTINGS_READ: PASS`
- `RUNTIME_NO_MUTATION: PASS`
- `PHYSICAL_DEVICE: NOT_CHECKED`

## Accepted evidence

- Instrumentation source SHA-256: `0acde6229980453c1bd5dce5a12707fcf11e038025a2f8f72b181fde45955606`.
- Debug APK SHA-256: `262e6f2a3ef16ce926416ca903a6435d41103c519f154204d25ddfe7e46762e6`.
- Android-test APK SHA-256: `637f36bdfe04e79d1bc6b98bd9f71b902c207219dbf08f93080ee053636391f5`.
- Exact-class `connectedDebugAndroidTest`: BUILD SUCCESSFUL; 102 tasks.
- XML: one test, zero failures, errors, or skips; device `PdfChefT021Api36(AVD) - 16`.
- Logcat proves plugin registration and exactly two `readHistory` plus two `readSettings` JavaScript-to-native calls.
- Returned history and settings match synthetic stores and omit paths, stored filenames, URI fields, and raw preference bytes.
- The no-follow legacy-tree manifest is identical after the first and second read pairs.
- The test refuses pre-existing legacy roots and removes only tracked synthetic nodes leaf-first after the Activity and awaited bridge calls close.

The first instrumentation attempt failed in the asynchronous WebView test harness before interpretable bridge evidence. The harness was corrected within the one-file allowlist to use an explicit JavaScript result slot and polling. This was not a product failure.

## Limits

- Evidence covers fresh-install synthetic emulator data, not genuine installed-user data.
- Missing, blank, corrupt, partial-invalid, and bound matrices remain JVM/contract evidence rather than runtime instrumentation evidence.
- Process death, concurrency, writer transactions, performance, signing, genuine upgrades, physical devices, Play, UI activation, and production remain unverified.
- The shared 20-second readiness/result deadline can cause a false-negative on a slow page but cannot create a false PASS; the accepted test finished in 4.372 seconds.

## Next gate

T023 must freeze the smallest T014 mutation architecture in a read-only design note before any writer source exists. T014 remains queued with no implementation allowlist.
