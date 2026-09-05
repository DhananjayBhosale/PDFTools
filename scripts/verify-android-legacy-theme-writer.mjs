#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const paths = {
  manifest: 'android/app/src/main/AndroidManifest.xml',
  activity: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java',
  mainApplication: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/PdfChefApplication.java',
  releaseApplication: 'android/app/src/release/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/PdfChefApplication.java',
  debugManifest: 'android/app/src/debug/AndroidManifest.xml',
  debugApplication: 'android/app/src/debug/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/PdfChefApplication.java',
  crashController: 'android/app/src/debug/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyThemeCrashController.java',
  crashService: 'android/app/src/debug/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/LegacyThemeCrashService.java',
  plugin: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterPlugin.java',
  inspectorPlugin: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacyInspectorPlugin.java',
  patcher: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyThemeModeWirePatcher.java',
  coordinator: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyMutationCoordinator.java',
  historyReader: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyHistoryInspector.java',
  settingsReader: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacySettingsInspector.java',
  contractTest: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterContractTest.java',
  patcherTest: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyThemeModeWirePatcherTest.java',
  coordinatorTest: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/LegacyMutationCoordinatorTest.java',
  instrumentedTest: 'android/app/src/androidTest/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterInstrumentedTest.java',
};

const frozen = new Map([
  [paths.patcher, '6f9a6ebf14838a1708ca48071f65a8c2cc63d0960a71979d12f888b07bea9d3c'],
  [paths.coordinator, '7691386d9ad31d15113c07cd99e23155613dc9d376852e7dffe9f78cbcb22c12'],
  [paths.historyReader, 'b0a26dba3f0fd8ef8a74ce9f9bc56b437c9297534fa38658ff42919863775f66'],
  [paths.settingsReader, 'bf4acfb0efd1e5199a6b540b43e7b99a55bbbf96b256ae49301998431d304827'],
  ['android/build.gradle', '7fbe17fc1bbcc57213ff3e358ba5beb94d29e1d5484e57d2970c1773fea4b8e3'],
  ['android/settings.gradle', '6ce098d15ebd69b44c4ecd786bca1bdc366340d2459b2af4d7bb0ab317aa9669'],
  ['android/gradle.properties', '3bab15c5b8bc4c2f4b6cf525497d15ad4abca53a460e6dd2eb0f0135817d31e6'],
]);

function bytes(path) {
  return readFileSync(resolve(root, path));
}

function text(path) {
  return bytes(path).toString('utf8');
}

function sha256(path) {
  return createHash('sha256').update(bytes(path)).digest('hex');
}

