import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const entrySource = readFileSync(resolve(root, 'index.tsx'), 'utf8');
const documentSource = readFileSync(resolve(root, 'index.html'), 'utf8');

const between = (source: string, open: string, close: string): string => {
  const afterOpen = source.split(open);
  assert.equal(afterOpen.length, 2, `expected exactly one ${open}`);
  const region = afterOpen[1].split(close);
  assert.equal(region.length, 2, `expected exactly one ${close}`);
  return region[0];
};

const BOUNDARY_SOURCE = between(
  entrySource,
  '// #region packaged-shell-boundary',
  '// #endregion packaged-shell-boundary',
);

const EXPORTED = [
  'PACKAGED_NATIVE_ORIGINS',
  'SHELL_CACHE_PREFIX',
  'SHELL_WORKER_PATH',
  'SHELL_CLEANUP_BUDGET_MS',
  'resolveShellTarget',
  'isPackagedNativeShell',
  'settleWithin',
  'originOf',
  'isShellRegistration',
  'releaseShellServiceWorkers',
  'releaseShellCaches',
  'releasePackagedNativeShellState',
];

/**
 * The shipped bytes of the boundary are executed, not a copy of them. The region is
 * written as plain JavaScript for exactly this reason: a type annotation, an import or
 * a hidden module global added to it makes this evaluation fail rather than pass
 * silently on a restatement of the contract.
 */
const loadBoundary = () => runInNewContext(
  `(function () {\n${BOUNDARY_SOURCE}\nreturn { ${EXPORTED.join(', ')} };\n})()`,
  { URL, setTimeout, clearTimeout },
);

const boundary = loadBoundary();

const workerRegistration = (scriptURL: string | null, scope: string) => ({
  active: scriptURL === null ? null : { scriptURL },
  waiting: null,
  installing: null,
  scope,
  unregister() {
    this.unregistered = true;
    return Promise.resolve(true);
  },
  unregistered: false,
});

const inlineScripts = (html: string): string[] => [
  ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
].map((match) => match[1]);

const contentSecurityPolicy = (html: string): string => {
  const meta = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/,
  );
  assert.ok(meta, 'index document must carry a Content-Security-Policy meta element');
  return meta[1];
};

const directivesOf = (policy: string): Map<string, string[]> => new Map(
  policy
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const [name, ...values] = part.split(/\s+/);
      return [name, values] as [string, string[]];
    }),
);

