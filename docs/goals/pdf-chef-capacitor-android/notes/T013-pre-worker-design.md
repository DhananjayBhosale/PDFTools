# T013 Pre-Worker Design

## Pre-Scope Hashes

- `android/app/build.gradle`: `af60b8cd7bb0436a3f337673578fbf881409cd2ab2e2020f446f17ee90dff55f`
- `MainActivity.java`: `6fddc7d74185f8a259b143473925d350ff54ae933ff9b957ebe3bb16b6090238`
- Inspector, legacy-reader tests, and verifier paths: absent.

## Binding Dependency Decision

- Runtime `androidx.datastore:datastore-preferences-proto:1.2.1` for direct read-only protobuf parsing.
- Runtime `com.google.code.gson:gson:2.13.2` for strict bounded JSON parsing.
- No Kotlin plugin, coroutines, DataStore runtime/writer, migration, or test-only org.json dependency.

Gson must use `JsonReader` with explicit strictness, one complete value, finite nesting, full-document consumption, and explicit field/type validation. It must not reflectively deserialize untrusted DTOs or reserialize encoded settings.

## History Decisions

- Independent reader only; never call destructive legacy `ProcessedHistoryIndex.load()`.
- Missing/blank/corrupt/partial-invalid remain distinct.
- Parse all bounded source records, reject duplicate opaque IDs, sort newest-first stably, and return at most 300 without pruning.
- Exact raw schema; only documented missing `mimeType` and `itemCount` compatibility exceptions.
- Missing outputs remain valid with `available=false`.
- Containment uses one basename, strict canonical child checks, and rejects symlink roots/outputs.
- If a legacy collection lacks `itemCount`, perform bounded no-symlink traversal. Empty or missing collections use conservative `1`; traversal failure/bounds invalidate only that record.
- Never read document contents or inspect a collection when a positive stored count exists.

## Settings Decisions

- Read `filesDir/datastore/app_settings.preferences_pb` directly with `PreferencesProto`; never instantiate DataStore.
- Expose only seven accepted keys and never inject defaults.
- Unknown keys are ignored, not counted invalid, not emitted, and never changed.
- Known wrong types/shapes count toward `partial_invalid`.
- Preserve valid encoded strings byte-for-byte after strict validation.

## Plugin and Evidence Boundary

- Register exactly `AndroidLegacyInspector` before `super.onCreate()`.
- Exactly two plugin methods: `readHistory` and `readSettings`.
- Capacitor dispatches bridge plugin calls on its plugin handler thread; constructors/load methods do no I/O.
- Unexpected errors use fixed generic messages/codes without exception text or addresses.
- Runtime positive plugin discovery is `NOT CHECKED`; source order, reflection, compile, and APK presence are not runtime proof.

