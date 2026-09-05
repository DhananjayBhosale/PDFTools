#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const requireMatch = (text, pattern, label) => {
  if (!pattern.test(text)) throw new Error(`Missing ${label}`);
};
const requireAbsent = (text, pattern, label) => {
  if (pattern.test(text)) throw new Error(`Forbidden ${label}`);
};
const occurrences = (text, value) => text.split(value).length - 1;
const sha256Text = text => createHash('sha256').update(text).digest('hex');

const activity = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java');
const policy = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/security/PdfChefWebViewPolicy.java');
const config = read('capacitor.config.ts');

const inspector = 'registerPlugin(AndroidLegacyInspectorPlugin.class)';
const writer = 'registerPlugin(AndroidLegacySettingsWriterPlugin.class)';
const documents = 'registerPlugin(AndroidDocumentsPlugin.class)';
const scanner = 'registerPlugin(AndroidDocumentScannerPlugin.class)';
const bridge = 'super.onCreate(savedInstanceState)';
if (![inspector, writer, documents, scanner, bridge].every((needle) => activity.includes(needle))) {
  throw new Error('accepted registrations and bridge creation must remain explicit');
}
if (!(activity.indexOf(inspector) < activity.indexOf(writer)
  && activity.indexOf(writer) < activity.indexOf(documents)
  && activity.indexOf(documents) < activity.indexOf(scanner)
  && activity.indexOf(scanner) < activity.indexOf(bridge))) {
  throw new Error('Inspector, SettingsWriter, AndroidDocuments, then scanner must precede bridge creation');
}
if ((activity.match(/registerPlugin\(/g) ?? []).length !== 4) {
  throw new Error('MainActivity may register exactly the accepted four plugins');
}
const documentsImport =
  'import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents.AndroidDocumentsPlugin;\n';
const documentsRegistration = '        registerPlugin(AndroidDocumentsPlugin.class);\n';
const scannerImport =
  'import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.scanner.AndroidDocumentScannerPlugin;\n';
const scannerRegistration = '        registerPlugin(AndroidDocumentScannerPlugin.class);\n';
if (occurrences(activity, documentsImport) !== 1
  || occurrences(activity, documentsRegistration) !== 1
  || occurrences(activity, scannerImport) !== 1
  || occurrences(activity, scannerRegistration) !== 1) {
  throw new Error('AndroidDocuments and scanner must be the four exact additive MainActivity lines');
}
const normalizedActivity = activity
  .replace(documentsImport, '')
  .replace(documentsRegistration, '')
  .replace(scannerImport, '')
  .replace(scannerRegistration, '');
if (sha256Text(normalizedActivity)
  !== 'e686675ebe6d29a695dfdf3fe8d20d4d6435c5fa439b77d7a88088ccec0e7ba5') {
  throw new Error('MainActivity does not normalize to the accepted T034 source');
}

requireMatch(config, /allowMixedContent:\s*false/, 'Capacitor mixed-content configuration');
requireAbsent(config, /server\s*:\s*\{[^}]*url\s*:/s, 'remote Capacitor server URL');
requireAbsent(config, /allowNavigation\s*:/, 'Capacitor navigation allowlist');
requireMatch(policy, /PACKAGED_ORIGIN\s*=\s*"https:\/\/localhost"/, 'fixed packaged HTTPS localhost origin');
for (const [method, label] of [
  ['setMixedContentMode\\(WebSettings\\.MIXED_CONTENT_NEVER_ALLOW\\)', 'mixed content block'],
  ['setAllowFileAccess\\(false\\)', 'file access block'],
  ['setAllowContentAccess\\(false\\)', 'content access block'],
  ['setAllowFileAccessFromFileURLs\\(false\\)', 'file URL access block'],
  ['setAllowUniversalAccessFromFileURLs\\(false\\)', 'universal file URL block'],
  ['setJavaScriptCanOpenWindowsAutomatically\\(false\\)', 'JavaScript popup block'],
  ['setSupportMultipleWindows\\(false\\)', 'multiple-window block'],
  ['WebView\\.setWebContentsDebuggingEnabled\\(false\\)', 'WebView debugging block'],
]) requireMatch(policy, new RegExp(method), label);

requireMatch(activity, /bridge\.setWebViewClient\(new PdfChefWebViewClient\(bridge\)\)/, 'policy WebView client installation');
requireMatch(activity, /config = CapConfig\.loadDefault\(this\)[\s\S]*PdfChefWebViewPolicy\.apply\(webView\);\s*super\.load\(\);/, 'pre-bridge WebView hardening');
requireMatch(activity, /!PdfChefWebViewPolicy\.isTrustedConfig\(bridge\.getConfig\(\)\)[\s\S]*!PdfChefWebViewPolicy\.isPackagedOrigin\(bridge\.getAppUrl\(\)\)/, 'fail-closed configured bridge origin');
requireMatch(activity, /OPEN_EXTERNAL_BROWSER[\s\S]*startActivity\(new Intent\(Intent\.ACTION_VIEW, request\.getUrl\(\)\)\)/, 'visible external HTTP(S) link handoff');
requireMatch(policy, /"mailto"\.equals\(scheme\)/, 'existing email-link handoff');
requireMatch(activity, /ServiceWorkerController\.getInstance\(\)\.setServiceWorkerClient/, 'service-worker request boundary');
requireMatch(activity, /onPageStarted[\s\S]*!PdfChefWebViewPolicy\.isPackagedOrigin\(url\)[\s\S]*view\.stopLoading\(\)/, 'redirect fail-closed guard');
requireMatch(activity, /return blockedResponse\(\)/, 'remote subresource block');
requireAbsent(activity, /bridge\.launchIntent\(/, 'Capacitor broad intent launcher');

console.log('WEBVIEW_SECURITY_VERIFIER: PASS');
