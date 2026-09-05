#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [mode, ref = ''] = process.argv.slice(2);
const endpoint = process.env.PDF_CHEF_CDP_ENDPOINT ?? 'http://127.0.0.1:9223';

const targets = await (await fetch(`${endpoint}/json`)).json();
const target = targets.find(value => value.type === 'page'
  && typeof value.url === 'string' && value.url.startsWith('https://localhost/'));
if (!target?.webSocketDebuggerUrl) throw new Error('Packaged PDF Chef WebView target unavailable.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  socket.onopen = resolveOpen;
  socket.onerror = rejectOpen;
});
let sequence = 0;
const pending = new Map();
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
};
const request = (method, params) => new Promise((resolveRequest, rejectRequest) => {
  const id = ++sequence;
  pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const response = await request('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text ?? 'WebView evaluation failed.');
  }
  return response.result?.value;
};

let result;
if (mode === 'discovery') {
  result = await evaluate(`(async()=>({
    origin: location.origin,
    path: location.pathname,
    documents: Capacitor.isPluginAvailable('AndroidDocuments'),
    scanner: Capacitor.isPluginAvailable('AndroidDocumentScanner'),
    metadata: Capacitor.isPluginAvailable('AndroidAppMetadata'),
    storage: Capacitor.isPluginAvailable('AndroidStorageStats'),
    legacy: Capacitor.isPluginAvailable('AndroidLegacyInspector'),
    legacySettings: Capacitor.isPluginAvailable('AndroidLegacySettingsWriter'),
    metadataValue: await Capacitor.Plugins.AndroidAppMetadata.getMetadata({}),
    storageValue: await Capacitor.Plugins.AndroidStorageStats.getStorageStats({}),
  }))()`);
} else if (mode === 'create') {
  const pdf = readFileSync(resolve(root, 'output/qa-assets/qa-single.pdf')).toString('base64');
  result = await evaluate(`(async()=>{
    const begun=await Capacitor.Plugins.AndroidDocuments.beginWrite({
      displayName:'T921 R8 Reader.pdf',mimeType:'application/pdf'});
    const appended=await Capacitor.Plugins.AndroidDocuments.appendWrite({
      sessionRef:begun.sessionRef,data:${JSON.stringify(pdf)}});
    const finished=await Capacitor.Plugins.AndroidDocuments.finishWrite({
      sessionRef:begun.sessionRef});
    const listed=await Capacitor.Plugins.AndroidDocuments.listOwned({});
    return {begun,appended,finished,listed};
  })()`);
} else if (mode === 'open') {
  if (!/^d1_[A-Za-z0-9_-]{22,64}$/.test(ref)) throw new Error('Canonical d1 ref required.');
  result = await evaluate(`Capacitor.Plugins.AndroidDocuments.openReader({
    ref:${JSON.stringify(ref)},displayName:'T921 R8 Reader.pdf'})`);
} else if (mode === 'delete') {
  if (!/^d1_[A-Za-z0-9_-]{22,64}$/.test(ref)) throw new Error('Canonical d1 ref required.');
  result = await evaluate(`(async()=>({
    deleted:await Capacitor.Plugins.AndroidDocuments.deleteOwned({ref:${JSON.stringify(ref)}}),
    listed:await Capacitor.Plugins.AndroidDocuments.listOwned({}),
  }))()`);
} else if (mode === 'recent') {
  result = await evaluate(`(async()=>{
    history.pushState({},'', '/recent');
    dispatchEvent(new PopStateEvent('popstate'));
    await new Promise(resolveWait=>setTimeout(resolveWait,750));
    return {path:location.pathname,text:document.body.innerText};
  })()`);
} else {
  throw new Error('Usage: run-android-minified-qa-cdp.mjs discovery|create|open <d1_ref>|delete <d1_ref>|recent');
}

socket.close();
console.log(JSON.stringify(result));
