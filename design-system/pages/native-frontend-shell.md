# Page Override

## Screen

- Name: Packaged frontend shell (`index.html` and `index.tsx`, the document and boot
  path behind every route; not a visible surface of its own)
- User goal: open the app and get the build that was actually installed, in the
  browser, the installed PWA, or the packaged iOS and Android shells

## Deviations from master

- Master says a port that has not been injected is absent and the surface explains it.
  The shell adds one rule above that: the shell itself is identified before anything
  is registered. `browser` is the only positively identified target. An `ios` or
  `android` bridge names itself. A packaged origin with no bridge, and an unreadable
  platform, resolve to `native` so nothing is registered by assumption.
- The offline app shell is a browser and PWA capability only. The packaged shells never
  register it, because their assets already come from the verified package and a
  same-origin worker could only serve stale or substituted content.
- Releasing an earlier registration is destructive, so it runs only where the shell is
  positively native: a bridge that names iOS or Android, or one of the two packaged
  origins. An unreadable platform on a public origin registers nothing and deletes
  nothing, so a browser can never lose its offline shell to a detection failure.
- Deletion is scoped twice. Only registrations for this origin's own `/sw.js` are
  unregistered, and only caches named `pdf-chef-shell-` are deleted. Another site's
  worker, another path's worker and every unrelated cache are left untouched.
- The document declares its own content and navigation policy. Scripts, styles,
  workers and connections resolve to this origin; previews and one build-inlined face
  resolve to `data:` or `blob:`; WASM runs under `wasm-unsafe-eval` and never
  `unsafe-eval`; the two inline blocks are admitted by exact content hash rather than
  `unsafe-inline`. The single remote connect entry is the canonical host the
  retired-host redirect probes.
- The retired-host redirect is kept for browsers still on the old host, but it now
  fixes its target to https and refuses to run when a native bridge is present. In a
  packaged shell the hostname is `localhost`, so it is inert before either guard.
- Startup diagnostics are one fixed sentence each. No exception, document, filename,
  address, path, provider or content detail is passed to the console.

## States

There are none to draw. The shell changes no route, no copy, no styling and no tool
behaviour: it decides what may run before the first surface paints. A failure inside
the release step is not a user-facing state, because the interface renders either way.

## Constraints

- Cleanup is never chained to render. Every step is individually bounded, the whole
  step always settles and never rejects, and a cleanup API that rejects, throws or
  never settles cannot hold the interface back.
- The boundary is written as plain JavaScript with its dependencies passed in, so the
  security tests execute the shipped bytes instead of a restatement of them.
- A meta-delivered policy applies to everything parsed after it, which in the built
  document is every inline block, the built module and the built stylesheet. It cannot
  carry `frame-ancestors`, so framing is refused by the native host and by response
  headers where the browser deployment provides them, not here.
- Convergence, not instant erasure: a legacy worker still controlling the first launch
  after an upgrade can re-create its cache during that load. Its registration is
  already gone, so the following launch starts uncontrolled and the cache stays
  deleted.
- Editing `index.html` changes the inline hashes. They are recomputed and asserted by
  `tests/security/nativeFrontendShell.test.ts`, against both the source and the built
  document, so a drifted policy fails the tests rather than the browser.
