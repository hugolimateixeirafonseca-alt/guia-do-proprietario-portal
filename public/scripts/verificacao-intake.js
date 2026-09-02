const card = document.querySelector(".form-card");
const form = document.querySelector("[data-upload-form]");
const input = document.querySelector("[data-file-input]");
const dropZone = document.querySelector(".drop-zone");
const filesBox = document.querySelector("[data-selected-files]");
const formStatus = document.querySelector("[data-form-status]");
const submit = document.querySelector("[data-submit]");
const access = document.querySelector("[data-access-message]");
const badge = document.querySelector("[data-state-badge]");
const processing = document.querySelector("[data-processing]");
const teaserBox = document.querySelector("[data-teaser]");
const notReady = document.querySelector("[data-not-ready]");
const emailField = document.querySelector("[data-email-field]");
const emailInput = form?.elements.namedItem("email");
const paymentNote = document.querySelector("[data-payment-note]");
const checkoutButton = document.querySelector("[data-checkout]");
const checkoutStatus = document.querySelector("[data-checkout-status]");
const checkoutFallback = document.querySelector("[data-checkout-fallback]");
const token = new URLSearchParams(window.location.search).get("t") || "";
const isPrivate = /^[A-Za-z0-9_-]{43,128}$/.test(token);
let pollTimer = 0;
let recoveryRequested = false;
let legacyUpload = false;

const messages = {
  invalid_email: "Indique um email válido.", captures_required: "Escolha pelo menos uma captura.",
  too_many_captures: "Escolha no máximo 8 capturas.", capture_too_large: "Uma das capturas ultrapassa 10 MB.",
  captures_too_large: "O conjunto de capturas é demasiado pesado.", unsupported_capture_type: "Use apenas ficheiros JPEG, PNG ou WebP.",
  capture_type_mismatch: "Um dos ficheiros não contém uma imagem válida.", invalid_city: "Indique a cidade apresentada no anúncio.",
  privacy_confirmation_required: "Confirme a autorização para tratar as capturas.", intake_not_available: "A pré-verificação pública ainda não está disponível.",
  service_not_configured: "A pré-verificação ainda não está configurada. Tente novamente dentro de alguns minutos.",
  upload_not_configured: "O envio seguro das capturas ainda não está disponível. Tente novamente dentro de alguns minutos.",
  processing_unavailable: "Não foi possível iniciar a análise agora. Tente novamente dentro de alguns minutos.",
  too_many_requests: "Foram feitas demasiadas tentativas. Aguarde alguns minutos.", temporary_error: "Ocorreu uma falha temporária. Tente novamente."
};
const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hideAll = () => [form, access, processing, teaserBox, notReady].forEach((element) => { if (element) element.hidden = true; });
const setText = (selector, value) => { const element = document.querySelector(selector); if (element) element.textContent = value; };

function cookieValue(name) {
  const entry = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!entry) return "";
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return ""; }
}

function metaAttribution() {
  try {
    const preferences = JSON.parse(cookieValue("gp_cookie_preferences") || "{}");
    if (preferences.measurement !== true) return null;
  } catch { return null; }
  let fbc = cookieValue("_fbc");
  const fbclid = new URLSearchParams(window.location.search).get("fbclid") || "";
  if (!fbc && /^[A-Za-z0-9_.:-]{8,240}$/.test(fbclid)) fbc = `fb.1.${Date.now()}.${fbclid}`;
  return { fbp: cookieValue("_fbp"), fbc };
}

