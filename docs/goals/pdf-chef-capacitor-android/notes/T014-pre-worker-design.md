# T014 Pre-Worker Design: First Sole-Writer Slice

## Judge Verdict

`ACCEPT setThemeMode only.` The first mutation slice is exactly one explicit operation:

```text
AndroidLegacySettingsWriter.setThemeMode({ mode })
```

where `mode` is exactly `SYSTEM`, `DYNAMIC`, `LIGHT`, or `DARK`.

This is the smallest operation that proves Application ownership, process-wide serialization, raw legacy-byte preservation, durable atomic replacement, idempotency, and JavaScript-to-native mutation dispatch without touching document bytes or the history index. It does not activate React or replace the accepted read plugin.

`rename-by-ref` is rejected for the first slice. It must atomically coordinate a document or directory rename with an index rewrite, collision handling, opaque-ref re-resolution, rollback, and a durable intent journal. That crash state is materially larger than a one-file settings update.

## Authority and Evidence Boundary

The Kotlin project at `/Users/dhananjaybhosale/AndroidStudioProjects/PDFTools` remains read-only. References below use paths relative to its `app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/` directory.

The accepted T012 contracts, T013 readers, T016 read client, and T021 runtime test remain authoritative and frozen. This design authorizes neither UI activation nor a broad T014 worker.

The existing `androidx.datastore:datastore-preferences-proto:1.2.1` dependency already brings the shaded `androidx.datastore.preferences.protobuf` runtime. Its `CodedInputStream` exposes byte-array construction, `getTotalBytesRead()`, raw reads, and raw skips; `CodedOutputStream` can encode only the new wrapper bytes. No dependency or Gradle change is required. `PreferencesProto.PreferenceMap.PREFERENCES_FIELD_NUMBER` is `1`; the `Value` string field is `5`.

## Kotlin Mutation Inventory

### History and saved-output mutations

| Entry point | Exact reference | Current behavior and why it is not first |
|---|---|---|
| Repository construction and lock | `data/repository/OfflinePdfRepository.kt:53-64` | Each repository instance owns its own `Mutex`; separate instances are not a process-wide sole writer. |
| Tool completion | `OfflinePdfRepository.kt:89-173`, `780-801` | Creates output bytes, assigns an ID, writes the index, and may delete the output on failure. |
| Smart Forms import | `OfflinePdfRepository.kt:280-335`, especially `316` | Imports/moves document bytes and commits a history entry. |
| Rename | `OfflinePdfRepository.kt:362-429` | Renames document bytes first, rewrites the index, then attempts an in-memory rollback if index persistence fails. |
| Single delete | `OfflinePdfRepository.kt:431-453` | Deletes bytes before rewriting the index. |
| Begin/undo deletion | `OfflinePdfRepository.kt:455-491` | Mutates only in-memory visibility; the later commit owns disk deletion. |
| Commit pending deletion | `OfflinePdfRepository.kt:493-514` | Deletes bytes, reinserts failures, and rewrites the index. |
| Batch delete | `OfflinePdfRepository.kt:516-580` | Deletes multiple outputs and performs one shortened-index write. |
| Clear history | `OfflinePdfRepository.kt:593-606` | Recursively deletes every output and writes an empty index. |
| Load/orphan reconciliation | `OfflinePdfRepository.kt:732-778` | Loading can trigger an orphan sweep; this read-triggered deletion must not be carried into the Capacitor compatibility layer. |
| Index load | `data/repository/ProcessedHistoryIndex.kt:53-77` | A read deletes entries beyond 300 from disk. T013 deliberately does not call it. |
| Index save | `ProcessedHistoryIndex.kt:86-98` | Writes a temp file, renames it, then falls back to a direct authoritative overwrite; that fallback is forbidden here. |
| Index commit/cap | `ProcessedHistoryIndex.kt:106-117` | Deletes dropped document bytes and saves the shortened index. |
| Recursive deletion helper | `ProcessedHistoryIndex.kt:241-245` | Deletes files or directory trees. |
| Public mutation surface | `data/repository/PdfRepository.kt:20-70` | Adds/processes, renames, deletes, undo-commits, and clears history. |
| UI callers | `ui/app/PdfToolsViewModel.kt:616-681`, `684-732`, `793-808` | Share-as/rename, delete, and clear are explicit UI operations but remain outside this slice. |

