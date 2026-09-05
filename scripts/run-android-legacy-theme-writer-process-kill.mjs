#!/usr/bin/env node

import { spawn, execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = 'com.dhananjaytech.pdfchef.debug';
const PRODUCTION = 'com.dhananjaytech.pdfchef';
const TEST_PACKAGE = `${TARGET}.test`;
const TEST_RUNNER = `${TEST_PACKAGE}/androidx.test.runner.AndroidJUnitRunner`;
const TEST_CLASS = 'com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.AndroidLegacySettingsWriterInstrumentedTest';
const COORDINATOR_CLASS = 'com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.LegacyMutationCoordinator';
const COORDINATOR_SOURCE = resolve(root,
  'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyMutationCoordinator.java');
const COMMAND_TIMEOUT_MS = 30_000;
const PROCESS_TIMEOUT_MS = 45_000;
const BREAKPOINT_TIMEOUT_MS = 60_000;

function fail(message) { throw new Error(message); }
function assert(condition, message) { if (!condition) fail(message); }

function parseSerial(argv) {
  assert(argv.length === 2 && argv[0] === '--serial',
    'usage: run-android-legacy-theme-writer-process-kill.mjs --serial emulator-<port>');
  const serial = argv[1];
  assert(/^emulator-[0-9]+$/.test(serial), 'physical and non-emulator serials are forbidden');
  return serial;
}

async function run(file, args, options = {}) {
  try {
    const result = await execFile(file, args, {
      cwd: root,
      timeout: options.timeout ?? COMMAND_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
      encoding: 'utf8',
      env: options.env ?? process.env,
    });
    return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  } catch (error) {
    fail(`${file} ${args.join(' ')} failed without retry\n${error.stdout ?? ''}${error.stderr ?? ''}`);
  }
}

function adbArgs(serial, ...args) { return ['-s', serial, ...args]; }
async function adb(serial, ...args) { return run('adb', adbArgs(serial, ...args)); }

async function verifyEmulator(serial) {
  assert(await adb(serial, 'get-state') === 'device', `emulator is not ready: ${serial}`);
  assert(await adb(serial, 'shell', 'getprop', 'ro.kernel.qemu') === '1',
    'ro.kernel.qemu must be 1');
  const avd = await adb(serial, 'shell', 'getprop', 'ro.boot.qemu.avd_name');
  assert(avd.length > 0, 'AVD name is missing');
  const identity = [
    await adb(serial, 'shell', 'getprop', 'ro.hardware'),
    await adb(serial, 'shell', 'getprop', 'ro.build.fingerprint'),
    await adb(serial, 'shell', 'getprop', 'ro.product.model'),
  ].join(' ').toLowerCase();
  assert(/ranchu|goldfish|emulator|generic|sdk_gphone/.test(identity),
    `QEMU identity is not an Android emulator: ${identity}`);
  const avdConsole = await adb(serial, 'emu', 'avd', 'name');
  assert(avdConsole.includes(avd), 'ADB console AVD identity does not match getprop');
  assert((await adb(serial, 'shell', 'pm', 'path', TARGET)).startsWith('package:'),
    `exact debug target is not installed: ${TARGET}`);
  assert((await adb(serial, 'shell', 'pm', 'path', TEST_PACKAGE)).startsWith('package:'),
    `exact androidTest package is not installed: ${TEST_PACKAGE}`);
  assert(TARGET !== PRODUCTION && TARGET.endsWith('.debug'),
    'runner target must be the isolated debug package, never production');
  await adb(serial, 'shell', 'run-as', TARGET, 'id');
  return avd;
}

async function findJdk21() {
  const candidates = [];
  if (process.env.JAVA_HOME) candidates.push(process.env.JAVA_HOME);
  if (process.platform === 'darwin') {
    try {
      candidates.push((await run('/usr/libexec/java_home', ['-v', '21'])).trim());
    } catch { /* validated candidates below produce the final error */ }
  }
  for (const home of [...new Set(candidates.filter(Boolean))]) {
    const java = join(home, 'bin', 'java');
    const jdb = join(home, 'bin', 'jdb');
    try {
      const javaVersion = await run(java, ['-version']);
      const jdbVersion = await run(jdb, ['-version']);
      if (/version "21(?:\.|\")/.test(javaVersion) && /\b21(?:\.|\b)/.test(jdbVersion)) {
        return { home, jdb };
      }
    } catch { /* try the next explicit home */ }
  }
  fail('JDK 21 with jdb is required; set JAVA_HOME to an exact JDK 21 home');
}

function sourceLines() {
  const lines = readFileSync(COORDINATOR_SOURCE, 'utf8').split(/\r?\n/);
  function unique(statement) {
    const matches = [];
    lines.forEach((line, index) => { if (line.trim() === statement) matches.push(index + 1); });
    assert(matches.length === 1,
      `natural breakpoint statement must be source-unique: ${statement}; found ${matches.length}`);
    return matches[0];
  }
  const beforeMove = unique('io.atomicMove(ownedTemp.path(), source);');
  const afterMove = unique('linearized = true;');
  const directoryFsync = unique('io.fsyncDirectory(directory);');
  const afterDirectoryFsync = unique('return new Result(mode, true);');
  assert(beforeMove < afterMove && afterMove < directoryFsync
    && directoryFsync < afterDirectoryFsync,
  'natural breakpoint statements are not ordered around atomic replacement and fsync');
  return { beforeMove, afterMove, afterDirectoryFsync };
}

async function clearExactTarget(serial) {
  const result = await adb(serial, 'shell', 'pm', 'clear', TARGET);
  assert(result === 'Success', `exact debug target clear failed: ${result}`);
}

function instrumentationArgs(serial, method, extras = {}) {
  const args = adbArgs(serial, 'shell', 'am', 'instrument', '-w', '-r',
    '-e', 'serial', serial, '-e', 'class', `${TEST_CLASS}#${method}`);
  for (const [key, value] of Object.entries(extras)) args.push('-e', key, value);
  args.push(TEST_RUNNER);
  return args;
}

async function runInstrumentation(serial, method, extras = {}) {
  const output = await run('adb', instrumentationArgs(serial, method, extras),
    { timeout: PROCESS_TIMEOUT_MS });
  assert(/\bOK \([0-9]+ tests?\)/.test(output) && !/FAILURES!!!|INSTRUMENTATION_FAILED/.test(output),
    `instrumentation ${method} did not pass\n${output}`);
  return output;
}

function spawnDriver(serial, crashCase) {
  const child = spawn('adb', instrumentationArgs(serial, 'driveCrashCase', {
    protocol: 'T014_JDWP', crashCase,
  }), { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  return { child, output: () => output };
}

async function waitUntil(description, action, predicate, timeoutMs = BREAKPOINT_TIMEOUT_MS,
  timeoutDiagnostic = undefined) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await action();
      if (predicate(last)) return last;
    } catch (error) { last = error.message; }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100));
  }
  const diagnostic = timeoutDiagnostic ? `\n${timeoutDiagnostic()}` : '';
  fail(`timeout waiting for ${description}; last=${String(last)}${diagnostic}`);
}

