# T012 First Worker Audit

## Result

`NEEDS_CORRECTION`. The implementation stayed inside its source scope and all focused commands passed independently, but the contract does not yet satisfy the accepted file/collection, invalid-record, settings, or raw-fixture requirements.

## Independent Verification

- PASS: fixture generator `--check` reports 21 deterministic fixtures current.
- PASS: focused Node test selection, 41/41.
- PASS: `npm run lint`.
- FAIL: post-worker semantic Judge audit.

## Accepted Foundations

- Additive source direction without React/UI or native activation.
- Exact five health labels.
- Canonical `a1_<positive safe base-10 id>` opaque references.
- Explicitly read-only capability descriptor with no mutation API.
- Deterministic dependency-free fixture generator.
- Source edits confined to the T012 allowlist.

## Required Correction

- Make `StoredCollection` metadata-only: opaque ref, name, size bytes, retained time, and positive item count. Remove recursive child items.
- Make Android history a closed discriminated file-or-collection union.
- Add `invalidRecordCount`; keep invalid-record loss separate from non-destructive newest-300 truncation.
- Use only the seven known legacy settings keys and stored scalar types, with an explicit invalid-value count.
- Pass collection coercion and forbidden-field cases through an actual decoder.
- Add deterministic raw synthetic index fixtures for missing, blank, corrupt bytes, truncated JSON, temp interruption, traversal, missing output, directory output, and 0/1/50/300/301 records.
- Keep display names as sanitized metadata, but never expose raw stored filenames, paths, URIs, provider addresses, bookmarks, preference bytes, or document bytes.

T013 remains blocked until corrected T012 contracts are independently accepted and exact-wrapper Gradle compilation/testing is available.

## Second Audit: Raw-Fixture Correction Required

The corrected public contract and 43 focused checks passed, but the raw synthetic index fixtures used invented or incomplete fields. They must mirror the authoritative Kotlin record exactly: `id`, `displayName`, `toolName`, `sizeBytes`, `createdAtMillis`, `storedFileName`, `mimeType`, `isDirectory`, and `itemCount`.

- Directory state belongs in `isDirectory=true` plus positive `itemCount`; never `outputKind`.
- Missing-output availability belongs in a separate virtual-files manifest; never `outputExists` inside the index.
- Interrupted writes require distinct synthetic committed and `.tmp` contents/state.
- Valid raw JSON fixtures need exact-key/type tests, including explicit rejection of `toolId`, `outputKind`, and `outputExists`.
- Known encoded setting values need key-specific validation because remembered watermark text may legitimately contain punctuation or a URL.

T012 remains active for this final raw-fixture-only correction.

## Third Audit: Authoritative Settings Encoding Correction

The 42-file raw-record correction and 47 focused checks passed. The final Judge accepted history, raw-index, health, opaque-reference, collection, and read-only boundaries, but found the synthetic settings encodings still differed from the Kotlin authority:

- Theme modes are `SYSTEM`, `DYNAMIC`, `LIGHT`, and `DARK`; `DYNAMIC` must be accepted.
- `tool_usage_memory` encodes `{runs, followUps}` positive-count maps.
- `savings_tally` encodes `{bytesSaved, filesReduced}` non-negative integer totals.
- `tool_option_memory` encodes a map from `PdfTool` enum names to preserved string values.
- Validation must reject malformed key-specific JSON shapes while preserving each original encoded string byte-for-byte; it must not decode/re-encode or invent defaults.

T012 stays active for the settings-only T012-C3 pass.

## Fourth Audit: Nested Follow-Up Map

C3 correctly added `DYNAMIC`, authoritative SavingsTally and ToolOptionMemory shapes, and byte-preserving encoded values. The remaining defect is `ToolUsageMemory.followUps`: Kotlin encodes `previousTool -> nextTool -> positiveCount`, not a flat tool-count map. C4 is restricted to that validator, its valid fixture, one rejection fixture, and focused tests.

## Final C4 Acceptance

C4 now validates `runs` as tool-to-positive-count and `followUps` as previous-tool-to-next-tool-to-positive-count, rejects the prior flat form, permits empty maps, and preserves the original encoded settings string byte-for-byte.

Final T012 evidence:

- PASS: 45 deterministic fixtures current.
- PASS: 47/47 focused tests.
- PASS: TypeScript lint.
- PASS: final independent semantic and scope audit.
- Native implementation, real storage preservation, APK, runtime, upgrade, signing, device, performance, and Play behavior remain unverified.
