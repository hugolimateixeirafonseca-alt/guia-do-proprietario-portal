import assert from "node:assert/strict";
import test from "node:test";
import { buildVerificationEmail } from "../../src/lib/verificacao-anuncio/notification-email.mjs";

const input = {
  uploadUrl: "https://guiadoproprietario.pt/verificacao/enviar/segredo/",
  reportUrl: "https://guiadoproprietario.pt/verificacao/r/segredo",
  deadline: "2026-09-07T12:00:00.000Z",
  city: "Lisboa"
};

test("gera as sete mensagens transacionais sem depender de templates Sender", () => {
  for (const type of ["recebida", "precheck", "relatorio", "falha", "lembrete_24h", "lembrete_7d", "reembolso"]) {
    const message = buildVerificationEmail(type, input);
    assert.ok(message.subject.length > 10);
    assert.match(message.html, /Guia do Proprietário/);
    assert.match(message.text, /Verificação de Anúncio/);
  }
});

test("a pré-verificação envia uma ligação privada para retomar o teaser", () => {
  const message = buildVerificationEmail("precheck", input);
  assert.match(message.subject, /primeira leitura/i);
  assert.match(message.html, /Ver a primeira leitura/);
  assert.match(message.text, /https:\/\/guiadoproprietario\.pt\/verificacao\/enviar\/segredo\//);
});

test("usa a designação exigida no CTA de envio", () => {
  const message = buildVerificationEmail("recebida", input);
  assert.match(message.html, /capturas de ecrã \(screenshot\)/);
  assert.match(message.text, /capturas de ecrã \(screenshot\)/);
});

test("escapa a localidade antes de a colocar no HTML", () => {
  const message = buildVerificationEmail("relatorio", { ...input, city: '<img src=x onerror="alert(1)">' });
  assert.doesNotMatch(message.html, /<img src=x/);
  assert.match(message.html, /&lt;img/);
});

test("rejeita links que não usam HTTPS", () => {
  assert.throws(() => buildVerificationEmail("recebida", { ...input, uploadUrl: "http://example.org/upload" }), /HTTPS/);
});

test("usa um caminho resistente ao tracking de cliques do Sender", () => {
  const message = buildVerificationEmail("recebida", input);
  assert.match(message.html, /\/verificacao\/enviar\/segredo\//u);
  assert.doesNotMatch(message.html, /\?t=/u);
});
