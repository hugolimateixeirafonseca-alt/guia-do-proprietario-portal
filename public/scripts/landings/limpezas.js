(() => {
  const form = document.getElementById("quoteForm");
  if (!form) return;

  const steps = [...document.querySelectorAll(".form-step")];
  const dots = [...document.querySelectorAll(".step-dot")];
  const stepLabel = document.getElementById("stepLabel");
  const oneTimeFields = document.getElementById("oneTimeFields");
  const recurringFields = document.getElementById("recurringFields");
  const dateBlock = document.getElementById("dateBlock");
  const summary = document.getElementById("requestSummary");
  const sendingState = document.getElementById("sendingState");
  const successState = document.getElementById("successState");
  const errorState = document.getElementById("technicalErrorState");
  let currentStep = 1;

  const labels = {
    service_type: { regular: "Limpeza regular", profunda: "Limpeza profunda", pos_obra: "Pós-obra", mudanca: "Mudança", empresarial: "Empresa", outra: "Outra" },
    service_frequency: { one_time: "Uma vez", weekly: "Semanal", fortnightly: "Quinzenal", monthly: "Mensal", undecided: "Por decidir" },
    preferred_weekday: { monday: "Segunda-feira", tuesday: "Terça-feira", wednesday: "Quarta-feira", thursday: "Quinta-feira", friday: "Sexta-feira", saturday: "Sábado", flexible: "Flexível" },
    preferred_time_period: { morning: "Manhã", afternoon: "Tarde", flexible: "Indiferente" }
  };

  const getValue = (name) => {
    const checked = form.querySelector(`[name="${name}"]:checked`);
    if (checked) return checked.value;
    const element = form.elements[name];
    return element ? String(element.value || "").trim() : "";
  };

  const setError = (name, text = "") => {
    const error = document.querySelector(`[data-error-for="${name}"]`);
    const field = form.elements[name];
    if (error) error.textContent = text;
    if (field instanceof RadioNodeList) {
      [...form.querySelectorAll(`[name="${name}"]`)].forEach((item) => item.setAttribute("aria-invalid", text ? "true" : "false"));
    } else if (field) {
      field.setAttribute("aria-invalid", text ? "true" : "false");
    }
  };

  const clearErrors = (step) => {
    step.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
    step.querySelectorAll("[aria-invalid='true']").forEach((field) => field.setAttribute("aria-invalid", "false"));
  };

  const showStep = (number) => {
    currentStep = Math.max(1, Math.min(5, number));
    steps.forEach((step) => step.classList.toggle("is-active", Number(step.dataset.step) === currentStep));
    dots.forEach((dot, index) => {
      dot.classList.toggle("is-active", index + 1 === currentStep);
      dot.classList.toggle("is-done", index + 1 < currentStep);
    });
    stepLabel.textContent = `Passo ${currentStep} de 5`;
    if (currentStep === 5) updateSummary();
    document.getElementById("pedido")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const validateStep = (number) => {
    const step = steps.find((item) => Number(item.dataset.step) === number);
    clearErrors(step);
    let valid = true;
    const fail = (name, message) => { setError(name, message); valid = false; };

    if (number === 1 && !getValue("service_type")) fail("service_type", "Escolha uma opção para continuar.");
    if (number === 2) {
      if (!getValue("space_type")) fail("space_type", "Escolha o tipo de espaço.");
      if (!getValue("space_size")) fail("space_size", "Indique a dimensão aproximada.");
      if (!/^\d{4}-\d{3}$/.test(getValue("postal_code"))) fail("postal_code", "Use um código postal válido no formato 1234-567.");
    }
    if (number === 3 && !getValue("service_frequency")) fail("service_frequency", "Escolha a frequência pretendida.");
    if (number === 4) {
      const frequency = getValue("service_frequency");
      if (frequency === "one_time") {
        if (!getValue("one_time_timing")) fail("one_time_timing", "Escolha quando precisa da limpeza.");
        if (getValue("one_time_timing") === "specific_date" && !getValue("preferred_date")) fail("preferred_date", "Escolha uma data.");
      }
      if (["weekly", "fortnightly", "monthly"].includes(frequency) && !getValue("preferred_weekday")) fail("preferred_weekday", "Escolha o dia preferido.");
      if (!getValue("preferred_time_period")) fail("preferred_time_period", "Escolha manhã, tarde ou indiferente.");
    }
    if (number === 5) {
      const name = getValue("name").replace(/\s+/g, " ");
      const phone = getValue("phone");
      const localPhone = phone.replace(/\D/g, "").replace(/^(00351|351)/, "");
      const email = getValue("email").toLowerCase();
      if (name.length < 2 || !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(name)) fail("name", "Use apenas letras, espaços, apóstrofos ou hífenes no nome.");
      if (!/^9\d{8}$/.test(localPhone) || /[^\d+\s()-]/.test(phone)) fail("phone", "Introduza um telemóvel português com 9 algarismos, começado por 9.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("email", "Introduza um endereço de email válido.");
      if (!form.querySelector('[name="consent_partner_sharing"]:checked')) fail("consent_partner_sharing", "Aceite esta opção para enviar o pedido.");
    }
    return valid;
  };

  const updateConditional = () => {
    const frequency = getValue("service_frequency");
    oneTimeFields.classList.toggle("is-hidden", frequency !== "one_time");
    recurringFields.classList.toggle("is-hidden", !["weekly", "fortnightly", "monthly"].includes(frequency));
  };

  const updateDate = () => dateBlock.classList.toggle("is-hidden", getValue("one_time_timing") !== "specific_date");

  const updateSummary = () => {
    const service = labels.service_type[getValue("service_type")] || "";
    const frequency = labels.service_frequency[getValue("service_frequency")] || "";
    const day = labels.preferred_weekday[getValue("preferred_weekday")] || "";
    const period = labels.preferred_time_period[getValue("preferred_time_period")] || "";
    summary.textContent = `Resumo: ${[service, frequency, day, period, getValue("postal_code")].filter(Boolean).join(" · ")}`;
  };

  const eventId = () => globalThis.crypto?.randomUUID?.() || `limpeza-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const errorMap = {
    invalid_name: ["name", "Use apenas letras, espaços, apóstrofos ou hífenes no nome."],
    invalid_phone: ["phone", "Introduza um telemóvel português com 9 algarismos, começado por 9."],
    invalid_email: ["email", "Introduza um endereço de email válido."],
    invalid_postal_code: ["postal_code", "Use um código postal válido no formato 1234-567."],
    postal_not_found: ["postal_code", "Não encontrámos este código postal. Confirme os 7 algarismos."],
    invalid_service_type: ["service_type", "Escolha o tipo de limpeza."],
    invalid_space_type: ["space_type", "Escolha o tipo de espaço."],
    invalid_space_size: ["space_size", "Indique a dimensão aproximada."],
    invalid_service_frequency: ["service_frequency", "Escolha a frequência pretendida."],
    invalid_one_time_timing: ["one_time_timing", "Escolha quando precisa da limpeza."],
    invalid_preferred_date: ["preferred_date", "Escolha uma data válida."],
    invalid_preferred_weekday: ["preferred_weekday", "Escolha o dia preferido."],
    invalid_preferred_time_period: ["preferred_time_period", "Escolha manhã, tarde ou indiferente."],
    invalid_consent: ["consent_partner_sharing", "Aceite esta opção para enviar o pedido."]
  };

  document.querySelectorAll(".next-step").forEach((button) => button.addEventListener("click", () => {
    if (validateStep(currentStep)) showStep(currentStep + 1);
  }));
  document.querySelectorAll(".prev-step").forEach((button) => button.addEventListener("click", () => showStep(currentStep - 1)));

  form.addEventListener("input", (event) => setError(event.target.name, ""));
  form.addEventListener("change", (event) => {
    if (event.target.name === "service_frequency") updateConditional();
    if (event.target.name === "one_time_timing") updateDate();
    setError(event.target.name, "");
  });

  form.elements.postal_code?.addEventListener("input", (event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 7);
    event.target.value = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateStep(5)) return;

    const submissionId = eventId();
    const payload = {
      source: "guia_limpeza_preco_disponibilidade",
      consentVersion: form.dataset.consentVersion,
      consent1: form.elements.consent_partner_sharing.checked,
      consent2: form.elements.consent_marketing.checked,
      pageUrl: window.location.href,
      eventId: submissionId,
      serviceType: getValue("service_type"),
      spaceType: getValue("space_type"),
      spaceSize: getValue("space_size"),
      postalCode: getValue("postal_code"),
      serviceFrequency: getValue("service_frequency"),
      oneTimeTiming: getValue("one_time_timing"),
      preferredDate: getValue("preferred_date"),
      preferredWeekday: getValue("preferred_weekday"),
      preferredTimePeriod: getValue("preferred_time_period"),
      name: getValue("name"),
      phone: getValue("phone"),
      email: getValue("email"),
      additionalNotes: getValue("additional_notes")
    };

    form.classList.add("is-hidden");
    sendingState.classList.remove("is-hidden");
    errorState.classList.add("is-hidden");

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
          sendingState.classList.add("is-hidden");
          form.classList.remove("is-hidden");
          setError(fieldError[0], fieldError[1]);
          showStep(fieldError[0] === "postal_code" ? 2 : fieldError[0].startsWith("service_") ? 1 : fieldError[0].startsWith("preferred_") || fieldError[0].startsWith("one_time") ? 4 : 5);
          return;
        }
        throw new Error(result.error || "provider_error");
      }

      sendingState.classList.add("is-hidden");
      successState.classList.remove("is-hidden");
      if (window.fbq) window.fbq("track", "Contact", { content_name: "servicos-limpeza" }, { eventID: submissionId });
    } catch {
      sendingState.classList.add("is-hidden");
      errorState.classList.remove("is-hidden");
    }
  });

  document.getElementById("resetForm")?.addEventListener("click", () => {
    form.reset();
    successState.classList.add("is-hidden");
    form.classList.remove("is-hidden");
    oneTimeFields.classList.add("is-hidden");
    recurringFields.classList.add("is-hidden");
    dateBlock.classList.add("is-hidden");
    showStep(1);
  });

  document.getElementById("retryForm")?.addEventListener("click", () => {
    errorState.classList.add("is-hidden");
    form.classList.remove("is-hidden");
    showStep(5);
  });

  showStep(1);
})();
