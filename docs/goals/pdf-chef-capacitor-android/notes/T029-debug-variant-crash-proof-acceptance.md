# T029 / T014 debug-variant crash-proof acceptance

## Decision

- `T029`: PASS and done.
- `T014`: MODIFIED_ACCEPTED via the T028/T029 debug-only architecture.
- Evidence classification: `DEBUG_VARIANT_APPLICATION_OWNED_CRASH_PROOF`.
- Full migration outcome: incomplete.
- Production release ready: NO.

The accepted harness proves target-process crash behavior only in the debug variant. It does not prove a release-process crash, physical-device behavior, signing compatibility, Play upgrade compatibility, or production readiness.

## Bound runtime evidence

- Disposable target: `emulator-5584`, AVD `PdfChefT014Api36`, QEMU property `1`.
- Exact test class: `com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.AndroidLegacySettingsWriterInstrumentedTest`.
- Direct AndroidJUnitRunner result: `OK (2 tests)` in 10.242 seconds.
- Production package `com.dhananjaytech.pdfchef` was absent.
- Debug APK SHA-256: `de5f9df4b14fb493cffa14706d0d3911fa4d27555545eedf935809a7d8e84b05`.
- Test APK SHA-256: `b7d78bb95b35daf88fcfdbbca9a5ad84a9ac04ff34b7c747e803e277fa41ef54`.
- Unsigned release APK SHA-256: `c8e3ddd7056e3ba61a36e119d59d2f9b0ef4b443390fb81adf5da3e8ddcf07e6`.

The inspected remote-process test executes all three stages sequentially and asserts:

- `BEFORE_MOVE`: exact old bytes.
- `AFTER_MOVE`: exact candidate bytes.
- `AFTER_DIRECTORY_FSYNC`: exact candidate bytes.
- Every observation parses as a complete Preferences DataStore protobuf.
- Non-target raw slices remain exact.
- The crash process is dead before raw verification.
- Activity launch and the accepted reader perform no recovery or cleanup.

The ordinary bridge test also proves writer discovery, applied `DARK` mutation, accepted reader output, idempotent no-op, exact Application coordinator identity, and generic invalid-argument rejection.

## Build and exclusion evidence

- Focused compile and legacy unit gate: PASS, 105 Gradle tasks.
- Full rerun of unit tests, debug lint, debug APK, instrumentation APK, and unsigned release APK: PASS, 267 Gradle tasks.
- JVM result: 61 tests, 0 failures, 0 errors, 0 skipped.
- Static writer contract: PASS.
- Static read-only inspector contract: PASS.
- Android host skeleton: PASS.
- Release merged-manifest exclusion: PASS.
- Release dex exclusion: PASS.
- Shared `dist/index.html` and packaged Android `index.html` SHA-256: `c865b93f0de7a711261bd5a3707267398964bce5d0d36ed3f47453d4fd386435`.

The release Application remains the accepted no-lifecycle, no-I/O singleton. The debug-only service is non-exported, has no intent filter, validates an explicit component, runs in `:legacyThemeCrash`, and obtains the sole coordinator owned by that process's debug Application.

## Key source identities

- Release Application: `1b993160a32c066437e5ec77c991608fc995000e56a9458d4e1cb85fb0f93c1c`.
- Debug Application: `97ed8976cb587db50a68fdf759d0cc71e026f6f746ea7efbe44bcb752a840a9f`.
- Debug crash controller: `568630c9fb44f8d5503a0809527a4c2499302690876afa6cdf3a93ddc6ab3fc5`.
- Debug crash service: `7b0c118fde15f03b8179ee5d6489a74d9c7b3ac694db28a0048404c83ccc8550`.
- Instrumentation test: `6af47f85ebb4baf249dbaa20ef6beefda479d9655e3b444e6bf3155d05459b46`.
- Writer verifier: `12338b552c5614ce7f120618f837d89b8538b8703ad70bb5a98fba748b8a1a81`.

The service source was moved to the filesystem directory matching its declared parent package to satisfy Android lint. Its bytes and hash did not change.

