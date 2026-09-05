# T035 Native Frontend Shell Acceptance

Result: **ACCEPT**  
Evidence scope: **LOCAL_TEST_ONLY**  
Production release ready: **NO**

## Accepted implementation

Exact Claude Code Opus 5 High implemented the frontend boundary in session `8eaf31c4-c249-4f26-b02a-ea2fa4837ee6` using `claude-opus-5`, high effort, standard service tier. Claude returned `CLAUDE_FRONTEND_SECURITY_VERDICT: PASS`.

- Browser/PWA continues to register `/sw.js` and render offline.
- Android and iOS native shells never register a future service worker.
- Native cleanup is restricted to the exact origin `/sw.js` registration and `pdf-chef-shell-*` caches; unrelated caches are preserved.
- The packaged CSP precedes scripts/assets, uses exact inline hashes, permits no remote script/style/worker, and retains only the canonical old-host redirect connection.
- Startup diagnostics are redacted and visible product output is unchanged.
- Generated `dist/` and Android public assets are reproducible verification mirrors, not additional source ownership or Android source changes.

## Boundary outcomes

- `BROWSER_PWA_OFFLINE: PASS`
- `NATIVE_FUTURE_REGISTRATION: NONE`
- `SEEDED_LEGACY_WORKER_FIRST_LAUNCH: CONVERGENCE_ONLY`
- `PRODUCTION_PREDECESSOR_LOCALHOST_WORKER: NOT_PRESENT_IN_SOURCE`

The Chromium transition probe showed that a deliberately pre-seeded controlling worker can recreate its cache during the first native-marked navigation. The next launch converges to no controller, registration, or PDF Chef shell cache while preserving an unrelated cache. The inspected production predecessor source contains no same-origin worker registration. This task therefore does not claim defense against an arbitrary pre-seeded or compromised worker.

## Verification

- Focused frontend-shell security tests: 19/19 PASS.
- Combined security and offline tests: 22/22 PASS.
- Lint and production build: PASS; cache ID `7f70a553b218`.
- Offline, packaged-asset, WebView, host-skeleton, release-security, legacy-inspector, legacy-writer, and tool-catalog verifiers: PASS.
- Chromium browser/PWA offline rendering: PASS.
- Chromium native second-launch convergence: PASS.
- CSP violations: 0.
- Independent Sol Judge: **ACCEPT**, no remediation.

## Source hashes

- `index.tsx`: `bcea3c2eadedd0040f51e393d3862967a403db0d24d225744c37637e4834f537`
- `index.html`: `08fe24b2bd912911f2c442f1486d3ad3a43ca9de8b8d0df32f7283c8d2b781f3`
- `tests/security/nativeFrontendShell.test.ts`: `17b0f6f8843bc7be703578b7a48f0b55cf47298598c8a52c79dbe995801d3773`
- `DESIGN.md`: `20a7eb7a718a62d64777fc998ca33ab8b4f00fe64b900ae0d7eb8b22fc7887f6`
- `design-system/pages/native-frontend-shell.md`: `8b431455957cc41d9d6a01341046c9168f44c552f44b52d9213be04ed1e9444c`
- Generated `index.html`: `46d66eb00076989d7b8150f44fbf98b2fb04fe6e30516d8e2abb13d7969f7d54`
- Generated `sw.js`: `501c85b522f95aea28efa25b005b19e0be23a295db47f9994cbd59e780283895`

No physical-device, signing-certificate, Play Console, or production acceptance was performed.
