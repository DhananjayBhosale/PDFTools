#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_PACKAGE = 'com.dhananjaytech.pdfchef.debug';
const EXPECTED_ACTIVITY = 'com.dhananjaytech.zenpdf_allpdftoolsinoneplace.MainActivity';
const PROTECTED_SERIALS = new Set(['emulator-5554']);
const MAXIMUM_ITERATIONS = 20;
const READY_TIMEOUT_MS = 15_000;
const OUTPUT_ROOT = resolve(import.meta.dirname, '../output/t910-android-performance');

const fail = message => {
  throw new Error(`ANDROID_CANDIDATE_BENCHMARK: ${message}`);
};

const command = (program, args, options = {}) => {
  const result = spawnSync(program, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    fail(`${basename(program)} ${args.join(' ')} failed (${result.status}): ${String(result.stderr || result.stdout).trim()}`);
  }
  return {
    status: result.status ?? -1,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
};

const parseArgs = values => {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (current === '--self-test') {
      options.selfTest = true;
      continue;
    }
    if (!current.startsWith('--') || index + 1 >= values.length) fail(`invalid argument ${current}`);
    const key = current.slice(2);
    if (Object.hasOwn(options, key)) fail(`duplicate argument --${key}`);
    options[key] = values[index + 1];
    index += 1;
  }
  return options;
};

