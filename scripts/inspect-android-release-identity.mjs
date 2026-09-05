#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const OUTPUT_ROOT = resolve(import.meta.dirname, '../output/t912-android-release-identity');
const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const MAX_ARTIFACTS = 12;

const fail = message => {
  throw new Error(`ANDROID_RELEASE_IDENTITY: ${message}`);
};

const command = (program, args, { allowFailure = false } = {}) => {
  const result = spawnSync(program, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    fail(`${basename(program)} ${args.join(' ')} failed (${result.status}): ${String(result.stderr || result.stdout).trim()}`);
  }
  return {
    status: result.status ?? -1,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
};

const parseArgs = values => {
  const result = { artifacts: [] };
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (current === '--self-test') {
      result.selfTest = true;
      continue;
    }
    if (current === '--artifact') {
      if (index + 1 >= values.length) fail('--artifact requires label=path');
      result.artifacts.push(values[index + 1]);
      index += 1;
      continue;
    }
    if (current === '--output') {
      if (result.output !== undefined || index + 1 >= values.length) fail('--output requires one path');
      result.output = values[index + 1];
      index += 1;
      continue;
    }
    fail(`unknown argument ${current}`);
  }
  return result;
};

const exactInteger = (raw, label) => {
  if (typeof raw !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(raw)) fail(`${label} is invalid`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) fail(`${label} is out of range`);
  return value;
};

const safeLabel = raw => {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(raw)) {
    fail('artifact label must be a bounded public token');
  }
  return raw;
};

const parseSdkDir = source => {
  const raw = source.match(/^sdk\.dir=(.+)$/m)?.[1]?.trim();
  if (!raw) return null;
  return raw.replace(/\\:/g, ':').replace(/\\\\/g, '\\');
};

const sdkRoot = () => {
  const localProperties = resolve(PROJECT_ROOT, 'android/local.properties');
  const configured = existsSync(localProperties)
    ? parseSdkDir(readFileSync(localProperties, 'utf8'))
    : null;
  const candidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    configured,
    resolve(homedir(), 'Library/Android/sdk'),
  ].filter(Boolean);
  const root = candidates.find(candidate => existsSync(resolve(candidate, 'build-tools')));
  if (!root) fail('Android SDK build-tools were not found');
  return root;
};

const latestBuildTools = root => {
  const buildTools = resolve(root, 'build-tools');
  const versions = readdirSync(buildTools, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d+(?:\.\d+){1,2}$/.test(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .reverse();
  const version = versions.find(candidate => existsSync(resolve(buildTools, candidate, 'aapt'))
    && existsSync(resolve(buildTools, candidate, 'apksigner')));
  if (!version) fail('aapt and apksigner were not found together in Android build-tools');
  return {
    version,
    aapt: resolve(buildTools, version, 'aapt'),
    apksigner: resolve(buildTools, version, 'apksigner'),
  };
};

const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');

const parseBadging = source => {
  const packageMatch = source.match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']*)'/m);
  if (!packageMatch) fail('APK package metadata is incomplete');
  return {
    packageName: packageMatch[1],
    versionCode: exactInteger(packageMatch[2], 'APK versionCode'),
    versionName: packageMatch[3],
    debuggable: /^application-debuggable$/m.test(source),
    launchableActivity: source.match(/^launchable-activity: name='([^']+)'/m)?.[1] ?? null,
  };
};