function showAccessError(title, text) {
  hideAll();
  if (badge) badge.textContent = "Acesso indisponível";
  if (access) {
    access.hidden = false;
    access.innerHTML = `<span class="error-icon" aria-hidden="true">!</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
  }
}

function showProcessing(paid = false) {
  hideAll();
  if (processing) processing.hidden = false;
  if (badge) badge.textContent = paid ? "Em análise" : "Pré-verificação com IA";
  setText("[data-processing-title]", paid ? "A investigação completa está em curso." : "O sistema inteligente está a ler as capturas.");
  setText("[data-processing-copy]", paid
    ? "A IA está a cruzar as fotografias, o preço, as condições e os 12 pontos do relatório. Normalmente fica pronto em poucos minutos."
    : "Estamos a confirmar o texto, as condições e as fotografias. Normalmente demora apenas alguns minutos.");
  const bar = document.querySelector("[data-progress-bar]");
  if (bar) bar.style.width = paid ? "64%" : "28%";
}

function refresh() {
  if (!input || !filesBox || !submit || !formStatus || !form) return;
  formStatus.classList.remove("is-error");
  const files = Array.from(input.files || []);
  if (badge) badge.textContent = legacyUpload ? "Pagamento confirmado" : files.length ? "Pronto para analisar" : "Sem pagamento";
  filesBox.innerHTML = files.length
    ? files.slice(0, 8).map((file, index) => `<div><span>${index + 1}</span><strong>${escapeHtml(file.name)}</strong><small>${Math.max(1, Math.round(file.size / 1024))} KB</small></div>`).join("")
    : "<p>Ainda não escolheu ficheiros.</p>";
  const city = form.elements.namedItem("cidade");
  const privacy = form.elements.namedItem("confirmacao_privacidade");
  const emailOk = isPrivate || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailInput?.value.trim() || "");
  const filesOk = files.length >= 1 && files.length <= 8 && files.every((file) => file.size <= 10 * 1024 * 1024);
  submit.disabled = !(filesOk && city?.value.trim() && privacy?.checked && emailOk);
  formStatus.textContent = files.length > 8 ? "Escolha no máximo 8 capturas."
    : files.some((file) => file.size > 10 * 1024 * 1024) ? "Uma das capturas ultrapassa 10 MB."
    : files.length ? `${files.length} ${files.length === 1 ? "captura pronta" : "capturas prontas"} para a pré-verificação.`
    : "Adicione as capturas para iniciar a primeira leitura gratuita.";
}

function showUpload(legacy = false) {
  hideAll();
  legacyUpload = legacy;
  if (form) form.hidden = false;
  if (emailField) emailField.hidden = legacy;
  if (emailInput) emailInput.required = !legacy;
  if (paymentNote) paymentNote.textContent = legacy ? "O pagamento deste pedido já foi confirmado." : "Primeiro vê o resultado inicial. Só depois decide se quer a análise completa.";
  if (submit) submit.textContent = legacy ? "Iniciar análise com IA" : "Analisar o meu anúncio";
  if (badge) badge.textContent = "Pronto para envio";
  refresh();
}

function showTeaser(teaser) {
  hideAll();
  if (!teaser?.useful) {
    if (notReady) notReady.hidden = false;
    if (badge) badge.textContent = "Mais capturas necessárias";
    return;
  }
  if (teaserBox) teaserBox.hidden = false;
  if (badge) badge.textContent = "Capturas aprovadas";
  setText("[data-teaser-headline]", teaser.headline || "As capturas têm informação suficiente para uma análise útil.");
  setText("[data-fact-count]", String(teaser.factCount || 0));
  setText("[data-photo-count]", String(teaser.photoCount || 0));
  setText("[data-teaser-signal]", teaser.signal || "");
  setText("[data-teaser-fields]", Array.isArray(teaser.fields) && teaser.fields.length ? `Já identificámos: ${teaser.fields.join(", ")}.` : "");
  const paymentAvailable = card?.dataset.checkoutEnabled === "true";
  if (checkoutButton) checkoutButton.disabled = !paymentAvailable;
  if (checkoutStatus && !paymentAvailable) checkoutStatus.textContent = "O pagamento público continua desligado durante a validação final.";
}

function showDelivered() {
  showProcessing(true);
  if (badge) badge.textContent = "Relatório pronto";
  setText("[data-processing-title]", "O relatório inteligente está pronto.");
  setText("[data-processing-copy]", "A análise automática foi concluída. Já pode abrir a decisão, as evidências e as perguntas preparadas.");
  const bar = document.querySelector("[data-progress-bar]");
  if (bar) bar.style.width = "100%";
  const note = document.querySelector("[data-processing-note]");
  if (note) note.innerHTML = `<a class="report-link" href="/verificacao/r/${encodeURIComponent(token)}">Abrir o meu relatório completo →</a>`;
}

async function readState() {
  if (!isPrivate) return;
  try {
    const response = await fetch(`/api/verificacao-anuncio/status?t=${encodeURIComponent(token)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "temporary_error");
    window.clearTimeout(pollTimer);
    if (result.etapa === "aguarda_upload") showUpload(true);
    else if (result.etapa === "precheck_em_analise") { showProcessing(false); pollTimer = window.setTimeout(readState, 3000); }
    else if (result.etapa === "precheck_pronto") showTeaser(result.teaser);
    else if (result.etapa === "em_analise") {
      showProcessing(true);
      if (!recoveryRequested) {
        recoveryRequested = true;
        const retryResponse = await fetch(`/api/verificacao-anuncio/retry?t=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { Accept: "application/json" }
        }).catch(() => null);
        if (!retryResponse?.ok && retryResponse?.status !== 409) recoveryRequested = false;
      }
      pollTimer = window.setTimeout(readState, 4000);
    }
    else if (result.etapa === "entregue") showDelivered();
    else if (result.etapa === "precheck_falhou") showAccessError("A pré-verificação não ficou concluída", "Tente novamente mais tarde. Não foi efetuado qualquer pagamento.");
    else showAccessError("Pedido indisponível", "Esta ligação já não está disponível.");
  } catch (error) {
    const code = error instanceof Error ? error.message : "temporary_error";
    showAccessError("Não foi possível abrir o pedido", messages[code] || "Confirme a ligação ou tente novamente mais tarde.");
  }
}

input?.addEventListener("change", refresh);
for (const eventName of ["dragenter", "dragover", "dragleave", "drop"]) {
  dropZone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
}
for (const eventName of ["dragenter", "dragover"]) dropZone?.addEventListener(eventName, () => dropZone.classList.add("is-dragging"));
for (const eventName of ["dragleave", "drop"]) dropZone?.addEventListener(eventName, () => dropZone.classList.remove("is-dragging"));
dropZone?.addEventListener("drop", (event) => {
  if (!input || !(event instanceof DragEvent) || !event.dataTransfer?.files.length) return;
  input.files = event.dataTransfer.files;
  refresh();
});
form?.addEventListener("input", refresh);
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form || !submit || !formStatus) return;
  submit.disabled = true;
  submit.textContent = "A enviar com segurança…";
  formStatus.textContent = "A validar e a guardar as capturas.";
  try {
    const body = new FormData(form);
    const query = new URLSearchParams(window.location.search);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
      const value = query.get(key);
      if (value) body.set(key, value);
    }
    const attribution = metaAttribution();
    if (!isPrivate && attribution) {
      body.set("meta_consent", "sim");
      body.set("meta_fbp", attribution.fbp);
      body.set("meta_fbc", attribution.fbc);
    }
    const response = await fetch(isPrivate ? `/api/verificacao-anuncio/upload?t=${encodeURIComponent(token)}` : "/api/verificacao-anuncio/intake", {
      method: "POST", body, headers: { Accept: "application/json" }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "temporary_error");
    if (!isPrivate && result.nextUrl) { window.location.assign(result.nextUrl); return; }
    showProcessing(true);
    pollTimer = window.setTimeout(readState, 3000);
  } catch (error) {
    const code = error instanceof Error ? error.message : "temporary_error";
    submit.textContent = isPrivate ? "Tentar novamente" : "Analisar o meu anúncio";
    refresh();
    formStatus.textContent = messages[code] || "Não foi possível enviar as capturas. Tente novamente.";
    formStatus.classList.add("is-error");
    if (badge) badge.textContent = "Envio não concluído";
  }
});

checkoutButton?.addEventListener("click", async () => {
  if (!checkoutButton || !checkoutStatus || !isPrivate) return;
  checkoutButton.disabled = true;
  checkoutButton.textContent = "A preparar pagamento seguro…";
  checkoutStatus.textContent = "A abrir o pagamento Stripe.";
  if (checkoutFallback) checkoutFallback.hidden = true;
  try {
    const response = await fetch("/api/verificacao-anuncio/checkout", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: crypto.randomUUID(), token, company: "" })
    });
    const result = await response.json();
    if (!response.ok || !result.url) throw new Error(result.error || "checkout_unavailable");
    if (checkoutFallback) {
      checkoutFallback.href = result.url;
      checkoutFallback.hidden = false;
    }
    checkoutStatus.textContent = "Pagamento preparado. A abrir a página segura da Stripe.";
    window.location.assign(result.url);
    window.setTimeout(() => {
      checkoutStatus.textContent = "O pagamento está pronto. Se não abriu automaticamente, clique em «Abrir pagamento seguro».";
    }, 1200);
  } catch {
    checkoutStatus.textContent = checkoutFallback && !checkoutFallback.hidden
      ? "O pagamento está pronto. Clique em «Abrir pagamento seguro»."
      : "Não foi possível preparar o pagamento. Tente novamente.";
    checkoutButton.disabled = false;
    checkoutButton.textContent = "Desbloquear investigação completa →";
  }
});

document.querySelector("[data-start-again]")?.addEventListener("click", () => window.location.assign("/verificacao/enviar/"));
if (isPrivate) { hideAll(); if (access) access.hidden = false; readState(); } else showUpload(false);
