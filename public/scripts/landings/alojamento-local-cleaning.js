(() => {
  const form = document.getElementById("alQuoteForm");
  if (!form) return;

  const steps = [...document.querySelectorAll(".al-step")];
  const bars = [...document.querySelectorAll(".al-progress i")];
  const label = document.getElementById("alStepLabel");
  const sending = document.getElementById("alSendingState");
  const success = document.getElementById("alSuccessState");
  const technicalError = document.getElementById("alErrorState");
  let currentStep = 1;

  const getValue = (name) => {
    const checked = form.querySelector(`[name="${name}"]:checked`);
    if (checked) return checked.value;
    const field = form.elements[name];
    return field ? String(field.value || "").trim() : "";
  };
  const getValues = (name) => [...form.querySelectorAll(`[name="${name}"]:checked`)].map(input => input.value);
  const setError = (name, message = "") => {
    const target = form.querySelector(`[data-error-for="${name}"]`);
    if (target) target.textContent = message;
    form.querySelectorAll(`[name="${name}"]`).forEach(input => input.setAttribute("aria-invalid", message ? "true" : "false"));
  };
  const clearErrors = (step) => {
    step.querySelectorAll(".al-error").forEach(item => { item.textContent = ""; });
    step.querySelectorAll("[aria-invalid='true']").forEach(item => item.setAttribute("aria-invalid", "false"));
  };
  const showStep = (number, scroll = true) => {
    currentStep = Math.max(1, Math.min(4, number));
    steps.forEach(step => step.classList.toggle("is-active", Number(step.dataset.step) === currentStep));
    bars.forEach((bar, index) => bar.classList.toggle("is-active", index < currentStep));
    label.textContent = `Passo ${currentStep} de 4`;
    if (scroll && window.innerWidth < 900) document.getElementById("pedido")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const validate = (number) => {
    const step = steps[number - 1];
    clearErrors(step);
    let valid = true;
    const fail = (name, message) => { setError(name, message); valid = false; };
    if (number === 1 && !getValue("al_units")) fail("al_units", "Escolha uma opção para continuar.");
    if (number === 2 && !getValues("al_services").length) fail("al_services", "Escolha pelo menos um serviço.");
    if (number === 3) {
      if (!/^\d{4}-\d{3}$/.test(getValue("postal_code"))) fail("postal_code", "Use um código postal válido no formato 1234-567.");
      if (!getValue("al_turnaround")) fail("al_turnaround", "Indique o tempo disponível entre hóspedes.");
      if (!getValue("al_access")) fail("al_access", "Indique como é feito o acesso.");
    }
    if (number === 4) {
      const name = getValue("name").replace(/\s+/g, " ");
      const phone = getValue("phone");
      const localPhone = phone.replace(/\D/g, "").replace(/^(00351|351)/, "");
      const email = getValue("email").toLowerCase();
      if (name.length < 2 || !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(name)) fail("name", "Use apenas letras, espaços, apóstrofos ou hífenes.");
      if (!/^9\d{8}$/.test(localPhone) || /[^\d+\s()-]/.test(phone)) fail("phone", "Introduza um telemóvel português com 9 algarismos, começado por 9.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("email", "Introduza um endereço de email válido.");
      if (!form.elements.consent_partner_sharing.checked) fail("consent_partner_sharing", "Aceite a partilha com parceiros para enviar o pedido.");
    }
    return valid;
  };

  const eventId = () => globalThis.crypto?.randomUUID?.() || `alojamento-local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const errorMap = {
    invalid_name: ["name", "Use apenas letras, espaços, apóstrofos ou hífenes."],
    invalid_phone: ["phone", "Introduza um telemóvel português válido."],
    invalid_email: ["email", "Introduza um endereço de email válido."],
    invalid_postal_code: ["postal_code", "Use um código postal válido no formato 1234-567."],
    postal_not_found: ["postal_code", "Não encontrámos este código postal. Confirme os 7 algarismos."],
    invalid_al_units: ["al_units", "Escolha quantos alojamentos quer incluir."],
    invalid_al_services: ["al_services", "Escolha pelo menos um serviço."],
    invalid_al_turnaround: ["al_turnaround", "Indique o tempo disponível entre hóspedes."],
    invalid_al_access: ["al_access", "Indique como é feito o acesso."],
    invalid_consent: ["consent_partner_sharing", "Aceite a partilha com parceiros para enviar o pedido."]
  };
  const stepForField = field => field === "al_units" ? 1 : field === "al_services" ? 2 : ["postal_code", "al_turnaround", "al_access"].includes(field) ? 3 : 4;

  form.querySelectorAll('[name="al_units"]').forEach(input => input.addEventListener("change", () => {
    setError("al_units", "");
    window.setTimeout(() => showStep(2), 160);
  }));
  document.querySelectorAll(".al-next").forEach(button => button.addEventListener("click", () => {
    if (validate(currentStep)) showStep(currentStep + 1);
  }));
  document.querySelectorAll(".al-back").forEach(button => {
    if (!["alResetForm", "alRetryForm"].includes(button.id)) button.addEventListener("click", () => showStep(currentStep - 1));
  });
  form.addEventListener("input", event => setError(event.target.name, ""));
  form.elements.postal_code.addEventListener("input", event => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 7);
    event.target.value = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!validate(4)) return;
    const submissionId = eventId();
    const services = getValues("al_services");
    const payload = {
      source: "guia_limpeza_alojamento_local",
      consentVersion: form.dataset.consentVersion,
      consent1: form.elements.consent_partner_sharing.checked,
      consent2: form.elements.consent_marketing.checked,
      pageUrl: window.location.href,
      eventId: submissionId,
      serviceType: services.length === 1 && services[0] === "deep" ? "profunda" : "regular",
      spaceType: "alojamento_local",
      spaceSize: "unknown",
      postalCode: getValue("postal_code"),
      serviceFrequency: "undecided",
      preferredWeekdays: ["flexible"],
      preferredTimePeriods: ["flexible"],
      name: getValue("name"),
      phone: getValue("phone"),
      email: getValue("email"),
      additionalNotes: getValue("additional_notes"),
      alUnits: getValue("al_units"),
      alServices: services,
      alTurnaround: getValue("al_turnaround"),
      alAccess: getValue("al_access")
    };

    form.classList.add("is-hidden");
    sending.classList.remove("is-hidden");
    technicalError.classList.add("is-hidden");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fieldError = errorMap[result.error];
        if (fieldError) {
          sending.classList.add("is-hidden");
          form.classList.remove("is-hidden");
          setError(fieldError[0], fieldError[1]);
          showStep(stepForField(fieldError[0]));
          return;
        }
        throw new Error(result.error || "provider_error");
      }
      sending.classList.add("is-hidden");
      success.classList.remove("is-hidden");
      if (window.fbq) window.fbq("track", "Contact", { content_name: "limpeza-alojamento-local" }, { eventID: submissionId });
    } catch {
      sending.classList.add("is-hidden");
      technicalError.classList.remove("is-hidden");
    }
  });

  document.getElementById("alResetForm")?.addEventListener("click", () => {
    form.reset();
    success.classList.add("is-hidden");
    form.classList.remove("is-hidden");
    showStep(1);
  });
  document.getElementById("alRetryForm")?.addEventListener("click", () => {
    technicalError.classList.add("is-hidden");
    form.classList.remove("is-hidden");
    showStep(4);
  });
  showStep(1, false);
})();