function filesUnder(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [path];
  const result = [];
  for (const entry of readdirSync(absolute)) {
    result.push(...filesUnder(`${path}/${entry}`));
  }
  return result;
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function count(haystack, needle) {
  let total = 0;
  for (let at = 0; (at = haystack.indexOf(needle, at)) !== -1; at += needle.length) total++;
  return total;
}

function sameMembers(actual, expected, label) {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  assert(JSON.stringify(left) === JSON.stringify(right),
    `${label}: expected ${right.join(', ')}, found ${left.join(', ')}`);
}

// Replaces comments, and optionally Java string/character literal bodies, while preserving
// newlines and token positions. This keeps checks immune to examples in comments/literals.
function maskJava(source, maskLiterals) {
  let state = 'code';
  let escaped = false;
  let output = '';
  for (let index = 0; index < source.length; index++) {
    const current = source[index];
    const next = source[index + 1];
    if (state === 'code' && current === '/' && next === '/') {
      output += '  '; index++; state = 'line'; continue;
    }
    if (state === 'code' && current === '/' && next === '*') {
      output += '  '; index++; state = 'block'; continue;
    }
    if (state === 'line') {
      output += current === '\n' ? '\n' : ' ';
      if (current === '\n') state = 'code';
      continue;
    }
    if (state === 'block') {
      if (current === '*' && next === '/') {
        output += '  '; index++; state = 'code';
      } else output += current === '\n' ? '\n' : ' ';
      continue;
    }
    if (state === 'code' && (current === '"' || current === "'")) {
      state = current === '"' ? 'string' : 'char';
      escaped = false;
      output += maskLiterals ? ' ' : current;
      continue;
    }
    if (state === 'string' || state === 'char') {
      output += maskLiterals && current !== '\n' ? ' ' : current;
      if (escaped) escaped = false;
      else if (current === '\\') escaped = true;
      else if ((state === 'string' && current === '"') || (state === 'char' && current === "'")) {
        state = 'code';
      }
      continue;
    }
    output += current;
  }
  assert(state !== 'block' && state !== 'string' && state !== 'char',
    'unterminated Java comment or literal');
  return output;
}

function compact(source) {
  return source.replace(/\s+/g, ' ').trim();
}

for (const [path, expected] of frozen) {
  const actual = sha256(path);
  assert(actual === expected, `frozen source drifted: ${path}\nexpected ${expected}\nactual   ${actual}`);
}

const manifest = text(paths.manifest).replace(/<!--[\s\S]*?-->/g, '');
assert(count(manifest, '<application') === 1, 'manifest must contain exactly one application element');
assert(count(manifest, 'android:name=".PdfChefApplication"') === 1,
  'manifest must declare exactly PdfChefApplication');
assert(!/android:process\s*=/.test(manifest), 'production manifest must not declare android:process');
const applicationTag = manifest.match(/<application\b[^>]*>/)?.[0] ?? '';
assert(/android:name\s*=\s*"\.PdfChefApplication"/.test(applicationTag),
  'PdfChefApplication must be the production application class');

const activitySource = text(paths.activity);
const activity = maskJava(activitySource, true);
assert(count(activity, 'registerPlugin(AndroidLegacyInspectorPlugin.class)') === 1,
  'MainActivity must register the inspector exactly once');
assert(count(activity, 'registerPlugin(AndroidLegacySettingsWriterPlugin.class)') === 1,
  'MainActivity must register the writer exactly once');
assert(count(activity, 'registerPlugin(AndroidDocumentsPlugin.class)') === 1,
  'MainActivity must register AndroidDocuments exactly once');
assert(count(activity, 'registerPlugin(AndroidDocumentScannerPlugin.class)') === 1,
  'MainActivity must register AndroidDocumentScanner exactly once');
assert(count(activity, 'registerPlugin(') === 4, 'MainActivity may register only the accepted four plugins');
const inspectorAt = activity.indexOf('registerPlugin(AndroidLegacyInspectorPlugin.class)');
const writerAt = activity.indexOf('registerPlugin(AndroidLegacySettingsWriterPlugin.class)');
const documentsAt = activity.indexOf('registerPlugin(AndroidDocumentsPlugin.class)');
const scannerAt = activity.indexOf('registerPlugin(AndroidDocumentScannerPlugin.class)');
const superAt = activity.indexOf('super.onCreate(savedInstanceState)');
assert(inspectorAt < writerAt && writerAt < documentsAt && documentsAt < scannerAt
  && scannerAt < superAt,
  'four plugins must register once, in accepted order, before bridge creation');
const onCreate = activity.match(/public\s+void\s+onCreate\s*\(android\.os\.Bundle\s+savedInstanceState\)\s*\{([\s\S]*?)\}/)?.[1];
assert(onCreate, 'MainActivity must declare the expected onCreate override');
assert(compact(onCreate) === compact(`
  registerPlugin(AndroidLegacyInspectorPlugin.class);
  registerPlugin(AndroidLegacySettingsWriterPlugin.class);
  registerPlugin(AndroidDocumentsPlugin.class);
  registerPlugin(AndroidDocumentScannerPlugin.class);
  super.onCreate(savedInstanceState);
`), 'MainActivity onCreate must contain registration only');

assert(!existsSync(resolve(root, paths.mainApplication)),
  'PdfChefApplication must be absent from src/main so build types cannot collide');

const releaseApplicationSource = text(paths.releaseApplication);
const releaseApplication = maskJava(releaseApplicationSource, true);
assert(count(releaseApplication, 'new LegacyMutationCoordinator()') === 1,
  'release Application must eagerly construct exactly one coordinator');
assert(/private\s+final\s+LegacyMutationCoordinator\s+legacyMutationCoordinator\s*=\s*new\s+LegacyMutationCoordinator\s*\(\s*\)\s*;/.test(releaseApplication),
  'release Application coordinator must be the accepted private final eager singleton');
assert(/public\s+LegacyMutationCoordinator\s+getLegacyMutationCoordinator\s*\(\s*\)\s*\{\s*return\s+legacyMutationCoordinator\s*;\s*\}/.test(releaseApplication),
  'release Application getter must return the same coordinator field');
assert(count(releaseApplication, 'new DocumentLifecycleCoordinator(this)') === 1,
  'release Application must own exactly one lazy document coordinator');
assert(/private\s+final\s+DocumentLifecycleCoordinator\s+documentLifecycleCoordinator\s*=\s*new\s+DocumentLifecycleCoordinator\s*\(\s*this\s*\)\s*;/.test(releaseApplication),
  'release document coordinator field must be private final and exact');
assert(/public\s+DocumentLifecycleCoordinator\s+getDocumentLifecycleCoordinator\s*\(\s*\)\s*\{\s*return\s+documentLifecycleCoordinator\s*;\s*\}/.test(releaseApplication),
  'release document getter must return the same coordinator');
assert(!/LegacyThemeCrash|killProcess|android:process|\bService\b|\bBinder\b/.test(releaseApplicationSource),
  'release Application must contain no crash-harness symbol');

const documentImport =
  'import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents.DocumentLifecycleCoordinator;\n';
const documentField = '    private final DocumentLifecycleCoordinator documentLifecycleCoordinator =\n'
  + '            new DocumentLifecycleCoordinator(this);\n';
const documentGetter = '    public DocumentLifecycleCoordinator getDocumentLifecycleCoordinator() {\n'
  + '        return documentLifecycleCoordinator;\n'
  + '    }\n';
for (const addition of [documentImport, documentField, documentGetter]) {
  assert(count(releaseApplicationSource, addition) === 1,
    'release document ownership must remain an exact additive block');
}
const normalizedReleaseApplication = releaseApplicationSource
  .replace(documentImport, '')
  .replace(documentField, '')
  .replace(documentGetter, '');
assert(createHash('sha256').update(normalizedReleaseApplication).digest('hex')
  === '1b993160a32c066437e5ec77c991608fc995000e56a9458d4e1cb85fb0f93c1c',
  'release Application must normalize to the accepted T014 source');

const debugApplicationSource = text(paths.debugApplication);
const debugApplication = maskJava(debugApplicationSource, true);
const debugFields = [...debugApplication.matchAll(/private\s+final\s+(LegacyThemeCrashController|LegacyMutationCoordinator|DocumentLifecycleCoordinator)\s+(\w+)\s*=/g)];
assert(debugFields.length === 3,
  'debug Application must own exactly one private-final controller and two coordinators');
sameMembers(debugFields.map(match => match[1]),
  ['DocumentLifecycleCoordinator', 'LegacyMutationCoordinator', 'LegacyThemeCrashController'], 'debug Application field types');
assert(count(debugApplication, 'new LegacyThemeCrashController()') === 1,
  'debug Application must eagerly create one initially disarmed controller');
assert(count(debugApplication, 'legacyThemeCrashController.createCoordinator()') === 1,
  'debug Application coordinator must be composed only through its controller decorator');
assert(!/new\s+LegacyMutationCoordinator\s*\(/.test(debugApplication),
  'debug Application must not construct an undecorated coordinator');
assert(/public\s+LegacyMutationCoordinator\s+getLegacyMutationCoordinator\s*\(\s*\)\s*\{\s*return\s+legacyMutationCoordinator\s*;\s*\}/.test(debugApplication),
  'debug Application production getter must return the decorated singleton');
assert(count(debugApplication, 'new DocumentLifecycleCoordinator(this)') === 1,
  'debug Application must own exactly one lazy document coordinator');
assert(/public\s+DocumentLifecycleCoordinator\s+getDocumentLifecycleCoordinator\s*\(\s*\)\s*\{\s*return\s+documentLifecycleCoordinator\s*;\s*\}/.test(debugApplication),
  'debug document getter must return the same coordinator');
assert(/(?:^|\})\s*LegacyThemeCrashController\s+getLegacyThemeCrashController\s*\(\s*\)\s*\{\s*return\s+legacyThemeCrashController\s*;\s*\}/m.test(debugApplication),
  'debug Application must expose exactly one package-private controller accessor');
assert(!/(?:public|protected|private)\s+LegacyThemeCrashController\s+getLegacyThemeCrashController/.test(debugApplication),
  'debug controller accessor must remain package-private');
sameMembers([...debugApplication.matchAll(/\b(?:public\s+)?(?:LegacyMutationCoordinator|LegacyThemeCrashController|DocumentLifecycleCoordinator)\s+(get\w+)\s*\(/g)]
  .map(match => match[1]), ['getDocumentLifecycleCoordinator', 'getLegacyMutationCoordinator', 'getLegacyThemeCrashController'],
  'debug Application accessors');
const debugDeclaredMethods = [...debugApplication.matchAll(
  /(?:public|protected|private)?\s*(?:static\s+)?(?:DocumentLifecycleCoordinator|LegacyMutationCoordinator|LegacyThemeCrashController|void)\s+(\w+)\s*\([^;{}]*\)\s*\{/g)]
  .map(match => match[1]);
sameMembers(debugDeclaredMethods,
  ['getDocumentLifecycleCoordinator', 'getLegacyMutationCoordinator', 'getLegacyThemeCrashController'],
  'debug Application declared methods');
const debugDocumentGetter = '\n' + documentGetter;
for (const addition of [documentImport, documentField, debugDocumentGetter]) {
  assert(count(debugApplicationSource, addition) === 1,
    'debug document ownership must remain an exact additive block');
}
const normalizedDebugApplication = debugApplicationSource
  .replace(documentImport, '')
  .replace(documentField, '')
  .replace(debugDocumentGetter, '');
assert(createHash('sha256').update(normalizedDebugApplication).digest('hex')
  === '97ed8976cb587db50a68fdf759d0cc71e026f6f746ea7efbe44bcb752a840a9f',
  'debug Application must normalize to the accepted T014 source');
for (const lifecycle of ['onCreate', 'onTerminate', 'onLowMemory', 'onTrimMemory',
  'registerActivityLifecycleCallbacks']) {
  assert(!new RegExp(`\\b${lifecycle}\\s*\\(`).test(releaseApplication),
    `release Application must not perform lifecycle work: ${lifecycle}`);
  assert(!new RegExp(`\\b${lifecycle}\\s*\\(`).test(debugApplication),
    `debug Application must not perform lifecycle work: ${lifecycle}`);
}
for (const io of ['getFilesDir', 'File', 'Path', 'Files', 'DataStore', 'read', 'write',
  'delete', 'move', 'copy', 'listFiles', 'mkdir', 'open']) {
  assert(!new RegExp(`\\b${io}\\b`).test(releaseApplication),
    `release Application must not perform launch/storage I/O: ${io}`);
  assert(!new RegExp(`\\b${io}\\b`).test(debugApplication),
    `debug Application must not perform launch/storage I/O: ${io}`);
}

const pluginSource = text(paths.plugin);
const pluginWithLiterals = maskJava(pluginSource, false);
const plugin = maskJava(pluginSource, true);
const pluginCompact = compact(pluginWithLiterals);
assert(count(plugin, '@PluginMethod') === 1, 'writer must expose exactly one PluginMethod');
assert(/@CapacitorPlugin\s*\(\s*name\s*=\s*"AndroidLegacySettingsWriter"\s*\)/.test(pluginWithLiterals),
  'writer plugin name drifted');
assert(/@PluginMethod\s+public\s+void\s+setThemeMode\s*\(\s*PluginCall\s+call\s*\)/.test(plugin),
  'writer must expose one promise setThemeMode(PluginCall) method');
assert(count(plugin, 'public void ') === 1, 'writer may not expose another public operation');

assert(/data\s*==\s*null\s*\|\|\s*data\.length\s*\(\s*\)\s*!=\s*1\s*\|\|\s*!data\.has\s*\(\s*"mode"\s*\)/.test(pluginWithLiterals),
  'writer must require exactly one own mode key');
const getAt = pluginWithLiterals.indexOf('Object rawMode = data.get("mode")');
const typeAt = plugin.indexOf('rawMode instanceof String');
const castAt = plugin.indexOf('String mode = (String) rawMode');
assert(getAt >= 0 && getAt < typeAt && typeAt < castAt,
  'writer must type-check data.get("mode") before casting');
for (const forbidden of ['getString(', '.trim(', 'Set.of(', 'equalsIgnoreCase(',
  'toUpperCase(', 'toLowerCase(']) {
  assert(!pluginWithLiterals.includes(forbidden), `coercing input API forbidden: ${forbidden}`);
}
for (const mode of ['SYSTEM', 'DYNAMIC', 'LIGHT', 'DARK']) {
  assert(count(pluginWithLiterals, `"${mode}".equals(mode)`) === 1,
    `writer must accept exact mode once: ${mode}`);
}

assert(count(plugin, 'getApplicationContext()') === 1,
  'writer must obtain the Application exactly once through applicationContext');
assert(/PdfChefApplication\s+application\s*=\s*\(PdfChefApplication\)\s*getContext\s*\(\s*\)\.getApplicationContext\s*\(\s*\)\s*;/.test(plugin),
  'writer coordinator ownership must flow through the Application cast');
assert(count(plugin, 'application.getLegacyMutationCoordinator()') === 1,
  'writer must obtain the coordinator only from PdfChefApplication');
assert(/\.setThemeMode\s*\(\s*application\.getFilesDir\s*\(\s*\)\s*,\s*mode\s*\)/.test(plugin),
  'writer must invoke only the coordinator theme operation with application filesDir');
assert(!/new\s+LegacyMutationCoordinator\s*\(/.test(plugin),
  'writer must never construct a coordinator');

const resultKeys = [...pluginWithLiterals.matchAll(/output\.put\s*\(\s*"([^"]+)"/g)]
  .map(match => match[1]);
assert(JSON.stringify(resultKeys) === JSON.stringify(['mode', 'changed']),
  `success result keys drifted: ${resultKeys.join(', ')}`);
assert(count(plugin, 'call.resolve(output)') === 1, 'writer must resolve exactly one result object');
assert(count(pluginCompact,
  'call.reject("Invalid theme mode.", "LEGACY_THEME_INVALID_ARGUMENT");') === 3,
  'all three invalid-input branches must use the fixed invalid rejection');
assert(count(pluginCompact,
  'call.reject("Theme update could not be completed.", failure.code);') === 1,
  'coordinator failures must preserve the exact stable code with a generic message');
assert(count(pluginCompact,
  'call.reject("Theme update could not be completed.", "LEGACY_THEME_WRITE_FAILED");') === 1,
  'unexpected failures must use the fixed generic write code');

const expectedCoordinatorCodes = [
  'LEGACY_SETTINGS_CONCURRENT_MODIFICATION',
  'LEGACY_SETTINGS_CORRUPT',
  'LEGACY_SETTINGS_TOO_LARGE',
  'LEGACY_SETTINGS_UNSAFE_PATH',
  'LEGACY_THEME_ATOMIC_MOVE_UNAVAILABLE',
  'LEGACY_THEME_CANCELLED',
  'LEGACY_THEME_DURABILITY_UNCERTAIN',
  'LEGACY_THEME_INVALID_ARGUMENT',
  'LEGACY_THEME_WRITE_FAILED',
];
sameMembers(text(paths.coordinator).match(/LEGACY_(?:SETTINGS|THEME)_[A-Z_]+/g) ?? [],
  expectedCoordinatorCodes, 'coordinator stable failure codes');

const coordinatorSource = text(paths.coordinator);
const coordinator = maskJava(coordinatorSource, true);
for (const forbidden of [/Checkpoint/, /\benum\s+Stage\b/, /\binterface\s+Stage\b/,
  /\bfire\s*\(/, /callback/i, /killProcess\s*\(/, /System\.exit\s*\(/,
  /Debug\.waitForDebugger\s*\(/]) {
  assert(!forbidden.test(coordinator), `release coordinator contains a test/pause seam: ${forbidden}`);
}
assert(/interface\s+AtomicIo\s*\{/.test(coordinator),
  'package-private AtomicIo JVM fault seam must remain');
assert(!/public\s+interface\s+AtomicIo/.test(coordinator), 'AtomicIo must not become public');
assert(/LegacyMutationCoordinator\s*\(\s*LegacyThemeModeWirePatcher\s+patcher\s*,\s*AtomicIo\s+io\s*\)/.test(coordinator),
  'coordinator must retain only its two-argument package-private JVM constructor');
assert(!/LegacyMutationCoordinator\s*\([^)]*,[^)]*,/.test(coordinator),
  'coordinator constructor may not accept a third callback/stage dependency');
const breakpointStatements = [
  'io.atomicMove(ownedTemp.path(), source);',
  'linearized = true;',
  'io.fsyncDirectory(directory);',
  'return new Result(mode, true);',
];
for (const statement of breakpointStatements) {
  assert(count(coordinatorSource, statement) === 1,
    `natural JDWP statement must be source-unique: ${statement}`);
}
const breakpointOrder = breakpointStatements.map(statement => coordinatorSource.indexOf(statement));
assert(breakpointOrder.every((value, index) => index === 0 || value > breakpointOrder[index - 1]),
  'natural JDWP statements must surround move/fsync in exact execution order');

const mainSources = filesUnder('android/app/src/main');
for (const path of mainSources) {
  if (!/\.(?:java|xml)$/.test(path)) continue;
  const source = text(path);
  assert(!/ThemeWriterProcessKillService|android\.os\.Process\.killProcess|\bkillProcess\s*\(/.test(source),
    `production source contains crash-harness code: ${path}`);
}

const debugManifest = text(paths.debugManifest).replace(/<!--[\s\S]*?-->/g, '');
assert(count(debugManifest, '<application') === 1,
  'debug overlay must contain exactly one application element');
assert(count(debugManifest, '<service') === 1,
  'debug overlay must declare exactly one service');
assert(count(debugManifest, 'android:name=".LegacyThemeCrashService"') === 1,
  'debug service must use the intentional parent-package FQCN');
assert(count(debugManifest, 'android:exported="false"') === 1,
  'debug crash service must be non-exported');
assert(count(debugManifest, 'android:process=":legacyThemeCrash"') === 1,
  'debug crash service must run in the one exact remote process');
assert(!/<intent-filter\b|<activity\b|<receiver\b|<provider\b/.test(debugManifest),
  'debug overlay may expose only the explicit non-exported crash service');

const crashControllerSource = text(paths.crashController);
const crashController = maskJava(crashControllerSource, true);
assert(/public\s+final\s+class\s+LegacyThemeCrashController\s+implements\s+LegacyMutationCoordinator\.AtomicIo/.test(crashController),
  'debug crash controller must be the AtomicIo decorator');
assert(count(crashController, 'new LegacyMutationCoordinator.SystemIo()') === 1,
  'debug crash controller must decorate exactly one existing SystemIo');
assert(/private\s+Stage\s+armedStage\s*;/.test(crashController),
  'debug crash controller must start disarmed');
assert(/private\s+boolean\s+coordinatorCreated\s*;/.test(crashController),
  'debug crash controller must enforce one coordinator composition');
assert(count(crashController, 'new LegacyMutationCoordinator(new LegacyThemeModeWirePatcher(), this)') === 1,
  'debug controller must compose the sole coordinator with itself as AtomicIo');
for (const stage of ['BEFORE_MOVE', 'AFTER_MOVE', 'AFTER_DIRECTORY_FSYNC']) {
  assert(count(crashControllerSource, `public static final String ${stage} = "${stage}";`) === 1,
    `debug crash controller stage contract drifted: ${stage}`);
}
assert(count(crashController, 'android.os.Process.killProcess(android.os.Process.myPid())') === 1,
  'debug crash controller must self-SIGKILL in one exact place');
const atomicMoveBody = crashController.match(/public\s+void\s+atomicMove\s*\([^)]*\)\s*[^\{]*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
const beforeCrashAt = atomicMoveBody.indexOf('crashIfArmed(Stage.BEFORE_MOVE)');
const delegateMoveAt = atomicMoveBody.indexOf('delegate.atomicMove(temp, source)');
const afterCrashAt = atomicMoveBody.indexOf('crashIfArmed(Stage.AFTER_MOVE)');
assert(beforeCrashAt >= 0 && beforeCrashAt < delegateMoveAt && delegateMoveAt < afterCrashAt,
  'debug crash controller must crash immediately before or after the delegated atomic move');
const fsyncBody = crashController.match(/public\s+void\s+fsyncDirectory\s*\([^)]*\)\s*[^\{]*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
assert(fsyncBody.indexOf('delegate.fsyncDirectory(directory)') >= 0
  && fsyncBody.indexOf('delegate.fsyncDirectory(directory)')
    < fsyncBody.indexOf('crashIfArmed(Stage.AFTER_DIRECTORY_FSYNC)'),
'datastore-directory crash must occur only after successful delegated fsync');
assert(/"datastore"\.equals\(directory\.getFileName\(\)\.toString\(\)\)/.test(crashControllerSource),
  'post-fsync crash must be limited to the datastore directory');
assert(!/listFiles\s*\(|DirectoryStream|deleteIfExists|Files\.delete|Files\.move|Files\.write|FileOutputStream/.test(crashController),
  'debug crash controller must not add cleanup, recovery, or persistence I/O');

const crashServiceSource = text(paths.crashService);
const crashService = maskJava(crashServiceSource, true);
assert(/package\s+com\.dhananjaytech\.zenpdf_allpdftoolsinoneplace\s*;/.test(crashService),
  'allowed legacy-path service must intentionally declare the parent Application package');
assert(/public\s+final\s+class\s+LegacyThemeCrashService\s+extends\s+Service/.test(crashService),
  'debug crash service shape drifted');
assert(count(crashService, 'new Binder()') === 1,
  'debug crash service must own one bounded Binder endpoint');
assert(/code\s*!=\s*TRANSACTION_CRASH/.test(crashService)
  && /data\.enforceInterface\(DESCRIPTOR\)/.test(crashService)
  && /data\.dataAvail\(\)\s*!=\s*0/.test(crashService),
'debug crash service must validate the exact transaction and payload shape');
assert(count(crashService, 'application.getLegacyThemeCrashController()') === 1,
  'service must arm only its process Application controller');
assert(count(crashService, 'application.getLegacyMutationCoordinator()') === 1,
  'service must invoke only its process Application coordinator');
assert(!/new\s+LegacyMutationCoordinator\s*\(/.test(crashService),
  'service must never construct a coordinator');
assert(/coordinator\.setThemeMode\s*\(\s*application\.getFilesDir\s*\(\s*\)\s*,\s*"DARK"\s*\)/.test(crashServiceSource),
  'service must invoke the one fixed theme operation without a path payload');
assert(!/getStringExtra|getParcelableExtra|Uri\b|\bFile\b|\bPath\b|onStartCommand|startService/.test(crashService),
  'service must not accept a path or expose a started-service protocol');
assert(!/\bLog\.|printStackTrace|getMessage\s*\(|getCause\s*\(|toString\s*\(\s*\)/.test(crashService),
  'debug crash service must emit only fixed generic failures');
assert(!/\bLog\.|printStackTrace|getMessage\s*\(|getCause\s*\(/.test(crashController),
  'debug crash controller must not log or leak failures');

const exactDebugFiles = [paths.debugManifest, paths.debugApplication,
  paths.crashController, paths.crashService];
sameMembers(filesUnder('android/app/src/debug').filter(path => /\.(?:java|kt|xml)$/.test(path)),
  exactDebugFiles, 'exact debug harness files');
const harnessAllowed = new Set([...exactDebugFiles, paths.contractTest, paths.instrumentedTest]);
for (const path of filesUnder('android/app/src')) {
  if (!/\.(?:java|kt|xml)$/.test(path) || harnessAllowed.has(path)) continue;
  assert(!/LegacyThemeCrashController|LegacyThemeCrashService|legacyThemeCrash|killProcess\s*\(/.test(text(path)),
    `debug crash harness escaped its exact allowlist: ${path}`);
}
const androidTestManifest = 'android/app/src/androidTest/AndroidManifest.xml';
if (existsSync(resolve(root, androidTestManifest))) {
  const source = text(androidTestManifest).replace(/<!--[\s\S]*?-->/g, '');
  assert(!/ThemeWriterProcessKillService|LegacyThemeCrashService|legacyThemeCrash|killProcess/.test(source),
    'androidTest manifest must not declare a crash service or process');
  assert((source.match(/<service\b/g) ?? []).length === 1
    && source.includes('DocumentRecipientProbeService')
    && source.includes('android:process=":recipient"'),
    'androidTest manifest may contain only the accepted T040 recipient service');
}
assert(!/android\.os\.Process\.killProcess|\bkillProcess\s*\(/.test(text(paths.instrumentedTest)),
  'default-process instrumentation must survive and must never own the kill mechanism');

const bridgeCode = [activity, releaseApplication, plugin].join('\n');
const forbiddenBridgePatterns = new Map([
  ['DataStore construction', /\bDataStore\b|PreferenceDataStoreFactory|DataStoreFactory/],
  ['full-map serialization', /PreferencesProto|\.toBuilder\s*\(|\.newBuilder\s*\(|\.writeTo\s*\(|\.toByteArray\s*\(/],
  ['direct overwrite', /FileOutputStream|Files\.write|TRUNCATE_EXISTING|renameTo\s*\(/],
  ['non-atomic move fallback', /StandardCopyOption|ATOMIC_MOVE|Files\.move/],
  ['copy or backup', /Files\.copy|copyTo\s*\(|backup/i],
  ['temporary-file sweep', /listFiles\s*\(|DirectoryStream|deleteIfExists|\.delete\s*\(/],
  ['split lock or executor', /new\s+(?:ReentrantLock|Object|Executor|Thread)|Executors\.|Mutex/],
]);
for (const [label, pattern] of forbiddenBridgePatterns) {
  assert(!pattern.test(bridgeCode), `bridge slice contains forbidden ${label}`);
}
for (const leak of [/\bLog\./, /\bLogger\./, /printStackTrace\s*\(/,
  /getMessage\s*\(/, /getCause\s*\(/, /failure\.toString\s*\(/,
  /ignored\.toString\s*\(/, /call\.reject\s*\([^;]*(?:failure|ignored)\s*[,)]/]) {
  assert(!leak.test(plugin), `writer may log or leak exception details: ${leak}`);
}

const inspector = maskJava(text(paths.inspectorPlugin), true);
assert(!/\bsetThemeMode\s*\(/.test(inspector), 'read-only inspector must not expose writer methods');
sameMembers([...inspector.matchAll(/public\s+void\s+(\w+)\s*\(\s*PluginCall/g)].map(match => match[1]),
  ['readHistory', 'readSettings'], 'read-only inspector methods');

const contractTest = maskJava(text(paths.contractTest), true);
const requiredTests = [
  'buildTypeApplicationsPreserveReleaseAndDebugOwnershipContracts',
  'mainActivityAndManifestWiringAreFrozen',
  'pluginDeclaresExactlyOnePromiseMethod',
  'pluginInputParsingIsStrictAndNonCoercing',
  'readOnlyInspectorExposesNoWriterMethod',
  'successAndFailureWireContractIsFrozen',
];
const contractTests = [...contractTest.matchAll(/@Test\s+public\s+void\s+(\w+)\s*\(/g)]
  .map(match => match[1]);
assert(contractTests.length === 6, `contract test count drifted: ${contractTests.length}`);
sameMembers(contractTests, requiredTests, 'required writer contract tests');
assert((maskJava(text(paths.patcherTest), true).match(/@Test\b/g) ?? []).length === 15,
  'patcher JVM test count drifted');
assert((maskJava(text(paths.coordinatorTest), true).match(/@Test\b/g) ?? []).length === 15,
  'coordinator JVM test count drifted');

const coordinatorTest = maskJava(text(paths.coordinatorTest), true);
assert(!/\bCheckpoint\b|\bStage\b|\bfire\s*\(/.test(coordinatorTest),
  'coordinator JVM tests must inject only through AtomicIo');
for (const required of ['FaultingIo implements LegacyMutationCoordinator.AtomicIo',
  'InterruptPoint.AFTER_READ', 'InterruptPoint.DURING_WRITE',
  'InterruptPoint.BEFORE_MOVE', 'InterruptPoint.AFTER_MOVE']) {
  assert(text(paths.coordinatorTest).includes(required),
    `coordinator AtomicIo fault proof missing: ${required}`);
}

const instrumentedSource = text(paths.instrumentedTest);
const instrumented = maskJava(instrumentedSource, true);
const instrumentedMethods = [...instrumented.matchAll(/@Test\s+public\s+void\s+(\w+)\s*\(/g)]
  .map(match => match[1]);
sameMembers(instrumentedMethods, [
  'bridgeDiscoveryAppliedReaderAndNoOpAreExact',
  'remoteProcessCrashStagesAreAtomicAndReaderDoesNotRecover',
], 'instrumentation protocol methods');
for (const required of [
  "Capacitor.isPluginAvailable('AndroidLegacySettingsWriter')",
  "AndroidLegacySettingsWriter.setThemeMode({mode:'DARK'})",
  'AndroidLegacyInspector.readSettings()',
  'application.getLegacyMutationCoordinator()',
  'new ComponentName(TARGET_PACKAGE, CRASH_SERVICE)',
  'context.bindService(intent, connection, Context.BIND_AUTO_CREATE)',
  'binder.transact(TRANSACTION_CRASH, data, reply, 0)',
  'binderDeath.await(WEB_TIMEOUT_SECONDS, TimeUnit.SECONDS)',
  'LegacyThemeCrashController.BEFORE_MOVE, false',
  'LegacyThemeCrashController.AFTER_MOVE, true',
  'LegacyThemeCrashController.AFTER_DIRECTORY_FSYNC, true',
  'remote crash process must remain dead before raw verification',
  'Refusing pre-existing unowned state',
  'ro.kernel.qemu',
  'ro.boot.qemu.avd_name',
  'emulator-[0-9]+',
  'launch and accepted reader perform no recovery or cleanup',
  'cleanupExactOwnedState(source)',
]) {
  assert(instrumentedSource.includes(required), `instrumentation contract missing: ${required}`);
}
assert(!/new\s+LegacyMutationCoordinator\s*\(/.test(instrumented),
  'crash driver must use the exact PdfChefApplication coordinator');
assert(instrumentedSource.indexOf('byte[] observedBeforeReader = read(source);')
  < instrumentedSource.indexOf('ActivityScenario.launch(MainActivity.class)',
    instrumentedSource.indexOf('void runRemoteCrashCase')),
'independent verifier must inspect bytes before launching the reader');
assert(instrumentedSource.indexOf('cleanupExactOwnedState(source)')
  > instrumentedSource.indexOf('assertArrayEquals(observedBeforeReader, read(source))'),
'test-owned cleanup must happen only after raw and reader preservation assertions');
for (const fixtureProof of ['unknownTop', 'nonTarget', 'firstTheme', 'selectedPayload',
  'overlongLengthDelimitedField']) {
  assert(instrumentedSource.includes(fixtureProof),
    `synthetic raw preservation fixture missing: ${fixtureProof}`);
}
assert(!/android\.os\.Process\.killProcess|\bkillProcess\s*\(/.test(instrumented),
  'instrumentation APK must not own the crash mechanism');

let releaseManifestChecked = false;
for (const path of filesUnder('android/app/build/intermediates')) {
  if (!/release/i.test(path) || !/AndroidManifest\.xml$/.test(path)) continue;
  const source = text(path).replace(/<!--[\s\S]*?-->/g, '');
  assert(!/<instrumentation\b|LegacyThemeCrashService|LegacyThemeCrashController|legacyThemeCrash|android:process|android:debuggable="true"/.test(source),
    `release merged manifest contains a debug/crash surface: ${path}`);
  releaseManifestChecked = true;
}
let releaseDexChecked = false;
for (const path of filesUnder('android/app/build/intermediates')) {
  if (!/release/i.test(path) || !/\.dex$/.test(path)) continue;
  const binary = bytes(path).toString('latin1');
  assert(!/LegacyThemeCrashService|LegacyThemeCrashController|legacyThemeCrash|AndroidLegacySettingsWriterInstrumentedTest|LegacyMutationCoordinator\$Checkpoint|LegacyMutationCoordinator\$Stage|killProcess/.test(binary),
    `release dex contains a test/crash seam: ${path}`);
  releaseDexChecked = true;
}

console.log('PASS android legacy theme writer static contract');
for (const [path] of frozen) console.log(`FROZEN ${sha256(path)}  ${path}`);
for (const path of [paths.manifest, paths.activity, paths.releaseApplication,
  paths.debugManifest, paths.debugApplication, paths.crashController, paths.crashService,
  paths.plugin, paths.contractTest, paths.instrumentedTest,
  'scripts/verify-android-legacy-theme-writer.mjs']) {
  console.log(`SLICE  ${sha256(path)}  ${path}`);
}
console.log(`JVM_CONTRACT_TEST_METHODS ${contractTests.length}`);
console.log(`INSTRUMENTATION_PROTOCOL_METHODS ${instrumentedMethods.length}`);
console.log(`RELEASE_MERGED_MANIFEST ${releaseManifestChecked ? 'PASS' : 'NOT_CHECKED'}`);
console.log(`RELEASE_DEX_EXCLUSION ${releaseDexChecked ? 'PASS' : 'NOT_CHECKED'}`);
console.log('RUNTIME_BRIDGE_AND_REMOTE_CRASH NOT_CHECKED');
console.log('DEVICE_SIGNING_PLAY NOT_CHECKED');
