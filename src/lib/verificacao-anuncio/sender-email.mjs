const SENDER_API_BASE = "https://api.sender.net/v2";

export class SenderTransactionalError extends Error {
  constructor(code, status = 0) {
    super(`Sender.net: ${code}`);
    this.name = "SenderTransactionalError";
    this.code = code;
    this.status = status;
  }
}

const clean = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";

export function validateTransactionalEmail(input) {
  const to = clean(input?.to, 254).toLowerCase();
  const fromEmail = clean(input?.fromEmail, 254).toLowerCase();
  const fromName = clean(input?.fromName, 100);
  const subject = clean(input?.subject, 180);
  const html = typeof input?.html === "string" ? input.html : "";
  const text = typeof input?.text === "string" ? input.text : "";
  const attachmentUrl = clean(input?.attachmentUrl, 2048);
  const attachmentName = clean(input?.attachmentName, 120);
  const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u;

  if (!emailPattern.test(to) || !emailPattern.test(fromEmail)) {
    throw new TypeError("Remetente ou destinatário inválido.");
  }
  if (!fromName || !subject || (!html && !text)) {
    throw new TypeError("Nome do remetente, assunto e conteúdo são obrigatórios.");
  }
  if (attachmentUrl) {
    const url = new URL(attachmentUrl);
    if (url.protocol !== "https:" || !attachmentName.toLowerCase().endsWith(".pdf")) {
      throw new TypeError("O relatório deve usar um URL HTTPS temporário e um nome PDF.");
    }
  }
  return { to, fromEmail, fromName, subject, html, text, attachmentUrl, attachmentName };
}

export function buildSenderMessage(input) {
  const message = validateTransactionalEmail(input);
  return {
    from: { email: message.fromEmail, name: message.fromName },
    to: { email: message.to },
    subject: message.subject,
    ...(message.html ? { html: message.html } : {}),
    ...(message.text ? { text: message.text } : {}),
    ...(message.attachmentUrl ? { attachments: { [message.attachmentName]: message.attachmentUrl } } : {})
  };
}

export function buildSenderTemplateMessage(input) {
  const to = clean(input?.to, 254).toLowerCase();
  const name = clean(input?.name, 100);
  const attachmentUrl = clean(input?.attachmentUrl, 2048);
  const attachmentName = clean(input?.attachmentName, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(to)) throw new TypeError("Destinatário inválido.");
  if (input?.variables === null || typeof input?.variables !== "object" || Array.isArray(input?.variables)) {
    throw new TypeError("As variáveis do template devem ser um objeto.");
  }
  if (attachmentUrl) {
    const url = new URL(attachmentUrl);
    if (url.protocol !== "https:" || !attachmentName.toLowerCase().endsWith(".pdf")) {
      throw new TypeError("O relatório deve usar um URL HTTPS temporário e um nome PDF.");
    }
  }
  return {
    to: { email: to, ...(name ? { name } : {}) },
    variables: Object.fromEntries(Object.entries(input.variables).map(([key, value]) => [key, String(value ?? "")])),
    ...(attachmentUrl ? { attachments: { [attachmentName]: attachmentUrl } } : {})
  };
}

export function createSenderTransactionalClient({ apiToken, fetchImpl = fetch, apiBase = SENDER_API_BASE }) {
  if (!clean(apiToken, 512)) throw new TypeError("SENDER_API_TOKEN não configurado.");

  return {
    async send(input) {
      const response = await fetchImpl(`${apiBase}/message/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildSenderMessage(input)),
        signal: AbortSignal.timeout(12_000)
      });
      if (!response.ok) {
        throw new SenderTransactionalError(`send_${response.status}`, response.status);
      }
      return response.json().catch(() => ({}));
    },
    async sendTemplate(input) {
      const templateId = clean(input?.templateId, 64);
      if (!/^[A-Za-z0-9_-]+$/u.test(templateId)) throw new TypeError("ID de template Sender inválido.");
      const response = await fetchImpl(`${apiBase}/message/${encodeURIComponent(templateId)}/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildSenderTemplateMessage(input)),
        signal: AbortSignal.timeout(12_000)
      });
      if (!response.ok) {
        throw new SenderTransactionalError(`template_${response.status}`, response.status);
      }
      return response.json().catch(() => ({}));
    }
  };
}
