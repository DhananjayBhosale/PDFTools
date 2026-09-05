# T927 legacy Recent fail-closed repair

Decision: **ACCEPTED**

The Android workspace no longer converts a rejected legacy-inspector call into an
empty Recent list. Native rejection now reaches the existing `AsyncState` error UI.
A strict `corrupt` snapshot produces only the fixed non-sensitive message
`Legacy history is unavailable.` Missing and blank snapshots remain honest empty
states, while `partial_invalid` keeps every valid file row.

The accepted six-plugin host order was not changed. Its legacy verifier was updated
from the obsolete four-registration expectation to the current inspector, settings,
metadata, storage, documents, and scanner order.

Focused evidence:

- Android workspace test: PASS 22/22.
- TypeScript no-emit: PASS.
- Legacy inspector verifier: PASS, 25 focused tests.
- No Android native, React/CSS/design, packaged assets, iOS, legacy storage, device,
  browser, signing, or Play state changed.

SHA-256:

- `androidWorkspacePlatform.ts`:
  `488ddd0fb27b4747f07d8d690ccf90b9a784dc2b0257ccb9df07c46648767b1a`
- `androidWorkspacePlatform.test.ts`:
  `ca9eac4f91dd6506409e4f7010f720cf32c967ce3ea65af97f3e4468d9d430da`
- `verify-android-legacy-inspector.mjs`:
  `ef7bb41514fefa50924933054fb4f4fc7338024631a0a64acc7306fae57fcc0a`

Legacy collections remain a separate explicit capability milestone; they were not
coerced into single-file rows by this repair.
