import assert from 'node:assert/strict';
import test from 'node:test';

import { __test } from '../functions/api/deploy-pages-and-wait.ts';

const pendingProbe = {
  ready: false,
  siteUrl: 'https://guiadoproprietario.pt/novidades/exemplo/',
  siteStatus: 404,
  shareUrl: 'https://guiadoproprietario.pt/share/noticias/exemplo/',
  shareStatus: null,
  imageUrl: '',
  imageStatus: null,
};

function gateInput(requireSuccess) {
  return {
    branch: 'main',
    commitSha: 'a'.repeat(40),
    deploymentId: '',
    requireSuccess,
    probeUrl: pendingProbe.siteUrl,
  };
}

test('as tentativas intermédias continuam com 202 e a última bloqueia com 504', async () => {
  const intermediate = __test.pendingResponse(gateInput(false), pendingProbe);
  assert.equal(intermediate.status, 202);
  assert.equal((await intermediate.json()).error, 'public_assets_still_pending');

  const final = __test.pendingResponse(gateInput(true), pendingProbe);
  assert.equal(final.status, 504);
  assert.equal((await final.json()).error, 'public_assets_not_ready_before_final_gate');
});

test('uma chamada pública presa respeita o deadline do gate', async (context) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  context.after(() => { globalThis.fetch = originalFetch; });

  const startedAt = Date.now();
  const result = await __test.waitForPublicReadiness(pendingProbe.siteUrl, startedAt + 40);

  assert.equal(result.ready, false);
  assert.ok(Date.now() - startedAt < 500, 'o probe ultrapassou o deadline de teste');
});

test('a janela do endpoint deixa margem antes do timeout de 95 segundos do Make', () => {
  assert.ok(__test.limits.waitWindowMs <= 70_000);
  assert.ok(__test.limits.fetchTimeoutMs <= 8_000);
});
