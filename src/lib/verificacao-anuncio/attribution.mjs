const clean = (value, maxLength) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized.length > maxLength || !/^[a-z0-9_.-]+$/u.test(normalized)) return "";
  return normalized;
};

export function normalizeVerificationAttribution(input = {}) {
  const source = clean(input.source, 80);
  const medium = clean(input.medium, 40);
  const campaign = clean(input.campaign, 100);
  const content = clean(input.content, 100);

  let channel = "direto";
  if (source === "sender" && medium === "email") channel = "email_sender";
  else if (source === "kit_estudante" && medium === "thank_you") channel = "kit_obrigado";
  else if (source || medium || campaign || content) channel = "outra_origem";

  return { channel, source, medium, campaign, content };
}
