# T038 Opaque Legacy Open Acceptance

Result: **ACCEPT**  
Evidence scope: **LOCAL_JVM_AND_DISPOSABLE_EMULATOR_ONLY**  
Production release ready: **NO**

## Accepted boundary

- `OPAQUE_REF_ONLY: PASS`
- `STRICT_BOUNDED_REPARSE: PASS`
- `NOFOLLOW_IDENTITY_REVALIDATION: PASS`
- `MAXIMUM_CHUNK_524288: PASS`
- `COLLECTION_READ: REJECTED`
- `NO_MUTATION: PASS_EMULATOR`
- `NO_ACTIVATION: PASS`
- `REAL_LEGACY_CORPUS: NOT_CHECKED`
- `PHYSICAL_DEVICE: NOT_CHECKED`
- `RUNTIME_PLUGIN_DISCOVERY: NOT_APPLICABLE_NOT_REGISTERED`

The public resolver derives the app-private legacy root from Android `Context` and accepts only canonical `a1_<positive-safe-integer>` authority. Raw paths, filenames, URIs, provider addresses, noncanonical refs, unsafe offsets, and chunks above 524,288 bytes are rejected.

Every chunk request reparses the committed index under strict UTF-8 and JSON handling, exact schema and numeric rules, address and basename rejection, a 4 MiB byte ceiling, a 10,000-record ceiling, and a 64-level nesting ceiling. It touches only the selected direct-child file and never traverses unrelated collection trees.

The selected file is canonically contained with no-follow checks. File identity is captured after resolution and revalidated before open, after open, and after read. Tests reject atomic replacement both before channel open and after channel open without returning bytes. Chunk results expose only defensively copied bytes, next offset, and EOF state. Collections remain a separate explicit unsupported outcome.

No repair, pruning, migration, cleanup, timestamp write, index rewrite, registration, plugin, manifest, frontend, dependency, or Kotlin-reference change occurred.

## Verification

- Focused resolver/reader JVM tests: 10/10 PASS.
- Full Android JVM tests: 98/98 PASS.
- Exact-class disposable API 36 emulator instrumentation: 1/1 PASS.
- Recursive no-follow before/after manifest of types, sizes, content hashes, and symlink targets: identical after successful and refused reads.
- Full JDK 21 unit/lint/debug/unsigned-release/Android-test gate: 267/267 tasks rerun and PASS.
- Offline, packaged-asset, WebView, host, release-security, legacy-inspector, legacy-writer, and catalogue verifiers: PASS.
- Final debug and Android-test artifacts were installed only on the disposable emulator. It was then stopped; the connected OnePlus was never targeted.
- Independent Sol Judge: **ACCEPT**.

## Accepted hashes

- `LegacyDocumentOpenResolver.java`: `9ad8e972d8eb7a6537ac05ad4a650b94848887ceb45ceaeaca9c354d3528b5d1`
- `BoundedDocumentReader.java`: `a17bc32bbb030994fc2e6468a045bd23053b0e5060340f59fd8a25948da3a1e4`
- `LegacyDocumentOpenResolverTest.java`: `57888adb635fa1b623bda802e74cb71c0bbf58ac5d8858ab33b083488c922427`
- `BoundedDocumentReaderTest.java`: `ca2c7c44b2bad374bbe44cd4d1b36339c441d754ccc1b1482a479b25fca28187`
- `LegacyDocumentOpenResolverInstrumentedTest.java`: `7ab88dd195f5abbb304aa9991b83fae9629e17777d2e648df91298a288609a78`
- Debug APK: `7e8a213e416ddbe91c7b1277855bcba9047b928e20140f94627d1e4b2c364030`
- Unsigned release APK: `c4d4606e811282201a13279d00be30116c3feb034ad5ddea17bf9100c16c5fc6`
- Android-test APK: `2886a18cc5ab544bcd217093174be5b1ba5d86ccd2550d966fa26c0123cc8d0a`

Real predecessor data, physical-device filesystems, plugin discovery or bridge calls, signing, Play, genuine upgrades, and production behavior remain unverified.
