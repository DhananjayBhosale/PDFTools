# T042B-I inactive storage-stats acceptance

Result: accepted for the inactive implementation only.

`AndroidStorageStats` exposes exactly `getStorageStats({})`. Retained bytes count only immediate, regular, no-follow payload files under `filesDir/pdfchef_documents/owned`; the implementation never traverses metadata, sessions, operations, share staging, cache, WebView data, legacy processed data/index, or DataStore. Missing owned storage reports zero without creating it, while unsafe roots or entries fail generically.

Evidence:

- Focused JDK 21 calculator/plugin tests: PASS.
- Focused TypeScript adapter: PASS, 5/5.
- Scoped and repository TypeScript no-emit: PASS before the concurrent authorized frontend pass resumed.
- Storage-stats verifier: PASS.
- Android plugin catalogue: PASS; plugin remains unregistered and absent from the production entry graph.
- Release-security verifier: PASS.

Accepted hashes are emitted by `scripts/verify-android-storage-stats.mjs`, including calculator `09233a8855311141a4534fb8d7ce5ab199dd100b80dcf29daee0f53ae171f95b` and TypeScript client `a0785154c65f3579bcfbe1a07388c7376710dc5363f6d559f6e83b15153faad8`.

Registration and emulator discovery remain separately gated and NOT CHECKED.
