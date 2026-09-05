# T034 trusted WebView security acceptance

## Decision

- `T034`: ACCEPT and done.
- Evidence: `LOCAL_TEST_ONLY` plus `EMULATOR`.
- Full migration outcome: incomplete.
- Production release ready: NO.

The Capacitor host now fails closed unless its runtime configuration resolves to the packaged `https://localhost` origin with no remote server or navigation allowlist. Restrictive WebView settings are applied before Bridge construction and reapplied afterward; the installed WebView and ServiceWorker clients refuse hostile origins while the existing HTTP(S) and two visible `mailto:` links continue through Android `ACTION_VIEW`.

## Frozen behavior

- Only the exact packaged HTTPS localhost origin may remain in the bridge-bearing WebView.
- Remote subframes/subresources, file/content/intent/javascript/data/blob navigation, hostile redirects, popups, mixed content, and file-URL escalation are refused.
- Remote ServiceWorker requests receive an empty response; exact packaged-origin requests route through Capacitor's local server.
- Inspector then SettingsWriter remain the only two explicit plugins and retain their registration order before bridge creation.
- Release WebView debugging finishes disabled.

## Fresh verification

- Focused JDK 21 JVM policy tests and Android-test compilation: PASS.
- Static WebView verifier, host skeleton, offline assets, packaged assets, release security, legacy inspector, and legacy writer: PASS.
- `lintDebug`, debug assembly, unsigned release assembly, Android-test assembly, and focused host-security tests: BUILD SUCCESSFUL with 267 tasks rerun.
- Disposable `PdfChefT034Api36` AVD started as `emulator-5554`, API 36, `sdk_gphone64_arm64`.
- Exact instrumentation class: `PdfChefWebViewPolicyInstrumentedTest`; `OK (1 test)` in 5.042 seconds.
- The emulator was stopped after proof. The connected OnePlus was never targeted.

## Identities

- `MainActivity.java`: `e686675ebe6d29a695dfdf3fe8d20d4d6435c5fa439b77d7a88088ccec0e7ba5`.
- `PdfChefWebViewPolicy.java`: `02c354e70eee064a90f354d0272c548807d602801e667c73763a1455d3bf3211`.
- JVM test: `c33fa36c6d9f351a415817087dee8b50db99b2fb85a57161917bd29e4b397a34`.
- Instrumentation: `2f6d5196811e8357abf215442d52c56b88ee241179e079bd1659e67dff6aacf6`.
- Static verifier: `423c1661324d68550e30e678caa8ffb55a9fde53007d77cf9bcb5fa94f76aeeb`.
- Debug APK: `0ccc48a91f0c3ba6a2f74a6d1eae4b61d50e536377ba95f078df1ba6b68d48a0`.
- Unsigned release APK: `b01815cafd7232e75845984c40467440437fde7c6a43aab5cafca59e94511104`.
- Android-test APK: `04555e14ead554bb8cdef9e549dd94c60f82d2f4cacdb7fdc565217a4a1b504c`.

## Independent review and remaining gates

Independent Sol Judge verdict: ACCEPT with no remediation. Same-origin service-worker/cache lifecycle risk moves to Claude Code Opus 5 High-owned T035. Physical-device behavior, signing, Play update, and production acceptance remain `NOT_CHECKED`.