History conclusion: every durable history candidate spans more state than one settings file. Rename, delete, clear, add-output, cap pruning, orphan sweeping, and pending-delete commit all remain blocked.

### Settings mutations

| Entry point | Exact reference | Current behavior |
|---|---|---|
| Activity ownership | `MainActivity.kt:34-46` | Activity-lazy repository instances, not Application-owned coordination. |
| Settings contract | `data/settings/SettingsRepository.kt:24-36` | Theme, privacy index, font, onboarding, usage, savings, and tool-option mutations. |
| DataStore binding | `data/settings/OfflineSettingsRepository.kt:19-23` | Binds `app_settings` through the DataStore delegate. |
| Theme | `OfflineSettingsRepository.kt:77-81` | Writes `theme_mode`. This is the accepted first operation. |
| Privacy line | `OfflineSettingsRepository.kt:83-87` | Writes an integer; called automatically during ViewModel initialization at `PdfToolsViewModel.kt:294-299`, so it is not an explicit first mutation. |
| Font | `OfflineSettingsRepository.kt:89-93` | Explicit scalar setting, but adds no proof beyond theme and therefore waits. |
| Tool usage | `OfflineSettingsRepository.kt:105-110` | Read-modify-writes encoded JSON. Caller at `PdfToolsViewModel.kt:130-154`. |
| Savings | `OfflineSettingsRepository.kt:122-127` | Read-modify-writes encoded JSON. Caller at `PdfToolsViewModel.kt:143-148`. |
| Tool options | `OfflineSettingsRepository.kt:139-144` | Read-modify-writes encoded JSON. Caller at `PdfToolsViewModel.kt:149-153`. |
| Onboarding | `OfflineSettingsRepository.kt:146-150` | Explicit boolean write, but waits behind the one-operation theme proof. |
| Theme UI caller | `PdfToolsViewModel.kt:858-865` | Explicit user selection. |
| Other UI callers | `PdfToolsViewModel.kt:868-885` | Font and onboarding writes remain out of scope. |
| Closed theme enum | `data/model/AppThemeMode.kt:3-8` | Authoritative values are `SYSTEM`, `DYNAMIC`, `LIGHT`, and `DARK`. |

Settings conclusion: `setThemeMode` has a closed scalar input, one target key, and an existing explicit user action. It is the lowest-blast-radius proof.

## Accepted and Rejected Candidates

Accepted:

- Exactly one `setThemeMode` bridge method.
- Missing or zero-byte settings stores may become a canonical map containing only `theme_mode`; this is an explicit user mutation, not read-time repair.
- A valid existing store is patched at raw protobuf wire-slice level.
- A same-value call is a byte- and mtime-preserving no-op.

Rejected for this slice:

- Rename-by-ref, delete, clear, add-output, cap pruning, orphan cleanup, or any document-byte operation.
- `setAppFontOption`, onboarding, privacy-line rotation, usage/savings/tool-option updates, generic settings patches, reset, or clear.
- DataStore construction/editing, `PreferenceMap` builders, or parse-and-reserialize of the full settings map.
- A new protobuf dependency, Kotlin plugin, coroutine runtime, dynamic version, or Gradle change.
- Direct authoritative overwrite, copy fallback, non-atomic move fallback, backup-file swap, or downgrade-as-rollback.
- Any launch-, list-, read-, Application-start-, or process-restart-triggered write, repair, temp cleanup, or recovery.
- Any change to T013 inspector/reader source, tests, verifier, T012 contracts, or T016 client.