const exactInteger = (raw, minimum, maximum, label) => {
  if (typeof raw !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(raw)) fail(`${label} must be an integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(`${label} is out of range`);
  return value;
};

const safeLabel = raw => {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(raw)) {
    fail('label must be a bounded public token');
  }
  return raw;
};

const sdkRoot = () => {
  const candidates = [process.env.ANDROID_SDK_ROOT, process.env.ANDROID_HOME,
    resolve(homedir(), 'Library/Android/sdk')].filter(Boolean);
  const root = candidates.find(candidate => existsSync(resolve(candidate, 'platform-tools/adb')));
  if (!root) fail('Android SDK was not found');
  return root;
};

const latestBuildTool = (root, name) => {
  const buildTools = resolve(root, 'build-tools');
  const versions = readdirSync(buildTools, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d+(?:\.\d+){1,2}$/.test(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .reverse();
  const version = versions.find(candidate => existsSync(resolve(buildTools, candidate, name)));
  if (!version) fail(`${name} was not found in Android build-tools`);
  return resolve(buildTools, version, name);
};

const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');

const parseBadging = source => {
  const packageMatch = source.match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/m);
  const activityMatch = source.match(/^launchable-activity: name='([^']+)'/m);
  if (!packageMatch || !activityMatch) fail('APK package metadata is incomplete');
  return {
    packageName: packageMatch[1],
    versionCode: exactInteger(packageMatch[2], 1, 2_147_483_647, 'APK versionCode'),
    versionName: packageMatch[3],
    activity: activityMatch[1],
  };
};

const parseSigner = source => {
  const match = source.match(/Signer #1 certificate SHA-256 digest: ([0-9a-f]{64})/i);
  if (!match) fail('APK signer SHA-256 is unavailable');
  return match[1].toLowerCase();
};

const parseInstalled = source => {
  const code = source.match(/\bversionCode=(\d+)\b/);
  const name = source.match(/\bversionName=([^\s]+)/);
  if (!code || !name) fail('installed package metadata is incomplete');
  return {
    versionCode: exactInteger(code[1], 1, 2_147_483_647, 'installed versionCode'),
    versionName: name[1],
  };
};

const parseStart = source => {
  const status = source.match(/^Status: (.+)$/m)?.[1]?.trim();
  const totalTime = source.match(/^TotalTime: (\d+)$/m)?.[1];
  const waitTime = source.match(/^WaitTime: (\d+)$/m)?.[1];
  const thisTime = source.match(/^ThisTime: (\d+)$/m)?.[1];
  if (status !== 'ok' || totalTime === undefined || waitTime === undefined) {
    fail(`activity start output is incomplete: ${source.trim()}`);
  }
  return {
    status,
    thisTimeMs: thisTime === undefined ? null : Number(thisTime),
    totalTimeMs: Number(totalTime),
    waitTimeMs: Number(waitTime),
  };
};

const parseMemory = source => {
  const total = source.match(/^\s*TOTAL\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/m);
  const java = source.match(/^\s*Java Heap:\s+(\d+)/m);
  const native = source.match(/^\s*Native Heap:\s+(\d+)/m);
  const graphics = source.match(/^\s*Graphics:\s+(\d+)/m);
  if (!total) fail('dumpsys meminfo TOTAL row is unavailable');
  return {
    totalPssKb: Number(total[1]),
    totalPrivateDirtyKb: Number(total[2]),
    totalPrivateCleanKb: Number(total[3]),
    totalSwapPssKb: Number(total[4]),
    javaHeapKb: java ? Number(java[1]) : null,
    nativeHeapKb: native ? Number(native[1]) : null,
    graphicsKb: graphics ? Number(graphics[1]) : null,
  };
};

const percentile = (values, fraction) => {
  if (!Array.isArray(values) || values.length === 0) fail('cannot summarize an empty sample');
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(0, Math.ceil(fraction * sorted.length) - 1);
  return sorted[rank];
};

const distribution = values => ({
  count: values.length,
  minimum: Math.min(...values),
  p50: percentile(values, 0.50),
  p90: percentile(values, 0.90),
  p95: percentile(values, 0.95),
  maximum: Math.max(...values),
  mean: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
});

const selfTest = () => {
  const metadata = parseBadging("package: name='com.dhananjaytech.pdfchef.debug' versionCode='21' versionName='2.2.4-debug'\nlaunchable-activity: name='com.dhananjaytech.zenpdf_allpdftoolsinoneplace.MainActivity'");
  if (metadata.packageName !== EXPECTED_PACKAGE || metadata.versionCode !== 21
      || metadata.activity !== EXPECTED_ACTIVITY) fail('badging parser self-test failed');
  if (parseSigner('Signer #1 certificate SHA-256 digest: ' + 'a'.repeat(64)) !== 'a'.repeat(64)) {
    fail('signer parser self-test failed');
  }
  const start = parseStart('Status: ok\nThisTime: 10\nTotalTime: 20\nWaitTime: 30\nComplete');
  if (start.totalTimeMs !== 20 || start.waitTimeMs !== 30 || start.thisTimeMs !== 10) {
    fail('start parser self-test failed');
  }
  const memory = parseMemory(' Java Heap: 100\n Native Heap: 200\n Graphics: 300\n TOTAL 1000 500 25 10\n');
  if (memory.totalPssKb !== 1000 || memory.nativeHeapKb !== 200) {
    fail('memory parser self-test failed');
  }
  const summary = distribution([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  if (summary.p50 !== 50 || summary.p90 !== 90 || summary.p95 !== 100 || summary.mean !== 55) {
    fail('distribution self-test failed');
  }
  console.log('ANDROID_CANDIDATE_BENCHMARK_SELF_TEST: PASS');
};

const sleep = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    if (Object.keys(options).length !== 1) fail('--self-test accepts no other arguments');
    selfTest();
    return;
  }

  const allowed = new Set(['serial', 'apk', 'label', 'mode', 'iterations', 'warmups',
    'output', 'readiness']);
  for (const key of Object.keys(options)) if (!allowed.has(key)) fail(`unknown argument --${key}`);
  const serial = options.serial;
  if (typeof serial !== 'string' || !/^emulator-[0-9]{4,5}$/.test(serial)) {
    fail('--serial must name one explicit emulator');
  }
  if (PROTECTED_SERIALS.has(serial)) fail(`refusing protected serial ${serial}`);
  const apk = resolve(options.apk ?? '');
  if (!options.apk || !existsSync(apk) || !statSync(apk).isFile() || !apk.endsWith('.apk')) {
    fail('--apk must name one existing APK');
  }
  const label = safeLabel(options.label);
  const mode = options.mode;
  if (!['first', 'steady', 'snapshot'].includes(mode)) fail('--mode must be first, steady, or snapshot');
  const iterations = mode === 'steady'
    ? exactInteger(options.iterations ?? '10', 10, MAXIMUM_ITERATIONS, 'iterations')
    : 0;
  const warmups = mode === 'steady'
    ? exactInteger(options.warmups ?? '3', 0, 5, 'warmups')
    : 0;
  const readiness = options.readiness;
  if (readiness !== undefined && (readiness.length < 1 || readiness.length > 100
      || /[\u0000-\u001f]/.test(readiness))) fail('readiness text is invalid');
  const output = resolve(options.output ?? '');
  if (!options.output || (output !== OUTPUT_ROOT && !output.startsWith(`${OUTPUT_ROOT}/`))
      || !output.endsWith('.json')) fail('--output must be a JSON file under output/t910-android-performance');

  const root = sdkRoot();
  const adb = resolve(root, 'platform-tools/adb');
  const aapt = latestBuildTool(root, 'aapt');
  const apksigner = latestBuildTool(root, 'apksigner');
  const adbArgs = (...args) => command(adb, ['-s', serial, ...args]);
  const devices = command(adb, ['devices']).stdout.split(/\r?\n/)
    .some(line => line.trim() === `${serial}\tdevice`);
  if (!devices) fail(`device ${serial} is not connected and ready`);

  const apkMetadata = parseBadging(command(aapt, ['dump', 'badging', apk]).stdout);
  if (apkMetadata.packageName !== EXPECTED_PACKAGE || apkMetadata.activity !== EXPECTED_ACTIVITY) {
    fail('APK package/activity is outside the accepted debug benchmark boundary');
  }
  const signerSha256 = parseSigner(command(apksigner, ['verify', '--print-certs', apk]).stdout);
  const installed = parseInstalled(adbArgs('shell', 'dumpsys', 'package', EXPECTED_PACKAGE).stdout);
  if (installed.versionCode !== apkMetadata.versionCode || installed.versionName !== apkMetadata.versionName) {
    fail('installed package does not match the supplied APK metadata');
  }

  const property = name => adbArgs('shell', 'getprop', name).stdout.trim();
  const device = {
    serial,
    avdName: property('ro.boot.qemu.avd_name') || null,
    product: property('ro.product.name') || null,
    model: property('ro.product.model') || null,
    device: property('ro.product.device') || null,
    apiLevel: Number(property('ro.build.version.sdk')),
    release: property('ro.build.version.release') || null,
    buildFingerprint: property('ro.build.fingerprint') || null,
    abi: property('ro.product.cpu.abi') || null,
    displaySize: adbArgs('shell', 'wm', 'size').stdout.trim(),
    displayDensity: adbArgs('shell', 'wm', 'density').stdout.trim(),
  };

  const component = `${EXPECTED_PACKAGE}/${EXPECTED_ACTIVITY}`;
  const ready = async startedAt => {
    if (!readiness) return null;
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const dump = adbArgs('exec-out', 'uiautomator', 'dump', '/dev/tty').stdout;
      if (dump.includes(readiness)) return Date.now() - startedAt;
      await sleep(100);
    }
    fail(`readiness text was not found within ${READY_TIMEOUT_MS} ms`);
  };

  const launch = async () => {
    adbArgs('shell', 'am', 'force-stop', EXPECTED_PACKAGE);
    adbArgs('shell', 'input', 'keyevent', 'KEYCODE_HOME');
    const startedAt = Date.now();
    const outputValue = adbArgs('shell', 'am', 'start', '-W', '-S', '-n', component).stdout;
    const parsed = parseStart(outputValue);
    const readyMs = await ready(startedAt);
    return { ...parsed, readyMs, hostElapsedMs: Date.now() - startedAt };
  };

  const samples = [];
  if (mode === 'first') samples.push(await launch());
  if (mode === 'steady') {
    for (let index = 0; index < warmups; index += 1) await launch();
    for (let index = 0; index < iterations; index += 1) samples.push(await launch());
  }
  if (mode !== 'snapshot') await sleep(2_000);

  const meminfoRaw = adbArgs('shell', 'dumpsys', 'meminfo', EXPECTED_PACKAGE).stdout;
  const graphicsRaw = adbArgs('shell', 'dumpsys', 'gfxinfo', EXPECTED_PACKAGE).stdout;
  const exitInfoRaw = adbArgs('shell', 'dumpsys', 'activity', 'exit-info', EXPECTED_PACKAGE).stdout;
  const thermalRaw = adbArgs('shell', 'dumpsys', 'thermalservice').stdout;
  const memory = parseMemory(meminfoRaw);
  const summaries = samples.length === 0 ? null : {
    totalTimeMs: distribution(samples.map(sample => sample.totalTimeMs)),
    waitTimeMs: distribution(samples.map(sample => sample.waitTimeMs)),
    hostElapsedMs: distribution(samples.map(sample => sample.hostElapsedMs)),
    readyMs: readiness ? distribution(samples.map(sample => sample.readyMs)) : null,
  };

  const report = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    label,
    mode,
    privacy: {
      syntheticOnly: true,
      filenamesOrDocumentContentsRecorded: false,
      productionTelemetryRecorded: false,
    },
    artifact: {
      pathBasename: basename(apk),
      bytes: statSync(apk).size,
      sha256: sha256(apk),
      signerSha256,
      ...apkMetadata,
    },
    installed,
    device,
    protocol: {
      startupKind: mode === 'snapshot' ? null : 'process-cold, OS/page-cache warm',
      warmups,
      measuredIterations: samples.length,
      readinessTextUsed: readiness !== undefined,
      readinessTimeoutMs: readiness ? READY_TIMEOUT_MS : null,
      physicalDevice: false,
      packageDataClearedByHarness: false,
      packageUninstalledByHarness: false,
    },
    samples,
    summaries,
    memory,
    diagnostics: {
      gfxinfoSha256: createHash('sha256').update(graphicsRaw).digest('hex'),
      exitInfoSha256: createHash('sha256').update(exitInfoRaw).digest('hex'),
      thermalSha256: createHash('sha256').update(thermalRaw).digest('hex'),
      gfxinfo: graphicsRaw,
      exitInfo: exitInfoRaw,
      thermal: thermalRaw,
    },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`ANDROID_CANDIDATE_BENCHMARK: PASS ${mode} ${label}`);
  console.log(`OUTPUT: ${output}`);
};

await main();
