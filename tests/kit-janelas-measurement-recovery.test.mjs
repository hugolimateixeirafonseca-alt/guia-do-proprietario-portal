import assert from 'node:assert/strict';
import test from 'node:test';
import { kitMeasurement } from '../src/lib/kit-janelas-measurement.mjs';
import { deliverKitRegistration, kitMetaFailureCode } from '../src/lib/kit-janelas-meta-delivery.mjs';

const now = Date.now();
const consent = measurement => 'gp_cookie_preferences=' + encodeURIComponent(JSON.stringify({
  version: '2026-09-01-1', measurement, savedAt: new Date(now).toISOString()
}));
const options = {
  accessToken: 'fake-test-token', eventName: 'CompleteRegistration', eventId: 'test-registration',
  eventSourceUrl: 'https://guiadoproprietario.pt/kit-trocar-janelas/', email: 'test@example.com'
};

test('clique só gera fbc com consentimento, sem inventar identificadores', () => {
  const url = 'https://guiadoproprietario.pt/kit-trocar-janelas/?fbclid=Example_123-abc';
  assert.equal(kitMeasurement(consent(false), now, url), null);
  assert.equal(kitMeasurement('', now, url), null);
  assert.equal(kitMeasurement(consent(true), now, url).metaFbc, `fb.1.${now}.Example_123-abc`);
  assert.equal(kitMeasurement(consent(true), now, url.split('?')[0]).metaFbc, '');
  assert.equal(kitMeasurement(consent(true), now, url + '%20invalid').metaFbc, '');
});

test('conserva cookie do mesmo clique e substitui apenas por novo clique válido', () => {
  const cookie = consent(true) + '; _fbc=fb.1.1700000000000.old; _fbp=fb.1.1700000000000.browser';
  assert.equal(kitMeasurement(cookie, now, 'https://example.com/?fbclid=old').metaFbc, 'fb.1.1700000000000.old');
  assert.equal(kitMeasurement(cookie, now, 'https://example.com/?fbclid=new').metaFbc, `fb.1.${now}.new`);
  assert.equal(kitMeasurement(cookie, now).metaFbp, 'fb.1.1700000000000.browser');
});

test('recupera falha transitória com o mesmo evento e instante, sem enviar email de novo', async () => {
  const payloads = [], delays = [];
  const result = await deliverKitRegistration({ ...options, fetchImpl: async (_url, init) => {
    payloads.push(JSON.parse(init.body));
    return payloads.length === 1 ? Response.json({ error: { code: 2, is_transient: true } }, { status: 503 })
      : Response.json({ events_received: 1 });
  } }, async ms => delays.push(ms));
  assert.equal(result.attempts, 2);
  assert.deepEqual(payloads[0], payloads[1]);
  assert.deepEqual(delays, [500]);
});

test('token inválido não repete; erro registado não expõe resposta ou contacto', async () => {
  let attempts = 0;
  await assert.rejects(deliverKitRegistration({ ...options, fetchImpl: async () => {
    attempts++;
    return Response.json({ error: { code: 190, message: 'sensitive-provider-detail' } }, { status: 400 });
  } }, async () => assert.fail('não deve esperar')), error => {
    assert.equal(kitMetaFailureCode(error), 'meta_190');
    assert.ok(!error.message.includes('sensitive'));
    return true;
  });
  assert.equal(attempts, 1);
});

test('rede, timeout e receção vazia ficam limitados a três tentativas', async () => {
  for (const failure of ['network', 'timeout', 'empty']) {
    let attempts = 0;
    await assert.rejects(deliverKitRegistration({ ...options, fetchImpl: async () => {
      attempts++;
      if (failure === 'network') throw new TypeError('network');
      if (failure === 'timeout') throw new DOMException('timeout', 'TimeoutError');
      return Response.json({ events_received: 0 });
    } }, async () => {}));
    assert.equal(attempts, 3);
  }
});

test('sem configuração não faz chamadas nem repete', async () => {
  const result = await deliverKitRegistration({ ...options, accessToken: '', fetchImpl: () => assert.fail() });
  assert.equal(result.reason, 'not_configured');
  assert.equal(result.attempts, 1);
});
