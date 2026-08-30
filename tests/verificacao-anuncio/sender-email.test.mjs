import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSenderMessage,
  buildSenderTemplateMessage,
  createSenderTransactionalClient,
  SenderTransactionalError
} from "../../src/lib/verificacao-anuncio/sender-email.mjs";

const input = {
  to: "cliente@example.com",
  fromEmail: "relatorios@example.org",
  fromName: "Guia do Proprietário",
  subject: "O seu relatório está pronto",
  html: "<p>Relatório concluído.</p>",
  text: "Relatório concluído.",
  attachmentUrl: "https://files.example.org/relatorio.pdf?token=curto",
  attachmentName: "verificacao-anuncio.pdf"
};

test("cria a mensagem Sender com o PDF servido por URL HTTPS temporário", () => {
  const message = buildSenderMessage(input);
  assert.equal(message.attachments["verificacao-anuncio.pdf"], input.attachmentUrl);
  assert.equal(message.to.email, input.to);
});

test("reutiliza um template transacional existente com variáveis e anexo", async () => {
  let request;
  const message = buildSenderTemplateMessage({
    to: input.to,
    name: "Cliente",
    variables: { report_url: "https://example.org/resultado" },
    attachmentUrl: input.attachmentUrl,
    attachmentName: input.attachmentName
  });
  assert.equal(message.to.name, "Cliente");
  const client = createSenderTransactionalClient({
    apiToken: "secret-token",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ success: true, emailId: "email-1" }), { status: 200 });
    }
  });
  await client.sendTemplate({ templateId: "dN0ol8", to: input.to, variables: { report_url: "https://example.org/resultado" } });
  assert.equal(request.url, "https://api.sender.net/v2/message/dN0ol8/send");
  assert.equal(JSON.parse(request.init.body).to.email, input.to);
});

test("envia pelo endpoint transacional e não inclui o token no corpo", async () => {
  let request;
  const client = createSenderTransactionalClient({
    apiToken: "secret-token",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ id: "message-1" }), { status: 200 });
    }
  });
  await client.send(input);
  assert.equal(request.url, "https://api.sender.net/v2/message/send");
  assert.equal(request.init.headers.Authorization, "Bearer secret-token");
  assert.equal(request.init.body.includes("secret-token"), false);
});

test("transforma uma resposta de erro do Sender num erro estável", async () => {
  const client = createSenderTransactionalClient({
    apiToken: "secret-token",
    fetchImpl: async () => new Response("erro", { status: 422 })
  });
  await assert.rejects(client.send(input), (error) => error instanceof SenderTransactionalError && error.status === 422);
});
