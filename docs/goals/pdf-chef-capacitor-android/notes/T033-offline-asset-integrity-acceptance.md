# T033 offline asset integrity acceptance

## Decision

- `T033`: ACCEPT and done.
- Evidence classification: `LOCAL_TEST_ONLY`.
- Full migration outcome: incomplete.
- Production release ready: NO.

The production offline cache is content-addressed from the root shell bytes plus every unique sorted precache URL and its SHA-256 bytes. The Android host packages the exact production `dist` bytes without hand-edited copies.

## Accepted contract

- Cache identity includes `{ path: "/", sha256: <dist/index.html> }` and 191 unique sorted URL/SHA-256 asset records.
- Generated cache ID: `edb1b369921e`.
- `PRECACHE_ASSETS` remains a unique, sorted, URL-only manifest; `sw.js` is excluded to avoid self-reference.
- All production asset walkers reject symlinks and special filesystem entries.
- Every one of the 193 `dist` files is byte-identical to its Android packaged counterpart.
- The only Android extras are the required zero-byte `cordova.js` and `cordova_plugins.js` files.
- Eight OCR artifacts match their package sources; PDF.js, QPDF, WASM, OCR, and font runtime paths are local and artifact-verified.
- The Tesseract vendor bundle's inert CDN default is overridden by explicit local `workerPath`, `corePath`, and `langPath`; it is not an effective runtime dependency.

## Fresh verification

- `npm run build`: PASS; 2,050 modules transformed.
- Offline verifier: PASS; 191 precached files, 8 OCR assets, 64 fonts.
- `npx cap copy android`: PASS.
- Android packaged-assets verifier: PASS; 193 byte-identical files and 2 documented empty extras.
- Focused Node tests: 3 passed, 0 failed, 0 skipped.
- `npx tsc --noEmit`: PASS.
- Android host skeleton: PASS.
- Android release-security verifier: PASS.
- Legacy inspector verifier: PASS.
- Legacy settings-writer verifier: PASS.
- Independent Sol Judge verdict: ACCEPT; no remediation required.

## Source and generated identities

- Service-worker injection: `bfe93a71a1206aa28e08e208e85b4af20bc6a82d531ffcb2b00e9c4f5b2bdf52`.
- Offline verifier: `ef1d8cb3e10d5c5fe72305524f660360880c1ce62773c8c870c8d51fb93bf6e3`.
- Android packaged-assets verifier: `3bd5455d1aba7c06e858e75bf9f1fd1863dffd558eb9d1c468fa218c867edce4`.
- Focused test: `e31258c7e8bd6dc625bb870fc388b7d9a512bf2fb4648aaad35caed9d4d020f1`.
- `dist/sw.js` and Android copy: `f26882f2694e3c35677aa96363d29148a0ead71c844d8729d3245f108a87548a`.
- `dist/index.html` and Android copy: `c865b93f0de7a711261bd5a3707267398964bce5d0d36ed3f47453d4fd386435`.

## Limitations

- This is build-time and static packaged-artifact proof.
- Actual offline WebView runtime behavior is not yet proven.
- No physical device, signing compatibility, Play internal update, or production evidence was produced.