## Application Ownership and Single-Process Invariant

Add a host `PdfChefApplication` and declare it in the production manifest. Its construction/onCreate path may allocate only one `LegacyMutationCoordinator`; it must not inspect, create, delete, repair, or fsync legacy storage.

The invariant is:

```text
one Android application process
  -> one PdfChefApplication instance
  -> one LegacyMutationCoordinator instance
  -> one interruptible process-wide mutation lock
  -> every current and future legacy writer
```

The writer plugin obtains the coordinator only by casting `getContext().getApplicationContext()` to `PdfChefApplication`. It must not construct a coordinator, own a plugin-instance lock, expose a static fallback, or instantiate DataStore. Separate plugin instances therefore converge on the same coordinator.

The production manifest must contain no `android:process`. Adding a production secondary process invalidates this design and requires an OS file-lock/cross-process protocol before writing. Test-only process-kill components may use an androidTest-only process and never merge into release.

Register the additive `AndroidLegacySettingsWriter` plugin in `MainActivity` before `super.onCreate`. The existing `AndroidLegacyInspector` registration and all reader classes stay unchanged.

## Exact Bridge Contract

Plugin: `AndroidLegacySettingsWriter`

Method: exactly one `@PluginMethod public void setThemeMode(PluginCall call)`

Accepted input has exactly one own field:

```json
{ "mode": "SYSTEM" | "DYNAMIC" | "LIGHT" | "DARK" }
```

Null, missing, non-string, lowercase, whitespace-padded, unknown mode, inherited/extra field, or an input containing address/payload fields is rejected. No coercion or trimming is allowed.

Successful output has exactly two fields:

```json
{ "mode": "DYNAMIC", "changed": true }
```

`changed=false` means the effective stored string already matched and no temp file, authoritative replace, mtime change, or cleanup occurred. Output never contains a path, filename, raw preference bytes, document bytes, exception text, or filesystem state.

Stable generic rejection codes:

| Code | Meaning |
|---|---|
| `LEGACY_THEME_INVALID_ARGUMENT` | Input is not the exact one-field enum object. |
| `LEGACY_SETTINGS_UNSAFE_PATH` | Wrong node type, symlink/ancestor link, containment failure, or identity change. |
| `LEGACY_SETTINGS_CORRUPT` | Non-empty protobuf is malformed, ambiguous beyond safe raw scanning, or fails post-patch parse verification. |
| `LEGACY_SETTINGS_TOO_LARGE` | Input, entry count, nesting, or output ceiling is exceeded. |
| `LEGACY_SETTINGS_CONCURRENT_MODIFICATION` | Source identity/bytes changed between read and linearization despite the process invariant. |
| `LEGACY_THEME_ATOMIC_MOVE_UNAVAILABLE` | Same-directory atomic replacement is unsupported; there is no fallback. |
| `LEGACY_THEME_CANCELLED` | Interrupted before linearization; the authoritative source is unchanged. |
| `LEGACY_THEME_WRITE_FAILED` | Failure occurred before atomic replacement; the authoritative source is unchanged. |
| `LEGACY_THEME_DURABILITY_UNCERTAIN` | Atomic replacement occurred but directory fsync failed; the new value is currently visible but crash durability is unknown. |

Messages are fixed and generic. Unexpected exceptions map to the applicable generic code without `getMessage`, cause text, path, or stack logging.

## Raw PreferencesProto Patch

Bounds match the accepted reader unless a later Judge narrows them: at most 1 MiB input, 1,000 map entries, finite recursion, strict complete consumption, and a small fixed output-growth allowance sufficient for one theme entry. Crossing any bound is a refusal, never truncation.

The patcher must not build or serialize a whole `PreferenceMap`. It operates as follows:

