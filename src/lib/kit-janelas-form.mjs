import { kitThankYouUrl } from './kit-janelas-campaign.mjs';
export function initKitJanelas(doc, win) {
  const form = doc.getElementById('kit-janelas-form');
  if (!form) return;
  const email = form.elements.namedItem('email');
  const consent = form.elements.namedItem('consent_pdf');
  const marketing = form.elements.namedItem('consent_marketing');
  const submit = form.querySelector('button[type="submit"]');
  const submitLabel = submit.querySelector('span');
  const success = doc.getElementById('kj-success');
  const errorFor = (id, message) => {
    const element = doc.getElementById(id);
    element.textContent = message;
    element.hidden = !message;
  };
  let sending = false;
  let requestId = win.crypto.randomUUID();
  for (const field of [email, consent, marketing]) field.addEventListener('change', () => { requestId = win.crypto.randomUUID(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    errorFor('kj-email-error', '');
    errorFor('kj-consent-error', '');
    errorFor('kj-form-error', '');
    email.removeAttribute('aria-invalid');
    consent.removeAttribute('aria-invalid');
    if (!email.value.trim() || !email.validity.valid) {
      errorFor('kj-email-error', 'Introduza um endereço de email válido.');
      email.setAttribute('aria-invalid', 'true'); email.focus(); return;
    }
    if (!consent.checked) {
      errorFor('kj-consent-error', 'Autorize o envio do PDF para receber o kit.');
      consent.setAttribute('aria-invalid', 'true'); consent.focus(); return;
    }
    sending = true; submit.disabled = true; submitLabel.textContent = 'A ENVIAR O SEU KIT…';
    try {
      const response = await win.fetch('/api/kit-trocar-janelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.value.trim(), consent1: true, consent2: marketing.checked,
          consentVersion: form.dataset.consentVersion, source: 'kit-trocar-janelas',
          eventId: requestId, company: form.elements.namedItem('company').value
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) {
        const messages = {
          delivery_unconfirmed: 'O envio está a demorar. Verifique o seu email e a pasta de spam antes de fazer um novo pedido.',
          invalid_email: 'Confirme o endereço de email e tente novamente.',
          invalid_consent: 'Autorize o envio do PDF para receber o kit.',
          too_many_requests: 'Já foram feitos vários pedidos. Aguarde alguns minutos antes de tentar novamente.'
        };
        throw new Error(messages[result.error] || 'Não foi possível enviar o kit agora. Tente novamente dentro de momentos.');
      }
      doc.getElementById('kj-success-email').textContent = email.value.trim();
      form.hidden = true; success.hidden = false; success.focus();
      win.location.assign(kitThankYouUrl(win.location.href));
    } catch (error) {
      errorFor('kj-form-error', error instanceof Error ? error.message : 'Não foi possível enviar o kit. Tente novamente.');
    } finally {
      sending = false; submit.disabled = false; submitLabel.textContent = 'RECEBER PDF GRÁTIS';
    }
  });
  doc.getElementById('kj-change-email').addEventListener('click', () => {
    success.hidden = true; form.hidden = false; requestId = win.crypto.randomUUID(); email.focus();
  });
}
