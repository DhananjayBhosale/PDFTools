# T041 AndroidDocuments client acceptance

Result: accepted.

The inactive TypeScript client exposes only availability and `readChunk`. It requires strict opaque references, exact safe-integer bounds, canonical bounded Base64, exact output keys, and preserves native rejection identity. The native proxy remains module-private and no production entry module references `AndroidDocuments`.

Evidence:

- Focused TypeScript contract: PASS, 9/9, including the 512 KiB boundary and maximum-safe EOF offset.
- Scoped TypeScript no-emit: PASS.
- Repository TypeScript no-emit: PASS before the concurrent authorized frontend pass resumed; the next major milestone will rerun it on the handed-back tree.
- Independent static contract review: PASS.
- Android plugin catalogue: PASS across the current 83-module production entry graph; `AndroidDocuments` remains inactive.
- Release/security boundaries: unchanged; no native, manifest, registration, frontend, dependency, signing, device, or Play change.

Accepted hashes:

- `androidDocuments.ts`: `7ed6cb7f028b40d972698a387ba171ec9f2a5c49eb1a978a51e75511d168003f`
- `androidDocuments.test.ts`: `352665c49184cc12a7ff9e7b6e90e9b29884d391e066ecf3dfdb2a4b0c0da9b1`
- structural catalogue verifier: `98b663559de5815e3c850acaecd9d66b51ea3fb95dca1095a192767a244f9b77`

This does not activate the client and does not complete the Android migration.