1. Read the authoritative file once through a no-follow descriptor under the coordinator lock. Missing and zero-byte inputs are valid empty maps; non-empty malformed input is `CORRUPT`.
2. Scan the top-level protobuf with shaded `CodedInputStream.newInstance(byte[])`. Record `[start,end)` from `getTotalBytesRead()` for every complete field.
3. Preserve every top-level raw slice, including unknown fields and non-preferences fields, in original byte order.
4. For each field-1 length-delimited map entry, scan its raw payload. Apply standard map-entry semantics: effective key is the last valid field-1 string; value is field 2. Preserve duplicate keys, duplicate fields, unknown tags, unknown future values, field order, and noncanonical-but-valid encodings as raw bytes.
5. Select only the last map entry whose effective key is exactly `theme_mode`, because that is the effective map value. Earlier duplicate target entries remain byte-identical.
6. Determine the effective current value without reserialization. If it is a string exactly equal to the requested mode, return the original byte array as a no-op.
7. If the target entry exists and needs change, rebuild only its enclosing length wrappers: retain its entire original entry payload byte-for-byte and append a canonical field-2 `Value` message whose final oneof member is field-5 string with the requested mode. The appended value wins while all prior target and unknown bytes survive.
8. If no target entry exists, append one canonical field-1 map entry after the complete original byte array. Every original byte therefore remains identical.
9. Concatenate untouched top-level slices exactly. Re-encoding is limited to the changed target entry's length prefixes and the appended canonical theme bytes.
10. Parse the candidate once with `PreferencesProto.PreferenceMap.parseFrom` for verification only. Require effective `theme_mode` ValueCase `STRING`, exact requested value, complete consumption, and preservation digests for every untouched slice. Never serialize that parsed object.

Any scan ambiguity, invalid tag/wire type, truncated length, malformed UTF-8 key, group, recursion overflow, or trailing partial field rejects the mutation without replacing the source.

## Filesystem and Path Rules

Authoritative path: `filesDir/datastore/app_settings.preferences_pb`.

- `filesDir` must be an existing real directory.
- `datastore` must be a direct canonical child. If absent, the explicit mutation may create exactly this directory, then fsync `filesDir`; if present it must be a readable/writable real directory.
- The authoritative file, datastore directory, every ancestor through filesDir, and the temp path must be checked with `NOFOLLOW_LINKS`; any symlink, wrong type, root escape, or canonical mismatch is refused.
- An existing source must be a regular file. A missing source may be created only through the atomic temp path.
- Read and pre-move checks record file key where available, size, mtime, and SHA-256. Immediately before replacement, require the same identity and bytes; if initially absent, require it remains absent.
- Temp files live in `datastore`, use a coordinator-owned exact prefix, are opened with create-new/no-follow semantics, and are tracked by this call.
- Cleanup may remove only the current call's tracked temp before linearization. It must never delete the authoritative file or scan unrelated temp files.

## Atomic State Machine and Linearization

1. `LOCK`: acquire the Application coordinator lock interruptibly.
2. `VALIDATE`: resolve and validate nodes/ancestors without following links.
3. `READ`: bounded-read the current bytes and capture source identity.
4. `PATCH`: produce and verify the candidate. If byte-identical/effective-equal, return `changed=false` with no filesystem mutation.
5. `TEMP_CREATE`: create one same-directory tracked temp.
6. `TEMP_WRITE`: write the full candidate; partial writes affect only temp.
7. `TEMP_FSYNC`: fsync the temp descriptor and close it.
8. `REVALIDATE`: recheck parent, destination identity, and original SHA-256.
9. `ATOMIC_REPLACE`: `Files.move(temp, source, ATOMIC_MOVE, REPLACE_EXISTING)`. This is the linearization point. `AtomicMoveNotSupportedException` is a hard failure; no direct/copy/non-atomic fallback exists.
10. `DIRECTORY_FSYNC`: fsync `datastore` so the rename is durable.
11. `RESOLVE`: only now return `{mode, changed:true}` and release the lock.

Crash outcomes:

