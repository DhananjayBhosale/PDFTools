# T911 Android onboarding continuity acceptance

Accepted on 2026-08-30 against the exact current shared source, the v21 legacy debug predecessor, and the rebuilt Android debug candidate.

## Accepted behavior

- Android performs one strict legacy-settings read before first React render, bounded to 1,500 ms.
- An existing shared `onboardingComplete=true` returns before any native availability check or read.
- Only `health=ok|partial_invalid` with independently validated `onboarding_completed === true` can mark the shared onboarding complete.
- False, absent, missing, blank, corrupt, unavailable, rejected, timed-out, and storage-failure paths preserve the genuine first-run sheet.
- The import window closes synchronously before render. A native read that resolves after timeout returns `abandoned` and cannot mutate localStorage.
- Android constructs its workspace platform once before the gate and renders it once after the gate settles. Browser and iOS branches retain their prior behavior.
- The exact Opus `components/UI/Onboarding.tsx` bytes remained frozen; no component, copy, layout, CSS, token, native, Gradle, manifest, permission, dependency, version, signing, or Play source changed.

## Evidence

- Test-first contract: the initial focused run failed because the helper/import/bootstrap did not exist.
- Focused final tests: `node --test tests/platform/androidOnboardingContinuity.test.ts tests/ui/androidOnboardingContinuity.test.ts tests/security/nativeFrontendShell.test.ts` — PASS, 31/31.
- Dedicated verifier: `node scripts/verify-android-onboarding-continuity.mjs` — PASS.
- TypeScript: `npm run lint` / `tsc --noEmit` — PASS after the final build and emulator run.
- Production build: Vite 8.2.2 transformed 2,581 modules; 194 offline assets were injected into cache `58e42d1cde30`; main entry `index-DTdOLomn.js`.
- Android copy/build: every one of the 197 `dist` files matched Android packaged public bytes; the only Android-public extras were Capacitor's expected `cordova.js` and `cordova_plugins.js`. `:app:assembleDebug` — BUILD SUCCESSFUL.
- Disposable normal-phone update gate:
  1. fresh v21 debug showed onboarding;
  2. Skip completed it, and a v21 process relaunch landed on Home;
  3. current debug installed with `adb install -r -d` without uninstall/data clear;
  4. candidate first post-update launch and process relaunch both landed on Home without the repeated sheet;
  5. only after that proof, clearing the disposable debug package restored the genuine candidate first-run sheet.
- Focused disposable log scan: zero crash, ANR, Chromium-unhandled, or Capacitor error hits.
- Cleanup: emulator-5566 was closed and disappeared from `adb devices -l`; emulator-5554 was not targeted. Chrome was not opened.

## Exact Opus verdict

Exact read-only Claude Opus 5 session `5b9eec15-ca2c-4389-acc9-0bb5edda88e2`, effort `xhigh`:

- `UI_VERDICT: PASS`
- `SOURCE_CHANGED: NO`
- `REMAINING_VISUAL_GATES: NONE`
- `CONSENSUS_STATUS: READY`

Opus independently confirmed the shared-true short circuit, strict health/boolean policy, timeout late-write guard, single construction/render, unchanged service-worker security boundary, and frozen visible component.

## Bound hashes

- `index.tsx` `c48926d933d82c86ab16990ecddd106c9edd427222c8f70d7342d52e1b522dd9`
- `androidOnboardingContinuity.ts` `f47d42725c862c798460b5f98e510567d5f4a0d9fa344a8414a51203031453a2`
- platform tests `4d94177b9912287639646c74e6737ef111f7704096a6fa991d41607dd2dbcf58`
- bootstrap/source tests `ce893b76814c83981d4bb2a256f1a1ce462e5ab56cce93f96ef0c6e793f31733`
- verifier `243c6e16cc8ce3f1df0fc2cbd3d9dc312fbc4cd315c25413afb4ba1f76a107ab`
- frozen `Onboarding.tsx` `ef9b44dea7119ff5cea6e5895233b8a5af97b0f3010ce1ce400ca040b0cd0b24`
- `dist/index.html` and Android packaged index `995ee37c9dca7825d014d9d9d4c2ae90d15dc10b3e72a178e99b74add732d7b4`
- `dist/sw.js` and Android packaged service worker `65ade903b1cbf8e11fbe404428e51556e6cce67dda5698cba4ce4ffdf46a91dd`
- main JS `134041df9d5e6e38aa6f96456203278a3762a607ce6226e81b6e374417b00fcd`
- debug APK `8457e59db852888659cf1900d1054cee5126915a33c2bf5c5e8462a286e9ee0d`
- first post-update Home `119caf278e7845a48d1c629a7e550b911e3e52993db9db5b572182c57193d90a`
- post-update process relaunch Home `9b93117153ff29a2d5060089477b24b3e90b34b118ba4883fe51380e65844ece`
- genuine first-run control `c778dd177217c9e76b411781ada7772e1b39c9988aae160048d7c2a300e53280`

## Remaining boundary

T911 closes Android onboarding continuity only. The candidate remains versionCode 1/versionName 1.0, below the known v21 predecessor. Production application identity, Play App Signing fingerprint, highest Play version, release-build performance, Play internal update, and physical-device acceptance remain open. The shared `dist` advanced for Android; iOS packaged assets require a later explicit resync before any iOS release claim. `full_outcome_complete: false`; `production_release_ready: NO`.
