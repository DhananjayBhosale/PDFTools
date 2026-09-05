import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const endpoint = process.argv[2];
const holdAfterMultiDelete = process.argv.includes('--hold-after-multi-delete');
if (!endpoint || !/^ws:\/\/127\.0\.0\.1:[1-9][0-9]{1,4}\/devtools\/page\/[A-F0-9]+$/.test(endpoint)) {
  throw new Error('Usage: node tests/ui/run-t906-emulator-qa.mjs ws://127.0.0.1:<port>/devtools/page/<id>');
}

const output = resolve('output/t906-android-final');
await mkdir(output, { recursive: true });

const socket = new WebSocket(endpoint);
const pending = new Map();
let nextId = 1;

await new Promise((resolveOpen, rejectOpen) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', rejectOpen, { once: true });
});

socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});

const command = (method, params = {}) => new Promise((resolveCommand, rejectCommand) => {
  const id = nextId++;
  pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
  socket.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expression) => {
  const result = await command('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
};

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

const waitFor = async (expression, label, timeout = 12_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
};

const controlExpression = (name) => `([...document.querySelectorAll('button,[role="button"]')].find((element) => {
  const aria = (element.getAttribute('aria-label') || '').trim();
  const text = (element.textContent || '').trim().replace(/\\s+/g, ' ');
  return aria === ${JSON.stringify(name)} || text === ${JSON.stringify(name)};
}))`;

const clickControl = async (name) => {
  const expression = controlExpression(name);
  await waitFor(expression, `control ${name}`);
  const clicked = await evaluate(`(() => { const element = ${expression}; if (!element) return false; element.click(); return true; })()`);
  if (!clicked) throw new Error(`Could not click ${name}.`);
};

const exactTextExpression = (text) => `([...document.querySelectorAll('body *')].some((element) => {
  if (element.children.length) return false;
  return (element.textContent || '').trim().replace(/\\s+/g, ' ') === ${JSON.stringify(text)};
}))`;

const waitForText = (text) => waitFor(exactTextExpression(text), `text ${text}`);

const capture = async (name) => {
  await sleep(250);
  const result = await command('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(resolve(output, name), Buffer.from(result.data, 'base64'));
};

const pdf = Buffer.from('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF').toString('base64');

const createOwned = (displayName) => evaluate(`(async () => {
  const documents = globalThis.Capacitor?.Plugins?.AndroidDocuments;
  if (!documents) throw new Error('AndroidDocuments is unavailable.');
  const started = await documents.beginWrite({ mimeType: 'application/pdf', displayName: ${JSON.stringify(displayName)} });
  await documents.appendWrite({ sessionRef: started.sessionRef, data: ${JSON.stringify(pdf)} });
  return (await documents.finishWrite({ sessionRef: started.sessionRef })).item.ref;
})()`);

try {
  await command('Runtime.enable');
  await command('Page.enable');
  await waitFor('globalThis.Capacitor?.Plugins?.AndroidDocuments', 'AndroidDocuments bridge');

  for (const label of ['Get started', 'Continue', 'Start using PDF Chef', 'Done']) {
    const expression = controlExpression(label);
    if (await evaluate(`Boolean(${expression})`)) {
      await evaluate(`(${expression}).click()`);
      break;
    }
  }

  await createOwned('Undo Alpha.pdf');
  await createOwned('Undo Beta.pdf');

  await evaluate(`history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')); true`);
  await sleep(250);
  await evaluate(`history.pushState({}, '', '/recent'); dispatchEvent(new PopStateEvent('popstate')); true`);
  await waitForText('Recent');
  await waitForText('Undo Alpha.pdf');
  await waitForText('Undo Beta.pdf');
  await capture('01-recent-owned.png');

  await clickControl('More actions for Undo Alpha.pdf');
  await clickControl('Rename');
  await waitFor(`document.querySelector('#recent-rename')`, 'rename field');
  await evaluate(`(() => {
    const input = document.querySelector('#recent-rename');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setValue.call(input, 'Renamed Alpha');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await clickControl('Save name');
  await waitForText('Renamed Alpha.pdf');
  await capture('02-renamed.png');

  await clickControl('More actions for Renamed Alpha.pdf');
  await clickControl('Delete');
  await waitForText('Deleted Renamed Alpha.pdf.');
  await waitFor(controlExpression('Undo delete'), 'single Undo action');
  if (await evaluate(exactTextExpression('Delete this result?'))) {
    throw new Error('A reversible durable deletion incorrectly opened the permanent confirmation.');
  }
  await capture('03-deleted-undo-offered.png');

  await clickControl('Undo delete');
  await waitForText('Restored Renamed Alpha.pdf.');
  await waitForText('Renamed Alpha.pdf');
  await capture('04-restored.png');

  await clickControl('Select');
  await clickControl('Select Renamed Alpha.pdf');
  await clickControl('Select Undo Beta.pdf');
  await clickControl('Delete selected');
  await waitForText('Deleted 2 results.');
  await waitFor(controlExpression('Undo delete for 2 results'), 'selected Undo action');
  await capture('05-selected-deleted.png');

  if (holdAfterMultiDelete) {
    const checkpoint = await evaluate(`(() => {
      const undo = [...document.querySelectorAll('button')].find((element) =>
        (element.getAttribute('aria-label') || '') === 'Undo delete for 2 results');
      const status = undo?.closest('[role="status"]');
      const rect = undo?.getBoundingClientRect();
      return {
        statusText: status?.innerText || null,
        undoRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      };
    })()`);
    console.log(JSON.stringify({ checkpoint: 'multi-delete', ...checkpoint }));
    await sleep(20_000);
  }

  await clickControl('Undo delete for 2 results');
  await waitForText('Restored 2 results.');
  await waitForText('Renamed Alpha.pdf');
  await waitForText('Undo Beta.pdf');
  await capture('06-selected-restored.png');

  const viewport = await evaluate(`({ width: innerWidth, height: innerHeight, devicePixelRatio })`);
  console.log(JSON.stringify({
    result: 'PASS',
    viewport,
    screenshots: [
      '01-recent-owned.png',
      '02-renamed.png',
      '03-deleted-undo-offered.png',
      '04-restored.png',
      '05-selected-deleted.png',
      '06-selected-restored.png',
    ],
  }));
} finally {
  await evaluate(`(async () => {
    try { await globalThis.Capacitor?.Plugins?.AndroidDocuments?.clearOwned({}); } catch { /* test cleanup */ }
    return true;
  })()`).catch(() => undefined);
  socket.close();
}