test('the packaged-shell boundary executes as dependency-free JavaScript', () => {
  for (const name of EXPORTED) assert.ok(boundary[name] !== undefined, `${name} is missing`);
  assert.deepEqual([...boundary.PACKAGED_NATIVE_ORIGINS], ['https://localhost', 'capacitor://localhost']);
  assert.equal(boundary.SHELL_CACHE_PREFIX, 'pdf-chef-shell-');
  assert.equal(boundary.SHELL_WORKER_PATH, '/sw.js');
  assert.ok(Number.isInteger(boundary.SHELL_CLEANUP_BUDGET_MS) && boundary.SHELL_CLEANUP_BUDGET_MS > 0);
  assert.doesNotMatch(BOUNDARY_SOURCE, /^\s*import\s/m, 'the boundary must not depend on a module');
  assert.doesNotMatch(BOUNDARY_SOURCE, /\bCapacitor\b/, 'the bridge is read by the caller, not inside the boundary');
  assert.doesNotMatch(BOUNDARY_SOURCE, /\.register\(/, 'the boundary can never register a worker');
});

test('browser, native iOS and native Android are resolved as distinct shells', () => {
  const { resolveShellTarget } = boundary;
  assert.equal(resolveShellTarget('web', 'https://pdfchef.dhananjaytech.app'), 'browser');
  assert.equal(resolveShellTarget('web', 'http://localhost:5173'), 'browser');
  assert.equal(resolveShellTarget('ios', 'capacitor://localhost'), 'ios');
  assert.equal(resolveShellTarget('android', 'https://localhost'), 'android');
  // A packaged origin without a bridge, and any unreadable platform, must not read as browser.
  assert.equal(resolveShellTarget('web', 'https://localhost'), 'native');
  assert.equal(resolveShellTarget('web', 'capacitor://localhost'), 'native');
  assert.equal(resolveShellTarget(null, 'https://pdfchef.dhananjaytech.app'), 'native');
  assert.equal(resolveShellTarget(undefined, 'https://localhost'), 'native');
});

test('the shell origin is rebuilt from the location parts, not from location.origin', () => {
  const { originOf } = boundary;
  assert.equal(originOf({ protocol: 'https:', host: 'localhost' }), 'https://localhost');
  assert.equal(originOf({ protocol: 'capacitor:', host: 'localhost' }), 'capacitor://localhost');
  assert.equal(originOf({ protocol: 'http:', host: 'localhost:4173' }), 'http://localhost:4173');
  assert.equal(originOf(new URL('capacitor://localhost/sw.js')), 'capacitor://localhost');
  // The engines that serialise a custom scheme as "null" would otherwise lose the shell.
  assert.notEqual(new URL('capacitor://localhost/sw.js').origin, 'capacitor://localhost');
  assert.match(entrySource, /const shellOrigin = originOf\(window\.location\);/);
});

test('cleanup is confined to shells that are positively native', () => {
  const { isPackagedNativeShell } = boundary;
  assert.equal(isPackagedNativeShell('ios', 'capacitor://localhost'), true);
  assert.equal(isPackagedNativeShell('android', 'https://localhost'), true);
  assert.equal(isPackagedNativeShell('native', 'https://localhost'), true);
  assert.equal(isPackagedNativeShell('browser', 'https://pdfchef.dhananjaytech.app'), false);
  // An unreadable platform in a real browser must never delete that browser's offline shell.
  assert.equal(isPackagedNativeShell('native', 'https://pdfchef.dhananjaytech.app'), false);
});

test('the entry registers the app-shell worker only on the browser target', () => {
  assert.equal(entrySource.split('navigator.serviceWorker.register(').length - 1, 1);
  const browserBranch = entrySource.split("} else if (shellTarget === 'browser'")[1];
  assert.ok(browserBranch, 'registration must sit behind an explicit browser-target guard');
  assert.match(browserBranch, /'serviceWorker' in navigator && import\.meta\.env\.PROD/);
  assert.match(browserBranch, /navigator\.serviceWorker\.register\(SHELL_WORKER_PATH\)/);
  const nativeBranch = between(
    entrySource,
    'if (isPackagedNativeShell(shellTarget, shellOrigin)) {',
    "} else if (shellTarget === 'browser'",
  );
  assert.doesNotMatch(nativeBranch, /register\(|render\(/);
});

test('rendering is never chained to cleanup', () => {
  assert.match(entrySource, /\n {2}void releasePackagedNativeShellState\(window, SHELL_CLEANUP_BUDGET_MS\);\n/);
  assert.doesNotMatch(entrySource, /releasePackagedNativeShellState\([^)]*\)\s*\./);
  const renderCalls = entrySource.split('.then(() => render(platform))').length - 1;
  assert.equal(renderCalls, 1, 'the iOS adapter path is the only chained render');
});

test('only this origin app-shell registrations are released', async () => {
  const origin = 'https://localhost';
  const registrations = [
    workerRegistration('https://localhost/sw.js', 'https://localhost/'),
    workerRegistration('https://localhost/vendor/tesseract/worker.min.js', 'https://localhost/'),
    workerRegistration('https://pdfchef.dhananjaytech.app/sw.js', 'https://pdfchef.dhananjaytech.app/'),
    workerRegistration(null, 'https://localhost/'),
    workerRegistration(null, 'https://localhost/tools/'),
  ];
  const container = { getRegistrations: () => Promise.resolve(registrations) };
  await boundary.releaseShellServiceWorkers(container, origin, 500);
  assert.deepEqual(registrations.map((entry) => entry.unregistered), [true, false, false, true, false]);
});

test('the iOS capacitor scheme is matched despite its null URL origin', async () => {
  const origin = 'capacitor://localhost';
  const registrations = [
    workerRegistration('capacitor://localhost/sw.js', 'capacitor://localhost/'),
    workerRegistration('capacitor://elsewhere/sw.js', 'capacitor://elsewhere/'),
  ];
  await boundary.releaseShellServiceWorkers(
    { getRegistrations: () => Promise.resolve(registrations) },
    origin,
    500,
  );
  assert.deepEqual(registrations.map((entry) => entry.unregistered), [true, false]);
});

test('only PDF Chef shell caches are deleted', async () => {
  const deleted: string[] = [];
  const names = [
    'pdf-chef-shell-edb1b369921e',
    'pdf-chef-shell-0000deadbeef',
    'pdf-chef-outputs',
    'workbox-precache-v2-https://example.test/',
    'some-other-site-shell',
  ];
  const cacheStorage = {
    keys: () => Promise.resolve(names),
    delete: (name: string) => {
      deleted.push(name);
      return Promise.resolve(true);
    },
  };
  await boundary.releaseShellCaches(cacheStorage, 500);
  assert.deepEqual(deleted.sort(), ['pdf-chef-shell-0000deadbeef', 'pdf-chef-shell-edb1b369921e']);
});

test('a native shell releases both registrations and shell caches', async () => {
  const registrations = [workerRegistration('https://localhost/sw.js', 'https://localhost/')];
  const deleted: string[] = [];
  const scope = {
    location: { protocol: 'https:', host: 'localhost' },
    navigator: { serviceWorker: { getRegistrations: () => Promise.resolve(registrations) } },
    caches: {
      keys: () => Promise.resolve(['pdf-chef-shell-abc', 'unrelated']),
      delete: (name: string) => {
        deleted.push(name);
        return Promise.resolve(true);
      },
    },
  };
  assert.equal(await boundary.releasePackagedNativeShellState(scope, 500), undefined);
  assert.equal(registrations[0].unregistered, true);
  assert.deepEqual(deleted, ['pdf-chef-shell-abc']);
});

test('cleanup settles when every cleanup API rejects, throws or never settles', async () => {
  const rejecting = {
    location: { protocol: 'https:', host: 'localhost' },
    navigator: {
      serviceWorker: {
        getRegistrations: () => Promise.reject(new Error('denied')),
      },
    },
    caches: {
      keys: () => {
        throw new Error('denied');
      },
      delete: () => Promise.reject(new Error('denied')),
    },
  };
  assert.equal(await boundary.releasePackagedNativeShellState(rejecting, 50), undefined);

  const registrations = [workerRegistration('https://localhost/sw.js', 'https://localhost/')];
  registrations[0].unregister = () => new Promise<boolean>(() => undefined);
  const stalled = {
    location: { protocol: 'https:', host: 'localhost' },
    navigator: { serviceWorker: { getRegistrations: () => Promise.resolve(registrations) } },
    caches: { keys: () => new Promise(() => undefined), delete: () => Promise.resolve(true) },
  };
  const startedAt = Date.now();
  assert.equal(await boundary.releasePackagedNativeShellState(stalled, 50), undefined);
  assert.ok(Date.now() - startedAt < 4000, 'a stalled cleanup API must not hold the shell open');

  // A shell with no service-worker or cache support at all still settles.
  assert.equal(await boundary.releasePackagedNativeShellState({ location: { protocol: 'https:', host: 'localhost' } }, 50), undefined);
  assert.equal(await boundary.releasePackagedNativeShellState(null, 50), undefined);
});

test('settleWithin resolves the fallback and never rejects', async () => {
  const { settleWithin } = boundary;
  assert.equal(await settleWithin(() => Promise.resolve('value'), 'fallback', 500), 'value');
  assert.equal(await settleWithin(() => Promise.reject(new Error('no')), 'fallback', 500), 'fallback');
  assert.equal(await settleWithin(() => {
    throw new Error('no');
  }, 'fallback', 500), 'fallback');
  assert.equal(await settleWithin(() => new Promise(() => undefined), 'fallback', 30), 'fallback');
});

test('the policy precedes every script and forbids remote or unsafe execution', () => {
  const policyIndex = documentSource.indexOf('http-equiv="Content-Security-Policy"');
  assert.ok(policyIndex > 0);
  assert.ok(policyIndex < documentSource.indexOf('<script'), 'the policy must be parsed before any script');
  assert.ok(policyIndex < documentSource.indexOf('<link'), 'the policy must be parsed before any linked asset');

  const directives = directivesOf(contentSecurityPolicy(documentSource));
  assert.deepEqual(directives.get('default-src'), ["'self'"]);
  assert.deepEqual(directives.get('base-uri'), ["'self'"]);
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
  assert.deepEqual(directives.get('form-action'), ["'self'"]);
  assert.deepEqual(directives.get('frame-src'), ["'self'"]);
  assert.deepEqual(directives.get('style-src'), ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(directives.get('img-src'), ["'self'", 'data:', 'blob:']);
  // One selectable interface face is small enough that the build inlines it as a data URI.
  assert.deepEqual(directives.get('font-src'), ["'self'", 'data:']);
  assert.deepEqual(directives.get('media-src'), ["'self'", 'blob:']);
  assert.deepEqual(directives.get('manifest-src'), ["'self'"]);
  // Local Web Workers plus the blob worker the OCR vendor spawns for its local script.
  assert.deepEqual(directives.get('worker-src'), ["'self'", 'blob:']);
  // Local WASM, local fonts, and data/blob previews, plus exactly the canonical host
  // the retired-host redirect probes and nothing else remote.
  assert.deepEqual(directives.get('connect-src'), ["'self'", 'data:', 'blob:', 'https://pdfchef.dhananjaytech.app']);

  const scriptSource = directives.get('script-src') ?? [];
  assert.equal(scriptSource[0], "'self'");
  assert.ok(scriptSource.includes("'wasm-unsafe-eval'"), 'WASM must run without unsafe-eval');
  assert.ok(!scriptSource.includes("'unsafe-inline'"));
  assert.ok(!scriptSource.includes("'unsafe-eval'"));
  assert.ok(!scriptSource.includes("'strict-dynamic'"));

  for (const [name, values] of directives) {
    assert.ok(!name.startsWith('frame-ancestors'), 'a meta policy must not declare an ignored directive');
    for (const value of values) {
      assert.ok(!value.includes('*'), `${name} must not carry a wildcard`);
      assert.ok(!/^https?:$/.test(value), `${name} must not open a whole scheme`);
      assert.ok(value !== "'unsafe-eval'", `${name} must not allow unsafe-eval`);
    }
  }
});

test('each inline script is admitted by its exact hash and no other inline script exists', () => {
  const scripts = inlineScripts(documentSource);
  assert.equal(scripts.length, 2, 'the JSON-LD block and the retired-host redirect are the only inline scripts');
  const hashes = scripts.map((body) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  const scriptSource = directivesOf(contentSecurityPolicy(documentSource)).get('script-src') ?? [];
  assert.deepEqual(
    scriptSource.filter((value) => value.startsWith("'sha256-")).sort(),
    [...hashes].sort(),
  );
  for (const body of scripts) assert.doesNotMatch(body, /console\./);
});

test('the document loads no remote runtime asset', () => {
  assert.doesNotMatch(documentSource, /<script[^>]+src="(?!\/)/);
  assert.doesNotMatch(documentSource, /rel="(stylesheet|preload|prefetch|preconnect|dns-prefetch|modulepreload)"[^>]*href="https?:/);
  assert.doesNotMatch(documentSource, /<link[^>]+rel="(preconnect|dns-prefetch)"/);
  assert.doesNotMatch(documentSource, /@import|url\(https?:/);
});

test('the production document carries the identical policy', () => {
  const built = resolve(root, 'dist/index.html');
  assert.ok(existsSync(built), 'run npm run build before the packaged-shell security tests');
  const builtSource = readFileSync(built, 'utf8');
  assert.equal(contentSecurityPolicy(builtSource), contentSecurityPolicy(documentSource));
  assert.deepEqual(inlineScripts(builtSource), inlineScripts(documentSource));
  assert.doesNotMatch(builtSource, /<script[^>]+src="(?!\/)/);
  const policyIndex = builtSource.indexOf('http-equiv="Content-Security-Policy"');
  assert.ok(policyIndex > 0 && policyIndex < builtSource.indexOf('<script'));
  assert.ok(policyIndex < builtSource.indexOf('<script type="module" crossorigin'));
});

const runRedirect = async (options: {
  hostname: string;
  protocol?: string;
  bridge?: boolean;
  probe?: Promise<unknown>;
}) => {
  const record = { fetched: [] as string[], replaced: [] as string[], aborted: 0, cleared: 0 };
  const location = {
    protocol: options.protocol ?? 'https:',
    hostname: options.hostname,
    pathname: '/tools/merge-pdf',
    search: '?from=mail',
    hash: '#result',
    replace: (url: string) => {
      record.replaced.push(url);
    },
  };
  const win: Record<string, unknown> = {
    location,
    setTimeout: () => 7,
    clearTimeout: () => {
      record.cleared += 1;
    },
  };
  if (options.bridge) win.Capacitor = {};
  runInNewContext(inlineScripts(documentSource)[1], {
    window: win,
    AbortController: class {
      signal = {};

      abort() {
        record.aborted += 1;
      }
    },
    fetch: (url: string) => {
      record.fetched.push(url);
      return options.probe ?? Promise.resolve({});
    },
  });
  await new Promise((settle) => setTimeout(settle, 0));
  return record;
};

test('the retired-host redirect runs only on the retired host and only over https', async () => {
  const redirected = await runRedirect({ hostname: 'pdftools.dhananjaytech.app' });
  assert.deepEqual(redirected.fetched, ['https://pdfchef.dhananjaytech.app/cdn-cgi/trace']);
  assert.deepEqual(redirected.replaced, [
    'https://pdfchef.dhananjaytech.app/tools/merge-pdf?from=mail#result',
  ]);
  assert.equal(redirected.cleared, 1, 'the probe timeout is always released');

  const insecure = await runRedirect({ hostname: 'pdftools.dhananjaytech.app', protocol: 'http:' });
  assert.deepEqual(insecure.replaced, [
    'https://pdfchef.dhananjaytech.app/tools/merge-pdf?from=mail#result',
  ], 'the redirect target is fixed to https and never inherits an insecure scheme');

  const unreachable = await runRedirect({
    hostname: 'pdftools.dhananjaytech.app',
    probe: Promise.reject(new Error('offline')),
  });
  assert.deepEqual(unreachable.replaced, []);
});

test('the retired-host redirect is inert in the packaged native shell', async () => {
  for (const hostname of ['localhost', 'pdfchef.dhananjaytech.app', 'pdftools.dhananjaytech.app.evil.test']) {
    const record = await runRedirect({ hostname });
    assert.deepEqual(record.fetched, [], `${hostname} must not be probed`);
    assert.deepEqual(record.replaced, [], `${hostname} must not be navigated`);
  }
  const bridged = await runRedirect({ hostname: 'pdftools.dhananjaytech.app', bridge: true });
  assert.deepEqual(bridged.fetched, []);
  assert.deepEqual(bridged.replaced, [], 'a native bridge refuses the redirect outright');
});

test('startup diagnostics carry no dynamic detail', () => {
  const calls = [...entrySource.matchAll(/console\.[a-z]+\(([^)]*)\)/g)].map((match) => match[1]);
  assert.deepEqual(calls, [
    "'Pending document delivery could not start.'",
    "'Offline app shell could not be registered.'",
  ]);
  for (const argument of calls) {
    // A single quoted literal with no interpolation, concatenation or second argument
    // cannot carry an exception, a document, a filename, an address or a provider.
    assert.match(argument, /^'[^'`$+,]*'$/, `redacted diagnostics take one literal string: ${argument}`);
  }
  assert.doesNotMatch(entrySource, /console\.[a-z]+\([^)]*,/);
  assert.doesNotMatch(entrySource, /catch \([\w$]/, 'no caught value is bound where it could be logged');
});
