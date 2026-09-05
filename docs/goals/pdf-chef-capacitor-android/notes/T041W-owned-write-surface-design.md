# T041W Owned Write Surface Design

Status: **ACCEPTED**  
Evidence scope: **SOURCE, FOCUSED TESTS, AND DISPOSABLE-EMULATOR BRIDGE PROOF**  
Production release ready: **NO**

## Decision

The next core slice after T041 is the owned-write expansion on the already registered `AndroidDocuments` plugin. It materially unlocks local input/output retention for shared PDF workflows and reuses the accepted Application-owned coordinator, bounded writer, atomic moves, fsync points, hashing, recovery, and opaque references. Metadata, storage statistics, haptics, picker, pending imports, export, and share remain separate tasks.

The public plugin surface becomes exactly five methods: the existing `readChunk`, plus `beginWrite`, `appendWrite`, `finishWrite`, and `abortWrite`. Registration, `MainActivity`, manifest, provider scope, shared frontend, and the read-only Kotlin reference remain unchanged.

## Wire contract

```text
beginWrite({displayName?: string, mimeType: SupportedOwnedMime})
  -> {sessionRef: w1_<22..64 URL-safe chars>, maximumChunkBytes: 524288}

appendWrite({sessionRef, data: canonical padded base64})
  -> {acceptedBytes: exact decoded byte count}

finishWrite({sessionRef})
  -> {item: {
       kind: "file", ref: d1_<22..64 URL-safe chars>,
       displayName: string|null, mimeType: SupportedOwnedMime,
       sizeBytes: positive safe integer, contentHash: lowercase SHA-256,
       createdAt: non-negative safe integer, available: true, pending: false
     }}

abortWrite({sessionRef}) -> {aborted: boolean}
```

MIME is required and exact. There is no default, extension inference, alias, or parameter acceptance. The owned-output allowlist covers PDF, ZIP, plain UTF-8 text, JPEG, PNG, WebP, HEIC, DOCX, and PPTX. It is a new policy and does not widen the frozen import/picker policy. Plain text is validated as well-formed UTF-8 without NUL during the existing bounded finish scan.

An optional display name is preserved exactly. It is bounded to 180 UTF-16 units and 720 UTF-8 bytes and rejects blank, NUL, slash, backslash, `.` and `..`. It is never trimmed or normalized.

## Durability and compatibility

Version-2 session, finish, and owned records carry nullable display-name metadata. Version-1 records continue to decode as `displayName: null`; reading them performs no rewrite, sweep, copy, or migration. Repeated `finishWrite` returns the same committed item. `abortWrite` returns true only when an uncommitted session was removed and false for already absent or committed sessions; corrupt or ambiguous state rejects.

All T039 limits and safety properties remain intact: 512 KiB canonical chunks, 128 MiB per file, four open sessions, 256 MiB aggregate open bytes, storage reserve, no-follow identity checks, checked arithmetic, bounded recovery, content hashing, atomic replacement, directory fsync, cancellation, and the single Application-owned coordinator.

## Verification boundary

Focused TypeScript and JVM checks precede one major-milestone JDK21 build. One disposable API-36 emulator batch proves create, chunked append, finish, repeated finish, read roundtrip/EOF, abort/repeated abort, strict rejection, and unchanged T040 legacy/WebView/provider behavior. No desktop UI testing is required. The emulator must be closed after the batch.

The existing plugin catalogue keeps the same three registrations and replaces only the one-method `AndroidDocuments` expectation with the exact five-method set. Final catalogue reconciliation waits for the active Claude-owned frontend handback; no in-flight frontend bytes may be restored or overwritten by this task.

## Acceptance receipt

The cross-task handoff was reconciled without overwriting shared work. Focused TypeScript tests passed 10/10; the documents, delivery, and plugin-catalogue verifiers passed; writer/coordinator/plugin JVM tests built successfully; repository TypeScript passed; and the exact bridge instrumentation passed 1/1 on a disposable API-36 emulator. That emulator was closed and the physical OnePlus was not touched.

Transferred exact hashes:

- `scripts/verify-android-document-delivery.mjs`: `c21f7fdfd099c0847214d0263681096c828fa7b0d7d1cbcef4a571a1e1cd3825`
- `scripts/verify-android-documents.mjs`: `89751437aa53d081af59493101599175412378a9f76177b41b0afbee47cc54e8`
- `AndroidDocumentsPluginInstrumentedTest.java`: `b67e814343fd374cbcc4cddc4f174a506e67f2ce31127de6ae8a5c7428610513`
