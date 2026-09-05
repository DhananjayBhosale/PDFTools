# T013 First Worker Audit

## Verdict

`NEEDS_CORRECTION`. Keep T013 active. The first implementation is directionally read-only and its pinned dependencies and registration are correct, but it does not yet prove or reliably implement the accepted T012 wire and preservation contracts.

## Accepted

- `androidx.datastore:datastore-preferences-proto:1.2.1` and `com.google.code.gson:gson:2.13.2` are pinned within the approved dependency boundary.
- `AndroidLegacyInspector` is registered before `super.onCreate()` and exposes only `readHistory` and `readSettings` as Capacitor methods.
- Settings read the intended `filesDir/datastore/app_settings.preferences_pb` protobuf directly; unknown outer keys are ignored.
- Production sources contain no explicit data write, delete, migration, repair, logging, or raw exception leakage.
- T012 and T016 accepted artifacts remain unchanged.

## Blocking Findings

- `unitTests.returnDefaultValues = true` masks Android `org.json`/`JSObject` behavior. The shallow JVM tests do not prove any emitted payload.
- A history schema error can leave the streaming reader inside a record; the recovery skip can consume the wrong value or collapse a recoverable record into whole-store `corrupt`.
- Containment, symlink, and collection-count failures happen outside per-record recovery, so one bad record can collapse the whole store.
- File entries replace stored `sizeBytes` with current file length and erase it when the output is missing.
- Equal-timestamp history ordering uses ID instead of source encounter order.
- Address-like display/tool metadata can cross the bridge before the frozen TypeScript decoder rejects it.
- Duplicate IDs, strict numeric tokens, complete bounded parsing, finite nesting, canonical ancestor containment, and exact-limit EOF behavior are incomplete.
- Unexpected plugin/programming failures resolve fabricated `corrupt` snapshots instead of rejecting with fixed generic codes.
- History and settings tests lack the required semantic matrix and recursive before/after no-mutation snapshots.

## Binding Correction

The correction remains inside the same nine-file T013 allowlist:

- Remove `unitTests.returnDefaultValues`; do not add an `org.json` JVM dependency.
- Make both inspectors pure Gson/PreferencesProto code that returns Gson JSON models. Convert the internally generated JSON to `JSObject` only in the plugin.
- Keep strict, finite, bounded parsing. Consume a complete history element before schema validation and recover invalid records independently.
- Validate every source record before sorting/capping; invalidate every record whose ID is duplicated; preserve source order for equal timestamps.
- Preserve stored `sizeBytes` even when output is unavailable. Use output state only for `available`.
- Apply the frozen T012 address-like metadata boundary before bridge conversion.
- Preserve the bound missing-collection-count behavior: stored positive count wins; otherwise bounded no-symlink traversal is used, with conservative `1` for empty or missing collections; traversal failure or a bound violation invalidates only that record.
- Reject unexpected plugin failures with stable generic codes and no exception/path details.
- Add substantive history/settings/contract tests with full-tree relative path, no-follow type, symlink target, size, mtime, and SHA-256 snapshots before and after repeated reads.
- Strengthen the static verifier to freeze accepted T012/T016/fixture hashes, forbid writers and masking options, and require the exact registration, strictness, bounds, error, and test markers.

## Evidence Boundary

- Compile/test/static passes from the first worker are non-decisive because behavior tests were masked and incomplete.
- Runtime Capacitor plugin discovery and off-main execution: `NOT CHECKED`.
- APK identity, install, genuine update, signing, device, performance, and Play behavior for T013: `NOT CHECKED`.
- `PRODUCTION_RELEASE_READY: NO`.
