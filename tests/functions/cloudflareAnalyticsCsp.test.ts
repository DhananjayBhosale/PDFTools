import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequest } from '../../functions/_middleware.js';

const shell = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; connect-src 'self' data: blob:"></head><body></body></html>`;

const runMiddleware = async (url: string) => onRequest({
  request: new Request(url),
  next: async () => new Response(shell, { headers: { 'content-type': 'text/html; charset=UTF-8' } }),
});

test('the production website narrowly permits Cloudflare Web Analytics', async () => {
  const response = await runMiddleware('https://pdfchef.dhananjaytech.app/edit');
  const html = await response.text();

  assert.match(html, /script-src 'self' https:\/\/static\.cloudflareinsights\.com/);
  assert.match(html, /connect-src 'self' data: blob: https:\/\/cloudflareinsights\.com/);
  assert.equal((html.match(/static\.cloudflareinsights\.com/g) ?? []).length, 1);
  assert.equal((html.match(/https:\/\/cloudflareinsights\.com/g) ?? []).length, 1);
});

test('preview deployments retain the packaged self-only policy', async () => {
  const response = await runMiddleware('https://example.pdftools.pages.dev/edit');
  const html = await response.text();

  assert.doesNotMatch(html, /cloudflareinsights/);
  assert.match(html, /script-src 'self'; connect-src 'self' data: blob:/);
});