| Crash/failure point | Permitted authoritative state |
|---|---|
| Before `ATOMIC_REPLACE` | Original complete file or missing source; a tracked temp may remain. |
| During atomic replacement | Complete old or complete new file; never torn content. |
| After replace, before directory fsync | New file is visible; after power loss old or new may survive. Report durability uncertain if execution continues and fsync fails. |
| After directory fsync | Complete new file is durable. |

No intent journal is needed for this single-resource atomic replacement. No Application launch, reader call, or process restart inspects or removes stale temp files. A later explicit mutation may refuse or safely replace only the coordinator-owned fixed temp after validating it; it must not perform a general cleanup sweep.

Rollback compatibility means the Kotlin predecessor can parse the resulting PreferencesProto and sees the requested theme while every unrelated raw field remains. Rollback operationally is halt plus a higher-version forward fix, never Play downgrade.

## Cancellation and Idempotency

- Before linearization, thread interruption/cancellation deletes only this call's tracked temp where possible and returns `LEGACY_THEME_CANCELLED`; authoritative bytes remain unchanged.
- Capacitor caller abandonment or Activity destruction does not cancel a mutation after it has started. The Application-owned coordinator completes independently of the plugin instance.
- At or after atomic replacement, cancellation is deferred until directory fsync and result classification. Never move the old file back.
- A retry with the same mode is an exact no-op once the new source is visible.
- Concurrent calls serialize. Two identical calls produce one change followed by one no-op. Different calls linearize in lock order; each successful response names the value it wrote.
- Missing source and zero-byte source become a valid one-key map only in response to this explicit method.

## Required Verification Matrix

### Focused JVM tests

- All four accepted modes and every invalid input form, including extra fields.
- Missing, zero-byte, valid existing, malformed, truncated, exact byte/input/output bounds, and 1,000/1,001 entry cases.
- Theme absent, present same-value no-op, present changed, wrong ValueCase, duplicate theme entries, duplicate non-target entries, duplicate key/value fields, unknown top-level fields, unknown map-entry fields, unknown Value fields, future Value cases, reordered fields, and valid noncanonical encodings.
- For every successful changed case, prove byte-for-byte preservation and ordering of every non-target raw slice. For no-op, prove full-file SHA-256, bytes, size, and mtime unchanged and prove no temp was created.
- Existing/missing datastore, wrong types, dangling and resolving symlinks at every level, canonical escape, unreadable nodes, and source identity change before move.
- Inject failures at temp create, each partial-write boundary, temp fsync, pre-move revalidation, atomic move unsupported, atomic move failure, and directory fsync.
- Assert old/missing authoritative state before linearization, complete new visibility after linearization, stable uncertainty classification after directory-fsync failure, and no direct fallback.
- Interrupt before lock, after read, during temp write, before move, and after move.
- Two coordinator clients and multiple plugin instances must share one Application coordinator; concurrent same/different mode calls must match lock order.
- Reflection/static checks: exactly one writer plugin method, no mutation method on the inspector, no DataStore/builder/whole-map serialization, no exception/path logging, and no Application-start I/O.

### Disposable-emulator instrumentation

- Fresh debug package only; refuse any pre-existing unowned settings/index/output state.
- JavaScript `Capacitor.isPluginAvailable('AndroidLegacySettingsWriter')` and exact `setThemeMode` calls for applied and no-op results.
- Seed a synthetic raw store with unknown top-level, map-entry, Value, duplicate, and noncanonical slices; verify the effective theme through both the writer response and accepted T013 `readSettings` while comparing raw preservation digests.
- Verify Application identity: two plugin instances resolve the same coordinator.
- Test-only remote service/process fault harness, declared only in `src/androidTest/AndroidManifest.xml`, signals checkpoints then kills its own process. Required checkpoints: before atomic move, immediately after atomic move/before directory fsync, and after directory fsync.
- After each kill and cold restart: before-move is old; between move/fsync is complete old or new; after fsync is new; no state is torn; launch/read performs no recovery or cleanup.
- Run only with explicit emulator serial. Physical devices and production package data are forbidden.