async function exactTargetPid(serial) {
  const output = await pidOutput(serial);
  const pids = output.split(/\s+/).filter(Boolean);
  assert(pids.length === 1 && /^[0-9]+$/.test(pids[0]),
    `expected one exact target PID, found: ${output}`);
  const pid = pids[0];
  const processes = await adb(serial, 'shell', 'ps', '-A', '-o', 'PID,NAME');
  const rows = processes.split(/\r?\n/).map(line => line.trim().split(/\s+/));
  assert(rows.some(row => row[0] === pid && row[1] === TARGET),
    `PID ${pid} is not exact process ${TARGET}`);
  return pid;
}

async function pidOutput(serial) {
  return (await adb(serial, 'shell', 'sh', '-c', `pidof ${TARGET} || true`)).trim();
}

class JdbSession {
  constructor(binary, port) {
    this.output = '';
    this.child = spawn(binary, ['-attach', `localhost:${port}`], {
      cwd: root, env: process.env, stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout.on('data', chunk => { this.output += chunk; });
    this.child.stderr.on('data', chunk => { this.output += chunk; });
  }

  async wait(pattern, from = 0, timeoutMs = BREAKPOINT_TIMEOUT_MS) {
    return waitUntil(`jdb output ${pattern}`, async () => this.output.slice(from),
      value => pattern.test(value), timeoutMs);
  }

  async command(command, pattern) {
    const from = this.output.length;
    this.child.stdin.write(`${command}\n`);
    return this.wait(pattern, from);
  }

  close() {
    if (!this.child.killed) this.child.kill('SIGKILL');
  }
}

async function waitChildExit(driver, timeoutMs = COMMAND_TIMEOUT_MS) {
  if (driver.child.exitCode !== null) return driver.child.exitCode;
  return Promise.race([
    new Promise(resolvePromise => driver.child.once('exit', code => resolvePromise(code))),
    new Promise((_, rejectPromise) => setTimeout(
      () => rejectPromise(new Error(`driver did not exit\n${driver.output()}`)), timeoutMs)),
  ]);
}

async function killAtBreakpoint(serial, jdk, crashCase, line) {
  let driver;
  let forward;
  let jdb;
  let exactPidDead = false;
  try {
    await adb(serial, 'shell', 'am', 'force-stop', TARGET);
    await adb(serial, 'shell', 'am', 'set-debug-app', '-w', TARGET);
    driver = spawnDriver(serial, crashCase);
    const driverDiagnostic = () =>
      `captured driver output:\n${driver.output() || '<empty>'}`;
    const pid = await waitUntil('one waiting target PID',
      () => exactTargetPid(serial), value => /^[0-9]+$/.test(value),
      BREAKPOINT_TIMEOUT_MS, driverDiagnostic);
    const jdwp = await waitUntil('target PID in adb jdwp',
      () => adb(serial, 'jdwp'), value => value.split(/\s+/).includes(pid),
      BREAKPOINT_TIMEOUT_MS, driverDiagnostic);
    assert(jdwp.split(/\s+/).includes(pid), 'exact target PID is not JDWP-visible');
    forward = (await adb(serial, 'forward', 'tcp:0', `jdwp:${pid}`)).trim();
    assert(/^[0-9]+$/.test(forward), `ADB did not allocate an exact JDWP port: ${forward}`);

    jdb = new JdbSession(jdk.jdb, forward);
    await jdb.wait(/Initializing jdb|VM Started|>\s*$/m);
    const setOutput = await jdb.command(`stop at ${COORDINATOR_CLASS}:${line}`,
      /Set breakpoint|Deferring breakpoint/);
    assert(/Set breakpoint|Deferring breakpoint/.test(setOutput),
      `jdb did not accept breakpoint ${line}`);
    const hitFrom = jdb.output.length;
    jdb.child.stdin.write('cont\n');
    const hit = await jdb.wait(/Breakpoint hit:[\s\S]*LegacyMutationCoordinator\.setThemeMode\(\), line=/,
      hitFrom);
    const exactHit = new RegExp(`Breakpoint hit:[\\s\\S]*${COORDINATOR_CLASS.replaceAll('.', '\\.')}\\.setThemeMode\\(\\), line=${line}\\b`);
    assert(exactHit.test(hit), `breakpoint hit wrong class/method/line\n${hit}`);
    const frame = await jdb.command('where', />\s*$/m);
    assert(new RegExp(`\\[1\\]\\s+${COORDINATOR_CLASS.replaceAll('.', '\\.')}\\.setThemeMode[\\s\\S]*:${line}\\)`).test(frame),
      `top frame did not confirm setThemeMode line ${line}\n${frame}`);
    assert(await exactTargetPid(serial) === pid, 'target PID changed while suspended');

    await adb(serial, 'shell', 'run-as', TARGET, '/system/bin/kill', '-9', pid);
    await waitUntil('exact suspended PID death',
      () => pidOutput(serial), value => value === '');
    exactPidDead = true;
    await waitChildExit(driver);
    return pid;
  } finally {
    if (jdb) jdb.close();
    if (forward) await adb(serial, 'forward', '--remove', `tcp:${forward}`).catch(() => {});
    if (driver?.child.exitCode === null) {
      driver.child.kill('SIGKILL');
      await waitChildExit(driver, 5_000).catch(() => {});
    }
    if (!exactPidDead) {
      await adb(serial, 'shell', 'am', 'force-stop', TARGET).catch(() => {});
      await adb(serial, 'shell', 'am', 'force-stop', TEST_PACKAGE).catch(() => {});
    }
    await adb(serial, 'shell', 'am', 'clear-debug-app').catch(() => {});
  }
}

async function runCrashCase(serial, jdk, crashCase, line, expected) {
  await clearExactTarget(serial);
  await runInstrumentation(serial, 'seedCrashCase', {
    protocol: 'T014_JDWP', crashCase,
  });
  const pid = await killAtBreakpoint(serial, jdk, crashCase, line);
  await runInstrumentation(serial, 'verifyCrashCase', {
    protocol: 'T014_JDWP', crashCase, crashExpected: expected,
  });
  console.log(`PASS ${crashCase} line=${line} killedPid=${pid} expected=${expected}`);
  await clearExactTarget(serial);
}

async function main() {
  const serial = parseSerial(process.argv.slice(2));
  await run(process.execPath, [resolve(root, 'scripts/verify-android-legacy-theme-writer.mjs')]);
  const avd = await verifyEmulator(serial);
  const jdk = await findJdk21();
  const lines = sourceLines();
  console.log(`TARGET serial=${serial} avd=${avd} package=${TARGET} jdk=${jdk.home}`);

  await clearExactTarget(serial);
  await runInstrumentation(serial, 'bridgeDiscoveryAppliedReaderAndNoOpAreExact');
  console.log('PASS ordinary JS discovery/applied/readSettings/no-op');
  await clearExactTarget(serial);

  await runCrashCase(serial, jdk, 'before-move', lines.beforeMove, 'OLD');
  await runCrashCase(serial, jdk, 'after-move', lines.afterMove, 'OLD_OR_CANDIDATE');
  await runCrashCase(serial, jdk, 'after-directory-fsync',
    lines.afterDirectoryFsync, 'CANDIDATE');
  console.log('PASS T014 host-controlled JDWP process-kill matrix');
  console.log('PHYSICAL_DEVICE SIGNING PLAY NOT_TOUCHED');
}

main().catch(error => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
