# T036 Owned Pending-Import Staging Acceptance

Result: **ACCEPT**  
Evidence scope: **LOCAL_TEST_ONLY**  
Production release ready: **NO**

## Accepted boundary

- `POLICY_MATRIX: PASS`
- `BOUNDED_OWNED_COPY: PASS`
- `ATOMIC_RECORD_PUBLICATION: PASS`
- `RESTART_IDEMPOTENCE: PASS`
- `NO_ACTIVATION: PASS`
- `ANDROID_RUNTIME_FILESYSTEM: NOT_CHECKED`

The inactive policy accepts only exact `VIEW`, `SEND`, and `SEND_MULTIPLE` semantics, non-BROWSABLE `content` inputs, the frozen six MIME types, valid read access, unique ordered sources, at most 100 items, at most 128 MiB per item, and at most 256 MiB aggregate. Copied bytes are independently size-, hash-, and signature-validated.

The store writes only beneath the supplied app-private files directory. Its durability order is complete bounded copy, data-file force, atomic data publication, data-directory force, forced bounded record temp, atomic record publication, and records-directory force. A data-only interruption is revalidated and recoverable on restart. Durable records contain only an opaque `d1_` ref, MIME, size, SHA-256, and timestamp. Errors are fixed and redacted; cleanup targets only the exact ref-scoped temp file.

No plugin, manifest component, permission, MainActivity registration, dependency, frontend, Kotlin-reference, legacy index, or legacy settings change was made.

## Verification

- Focused T036 JVM tests: 18/18 PASS.
- Full Android JVM tests: 83/83 PASS.
- Rerun debug test/lint/assembly gate: 129 tasks PASS.
- Unsigned release assembly and Android-test Java compilation: PASS.
- Frozen offline, packaged-asset, WebView, host, release-security, legacy-inspector, legacy-writer, catalogue, and local browser parity checks: PASS.
- Artifact audit: classes are packaged but unregistered; MainActivity still registers exactly the two frozen legacy plugins.
- Independent Sol Judge: **ACCEPT**, no remediation.

## Accepted hashes

- `AndroidDocumentIngressPolicy.java`: `6e58e07f50fce8ff536824d68615489a0c862580f2a6230addb9f241c4c971d4`
- `OwnedPendingImportStore.java`: `26081b6a804aef6e492bc24de6291b7cf0e48ccfe07fda70e76d54f30223258e`
- `PendingImportRecord.java`: `78739adf5462f6899ca39f0efa4038db2d51268487f7e38ee27beee8050ce0a1`
- `AndroidDocumentIngressPolicyTest.java`: `bc5904610219ffaf24c592484ef7290964802970ddf19b62ae94cf10696373ec`
- `OwnedPendingImportStoreTest.java`: `5246b75697a0118370e3ac2e83d97f7f828dbdc30370b6deb561b210ea5b6fdf`
- Debug APK: `9ab35e1065a4365b5a7a114d488371e65c5b85733cc2e5d4f85b63264cc1c922`
- Unsigned release APK: `bf129defd73397fc50a9d0b323d6df3d142f7c5f73c6210ab839ce3feb439dd9`

Android filesystem behavior on a runtime, picker/provider lifecycle, physical-device behavior, certificate continuity, Play state, and production acceptance remain unverified.