### Commands for the future Worker receipt

```text
node scripts/generate-android-legacy-contract-fixtures.mjs --check
node scripts/verify-android-legacy-inspector.mjs
node scripts/verify-android-legacy-theme-writer.mjs
node --test tests/platform/androidLegacyCompatibilityContracts.test.ts tests/platform/androidLegacyInspector.test.ts
env JAVA_HOME=/Users/dhananjaybhosale/.local/share/pdf-chef/toolchains/temurin-21/Contents/Home android/gradlew -p android --no-daemon --rerun-tasks :app:testDebugUnitTest --tests 'com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.*'
env JAVA_HOME=/Users/dhananjaybhosale/.local/share/pdf-chef/toolchains/temurin-21/Contents/Home android/gradlew -p android --no-daemon :app:compileDebugJavaWithJavac :app:compileDebugAndroidTestJavaWithJavac :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest
node scripts/verify-android-host-skeleton.mjs
cmp -s dist/index.html android/app/src/main/assets/public/index.html
ANDROID_SERIAL=<disposable-emulator> env JAVA_HOME=/Users/dhananjaybhosale/.local/share/pdf-chef/toolchains/temurin-21/Contents/Home android/gradlew -p android --no-daemon :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.AndroidLegacySettingsWriterInstrumentedTest
```

The receipt must also record exact source/test/APK hashes, debug application ID, dex presence, test counts, zero skips, and process-kill outcomes. Recompute and compare the frozen T012/T013/T016/T021 hashes.

## Exact Future Worker Allowlist

No implementation is authorized until a PM installs this exact bounded task. Its maximum source allowlist is:

- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/PdfChefApplication.java`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyMutationCoordinator.java`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyThemeModeWirePatcher.java`
- `android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterPlugin.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyMutationCoordinatorTest.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyThemeModeWirePatcherTest.java`
- `android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterContractTest.java`
- `android/app/src/androidTest/AndroidManifest.xml`
- `android/app/src/androidTest/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterInstrumentedTest.java`
- `android/app/src/androidTest/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/ThemeWriterProcessKillService.java`
- `scripts/verify-android-legacy-theme-writer.mjs`

`android/app/build.gradle`, T013 reader/plugin files, T013 tests/verifier, TypeScript, React, CSS, assets, Kotlin-reference files, signing, and Play files are explicitly outside the allowlist.

## Worker Stop Conditions

Stop and return to Judge if any of the following is true:

- Raw non-target bytes, unknown fields, duplicates, or valid noncanonical encodings cannot be preserved exactly.
- A full-map builder, DataStore edit, whole-map parse/serialize, new dependency, or Gradle change is required.
- Application construction/onCreate, read/list, process restart, or plugin registration must touch legacy storage.
- Atomic same-directory replacement or directory fsync is unavailable; do not add a fallback.
- Any failure before linearization can alter the authoritative source, or any observed state can be torn.
- A second coordinator/lock, production secondary process, direct overwrite, backup swap, copy fallback, generic temp sweep, or launch recovery appears.
- Any operation beyond `setThemeMode` or any UI/React activation is proposed.
- Any T013 reader, T012/T016 contract, Kotlin reference, document byte, history index, signing configuration, device data, or Play state must change.
- Focused preservation/fault tests cannot make every crash point deterministic, or the same unexplained verification failure repeats twice.

## Limits and Completion Boundary

- Kotlin reference: read-only.
- React/UI/Tools-page work: excluded and remains Claude Code Opus 5 High-owned after its separate session reset.
- Physical device, genuine upgrade, signing, performance, Play internal, rollout, and production: `NOT CHECKED`.
- This note approves only a future settings-theme worker scope. It does not mark T014 implemented or the full goal complete.
- `PRODUCTION_RELEASE_READY: NO`.

