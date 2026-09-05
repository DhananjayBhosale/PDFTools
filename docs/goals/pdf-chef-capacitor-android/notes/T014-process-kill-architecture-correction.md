# T014 process-kill architecture correction

## Verdict

`MODIFIED / STOPPED_AS_DESIGNED`

The first instrumentation worker stopped correctly. Android Gradle Plugin packages
`src/androidTest` as the separate `com.dhananjaytech.pdfchef.debug.test` APK. A
non-exported remote service declared there is not a component of the target debug
application, does not own the target application's private `filesDir`, and cannot
serve as the target writer process. Killing the instrumentation process at an
injected checkpoint also removes the only in-process controller.

T014 remains incomplete. The invalid androidTest-service design is rejected rather
than weakened.

## Accepted correction

Use host-controlled ADB/JDWP breakpoints against the exact debuggable target process.
The external host remains alive when the suspended target PID is killed. Break only
at natural production statements:

- `BEFORE_MOVE`: the source line invoking `io.atomicMove(...)`, before invocation.
- `AFTER_MOVE`: the first executable line after a successful atomic move and before
  directory fsync.
- `AFTER_DIRECTORY_FSYNC`: the return line after successful directory fsync.

For each case the host must prove an explicit disposable `emulator-*` serial, attach
JDK 21 `jdb` to the target PID through ADB JDWP forwarding, confirm the exact
class/method/frame breakpoint, and send `SIGKILL` to that exact suspended PID. A
fresh read-only instrumentation invocation then verifies:

- before move: exact old file;
- after move/before directory fsync: exact old or exact candidate only;
- after directory fsync: exact candidate;
- every case: complete parse, no torn or third state, unchanged non-target wire
  slices, and no launch/read cleanup or recovery.

The ordinary JavaScript bridge discovery, applied write, accepted-reader result, and
exact no-op remain a separate normally passing instrumentation test.

## Source correction

Remove the production `Checkpoint`, `Stage`, `fire`, and callback seam. Retain only
the package-private `AtomicIo` fault seam needed by JVM tests. Release code must not
contain a pause, kill, callback, stage-selection, test-service, or debug-Application
mechanism.

Correction allowlist:

- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyMutationCoordinator.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyMutationCoordinatorTest.java`
- `android/app/src/androidTest/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterInstrumentedTest.java`
- `scripts/verify-android-legacy-theme-writer.mjs`
- `scripts/run-android-legacy-theme-writer-process-kill.mjs`

Every other current T014 candidate file is frozen during this correction. In
particular, no androidTest manifest, process-kill service, Gradle/dependency, target
debug component, reader, UI, generated asset, Kotlin-reference, signing, physical
device, or Play file is allowed.

## Release exclusion gate

An unsigned release build must prove that its merged manifest has no instrumentation,
crash service, `android:process`, or debug Application, and that release dex contains
no coordinator checkpoint/stage seam, process-kill API, or test harness class. No
signing values or credentials are accessed.

## Stop conditions

Stop and return to Judge if any breakpoint is ambiguous, missing from the compiled
line table, hit on the wrong side of the operation, or cannot identify the exact
target PID; if the serial is not a disposable emulator; if any result is torn or
changes unrelated raw slices; if a debug target service/Application, Orchestrator,
custom runner, Gradle edit, dependency, release seam, or physical device is needed;
if verification performs recovery before inspection; or if the same unexplained
JDWP/control failure repeats twice.

This correction is within the already approved owner charter for autonomous local
migration implementation and disposable-emulator testing. It grants no new signing,
Play, physical-device, UI, or Kotlin-reference authority.

`FULL_OUTCOME_COMPLETE: false`

`PRODUCTION_RELEASE_READY: NO`
