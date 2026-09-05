# T020 First-Slice Audit

## Verdict

T010 is source-accepted but remains blocked at artifact level. The current authored host satisfies the corrected static contract, but Gradle compilation, Android lint, unit tests, APK assembly, packaged application ID, instrumentation, installation, runtime behavior, compatibility, performance, signing, and upgrade safety remain unverified.

The next safe independent slice is T012: additive TypeScript contracts and deterministic synthetic fixtures only. T011 remains blocked because no eligible predecessor/candidate artifact pair exists. T013 must not start until T012 passes and exact-wrapper Gradle verification is available.

## Accepted

- Capacitor packages are pinned to 8.5.0.
- The base application ID, debug suffix, legacy namespace/MainActivity, SDK levels, and Java 21 source contract are represented.
- Bundled assets, empty Cordova origins, backup/cleartext hardening, and exact data exclusions are present.
- No INTERNET permission, provider, file-scheme VIEW handling, native data bridge, processor, signing, credential, or Play work was added.
- The static verifier is structured and the recorded key-file hashes match current source.

## Modified

- T010 is an accepted source checkpoint, not a completed Android artifact checkpoint.
- T011 is temporarily bypassed because its measurements require eligible artifacts and hardware.
- T012 may proceed because it is schema-only, synthetic, and independent of Android build/runtime availability.

## Rejected

- Treating Vite build, Capacitor sync, or static checks as proof that Android compiles, lints, assembles, installs, or has the expected packaged ID.
- Starting native T013 before T012 contracts pass and Gradle verification is available.
- Any React activation, Kotlin-reference edit, signing action, device install, or Play action in T012.

## T012 Contract Boundary

- Add `StoredCollection` and a closed discriminated `StoredWorkspaceItem` file-or-collection wrapper without reinterpreting `StoredDocument`.
- Represent history/settings health exactly as `ok`, `missing`, `blank`, `corrupt`, and `partial_invalid`.
- Preserve partial valid records and expose source/returned counts plus non-destructive truncation.
- Use only stable synthetic opaque refs shaped `a1_<positive base-10 legacy id>`; never encode a path or filename.
- Expose sanitized metadata only. Reject stored filenames, paths, URIs, provider addresses, preference bytes, document bytes, and nested address fields.
- Expose a read-only capability descriptor. T012 defines no mutation, migration, cleanup, prune, repair, clear, copy, or writer API.
- Collections never acquire a MIME type, byte stream, implicit ZIP, flattened representation, or duplicate store.

## Evidence Boundary

- Source/static checkpoint: PASS.
- Gradle compile/test/lint/assemble: BLOCKED by uncached Gradle 8.14.3 distribution timeout.
- APK application ID: NOT CHECKED because no APK exists.
- Production release readiness: NO.

