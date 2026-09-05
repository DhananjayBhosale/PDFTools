# T040 and mobile Tools milestone acceptance

## Decision

Independent Judge result: `ACCEPTED`.

- T040 is complete. `AndroidDocuments` exposes exactly `readChunk` for accepted
  `a1_` and `d1_` refs; every other document method and listener remains absent.
- Each build variant owns exactly one graph-lazy `DocumentLifecycleCoordinator`.
- Registration remains Inspector, SettingsWriter, AndroidDocuments, then bridge
  creation. The T034 trusted-origin boundary remains frozen.
- The FileProvider is non-exported, read-only, rooted only at the accepted share
  staging directory, and its recipient probe exists only in the test APK.
- The Opus 5 Sizes & Tools redesign is accepted for the user-requested normal
  Android phone scope. Desktop-specific follow-up and testing were explicitly
  excluded from this run.

`T041` is unblocked. Omitted native methods, broad T015, physical-device use,
signing, Play Console, and production claims remain separately gated.

## Verification evidence

- Focused mobile UI contract: 16/16 PASS.
- Native frontend security contract: 19/19 PASS.
- Production web build and Capacitor Android copy: PASS; packaged index equals
  `dist/index.html`.
- T040 document, catalogue, delivery, legacy, WebView, host, and release-security
  verifiers: PASS.
- Full JDK 21 milestone build: 267/267 tasks executed; JVM tests, lint, debug APK,
  release APK, and androidTest APK PASS.
- Disposable `emulator-5570`: QEMU `1`, API 36, 1080x2400. Exact-class run PASS,
  6/6: document plugin, cross-UID provider, legacy inspector, legacy writer, and
  WebView policy.
- The first runtime attempt correctly failed because `bindService` alone did not
  convey the URI grant and the accepted legacy runner required a serial argument.
  The test-only recipient was corrected to receive the exact T039 intent through
  `startService`; the rerun passed. Product behavior did not change.
- Installed APK normal-phone screenshot was inspected after onboarding dismissal.
  The emulator, temporary Vite server, and three run-owned Playwright Chrome
  profiles were closed. ADB then listed only the untouched OnePlus serial
  `3C15A8005Q600000`.

## Frozen hashes

- Debug APK: `37d798bd0b704413311fb2640dbc4632e49597c9eb67b1ecc6b5578bfb659aa6`
- Unsigned release APK: `28e1a905fab27301c867af43e7f810ec209b6ffd0154f3a18dad6534dc1da66f`
- androidTest APK: `9b9d7f119389ffa649377479b8bef6f877d64834b82c6f9a9870a55759a84fe6`
- Coordinator: `98b1f046be018c70f60dd8df8af9562f193c01b9d6dfd212d886ae92dd581c1e`
- AndroidDocuments plugin: `84ea15df9795300d0eca4c302ab11c1f06865458489464487e710cab53c65371`
- Read-only provider: `d19a1ea52897a209a82f14b8d0e2104999ca1fe1749f7a1204b15ea5b815ccbb`
- Mobile Dashboard: `76b2886e38f235bd7c718521dc490b68c391771130ff6a9acdd4462277de035e`
- WebView verifier: `ceb1d15be3ab42f9f50cae3f962c89a528dd40b738ce1e18ac2feea1d5e8be49`
- Plugin catalogue verifier: `8a7126318d0c092b656b3872ce288c2f3130a52e19958477b30d964ddd5a448c`
- Legacy writer verifier: `915464e57532471fbda3f790609b4da4033066cb1bddfca117763b597e69720a`

## Explicit limitations

- Physical device, genuine predecessor upgrade, release signing, Play state, and
  production behavior: `NOT CHECKED`.
- Broader hardware and desktop visual acceptance: `NOT CHECKED` in this run.
- `full_outcome_complete: false`
- `PRODUCTION_RELEASE_READY: NO`