const parseSigner = result => {
  const combined = `${result.stdout}\n${result.stderr}`;
  const digests = [...combined.matchAll(/Signer #\d+ certificate SHA-256 digest: ([0-9a-f]{64})/gi)]
    .map(match => match[1].toLowerCase());
  if (result.status === 0) {
    if (digests.length < 1) fail('verified APK has no public signer SHA-256');
    return { status: 'verified', certificateSha256: [...new Set(digests)] };
  }
  if (/DOES NOT VERIFY/i.test(combined) && /Missing META-INF\/MANIFEST\.MF/i.test(combined)
      && digests.length === 0) {
    return { status: 'unsigned', certificateSha256: [] };
  }
  return { status: 'invalid_or_unverified', certificateSha256: [...new Set(digests)] };
};

const artifactArgument = raw => {
  const separator = raw.indexOf('=');
  if (separator < 1 || separator === raw.length - 1) fail('--artifact must use label=path');
  const label = safeLabel(raw.slice(0, separator));
  const path = resolve(raw.slice(separator + 1));
  if (!existsSync(path) || !statSync(path).isFile() || !path.endsWith('.apk')) {
    fail(`${label} does not name one existing APK`);
  }
  return { label, path };
};

const selfTest = () => {
  const badging = parseBadging([
    "package: name='com.example.release' versionCode='21' versionName='2.2.4'",
    'application-debuggable',
    "launchable-activity: name='com.example.MainActivity'",
  ].join('\n'));
  if (badging.packageName !== 'com.example.release' || badging.versionCode !== 21
      || badging.versionName !== '2.2.4' || !badging.debuggable
      || badging.launchableActivity !== 'com.example.MainActivity') {
    fail('badging parser self-test failed');
  }
  const signer = parseSigner({
    status: 0,
    stdout: `Verifies\nSigner #1 certificate SHA-256 digest: ${'a'.repeat(64)}`,
    stderr: '',
  });
  if (signer.status !== 'verified' || signer.certificateSha256[0] !== 'a'.repeat(64)) {
    fail('signer parser self-test failed');
  }
  const unsigned = parseSigner({
    status: 1,
    stdout: 'DOES NOT VERIFY\nERROR: Missing META-INF/MANIFEST.MF',
    stderr: '',
  });
  if (unsigned.status !== 'unsigned' || unsigned.certificateSha256.length !== 0) {
    fail('unsigned parser self-test failed');
  }
  if (parseSdkDir('sdk.dir=/Users/example/Android\\:Sdk\\\\Current\n')
      !== '/Users/example/Android:Sdk\\Current') {
    fail('local.properties SDK parser self-test failed');
  }
  console.log('ANDROID_RELEASE_IDENTITY_SELF_TEST: PASS');
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    if (options.artifacts.length !== 0 || options.output !== undefined) {
      fail('--self-test accepts no other arguments');
    }
    selfTest();
    return;
  }
  if (options.artifacts.length < 1 || options.artifacts.length > MAX_ARTIFACTS) {
    fail(`provide 1..${MAX_ARTIFACTS} --artifact values`);
  }
  if (typeof options.output !== 'string') fail('--output is required');
  const output = resolve(options.output);
  if ((output !== OUTPUT_ROOT && !output.startsWith(`${OUTPUT_ROOT}/`)) || !output.endsWith('.json')) {
    fail('--output must be a JSON file under output/t912-android-release-identity');
  }
  if (existsSync(output)) fail('refusing to overwrite an existing evidence file');

  const artifacts = options.artifacts.map(artifactArgument);
  if (new Set(artifacts.map(artifact => artifact.label)).size !== artifacts.length) {
    fail('artifact labels must be unique');
  }
  const sdk = sdkRoot();
  const buildTools = latestBuildTools(sdk);
  const inspected = artifacts.map(artifact => {
    const badging = parseBadging(command(buildTools.aapt, ['dump', 'badging', artifact.path]).stdout);
    const signer = parseSigner(command(buildTools.apksigner,
      ['verify', '--verbose', '--print-certs', artifact.path], { allowFailure: true }));
    return {
      label: artifact.label,
      path: artifact.path,
      bytes: statSync(artifact.path).size,
      sha256: sha256(artifact.path),
      ...badging,
      signing: signer,
    };
  });

  mkdirSync(dirname(output), { recursive: true });
  const descriptor = openSync(output, 'wx', 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      tools: {
        aapt: { path: buildTools.aapt, buildToolsVersion: buildTools.version },
        apksigner: { path: buildTools.apksigner, buildToolsVersion: buildTools.version },
      },
      artifacts: inspected,
    }, null, 2)}\n`, 'utf8');
  } finally {
    closeSync(descriptor);
  }
  console.log(`ANDROID_RELEASE_IDENTITY: PASS (${inspected.length} artifacts -> ${output})`);
};

main();
