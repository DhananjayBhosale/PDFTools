# T929 native asset sync

Accepted on 2026-09-01 after the shared source freeze.

- `npm run native:sync` now delegates to a build-once/copy-both workflow. It does not run `cap sync`.
- The single Vite 8.2.2 build transformed 2,588 modules and generated 199 files with offline cache `544cbd936423`.
- `dist/index.html` is `d64e2b3c571b49eb935651349859c2c97c1cc240c232952f7d9ba67a0c0a8328`.
- `dist/sw.js` is `8945563dfe6dc9a562ed4c0d5291d7ef885dd5f4966a4afc31e1504ebade440b`.
- Android and iOS each contain the same 199 dist files byte-for-byte plus only the two required zero-length Cordova shims.
- Cross-tree identity is `58995ee00596e72e2932058498b4cfe06567684fea176c60d1fbc66b76ec0ca6`.
- The verifier rejected a one-byte mutation in a temporary copy and never mutated a packaged tree during its self-test.

No browser, simulator, emulator, native build, Capacitor sync, signing, device, deployment, or store action was used for this milestone.
