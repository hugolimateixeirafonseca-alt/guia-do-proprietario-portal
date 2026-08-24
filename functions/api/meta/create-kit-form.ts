import { DEFAULT_META_GRAPH_VERSION, cleanText, json, type RequestContext } from "../../lib/kit-estudante";

const PAGE_ID = "1258051167387333";
const FORM_NAME = "Pais | Kit Estudante 2026 | Instant Form";
const PRIVACY_URL = "https://guiadoproprietario.pt/privacidade/";
const KIT_URL = "https://guiadoproprietario.pt/kit-estudante/";

function constantTimeEqual(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function isAuthorized(request: Request, secret: string) {
  const header = request.headers.get("Authorization") || "";
  const expected = `Bearer ${secret}`;
  return constantTimeEqual(header, expected);
}

function graphEndpoint(version: string) {
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("invalid_meta_graph_version");
  return `https://graph.facebook.com/${version}/${PAGE_ID}/leadgen_forms`;
}

async function metaJson(response: Response) {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error && typeof payload.error === "object"
      ? payload.error as Record<string, unknown>
      : {};
    const code = cleanText(error.code, 40) || String(response.status);
    const subcode = cleanText(error.error_subcode, 40);
    throw new Error(`meta_form_${code}${subcode ? `_${subcode}` : ""}`);
  }
  return payload;
}

async function listForms(token: string, version: string) {
  const url = new URL(graphEndpoint(version));
  url.searchParams.set("fields", "id,name,status,created_time");
  url.searchParams.set("limit", "100");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000)
  });
  const payload = await metaJson(response);
  return Array.isArray(payload.data)
    ? payload.data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    : [];
}

function formFields() {
  const questions = [
    {
      type: "CUSTOM",
      key: "relacao_estudante",
      label: "Qual destas opções descreve melhor a sua relação com o estudante?",
      options: [
        { key: "pai_mae_encarregado", value: "Sou pai, mãe ou encarregado de educação de um estudante do ensino superior" },
        { key: "estudante", value: "Sou estudante" },
        { key: "outro", value: "Outro" }
      ]
    },
    {
      type: "CUSTOM",
      key: "cidade",
      label: "Em que cidade vai estudar o seu filho/a?",
      options: [
        { key: "lisboa", value: "Lisboa" },
        { key: "porto", value: "Porto" },
        { key: "coimbra", value: "Coimbra" },
        { key: "braga", value: "Braga" },
        { key: "aveiro", value: "Aveiro" },
        { key: "evora", value: "Évora" },
        { key: "faro", value: "Faro" },
        { key: "outra", value: "Outras" }
      ]
    },
    {
      type: "CUSTOM",
      key: "fase",
      label: "Em que fase está a procura de alojamento?",
      options: [
        { key: "procura", value: "Ainda estamos à procura" },
        { key: "encontrou", value: "Já encontrámos alojamento" },
        { key: "tratado", value: "Já está tudo tratado" }
      ]
    },
    { type: "FULL_NAME" },
    { type: "EMAIL" }
  ];

  const contextCard = {
    title: "Antes de pagar sinal ou caução, confirme estes 27 pontos",
    style: "LIST_STYLE",
    button_text: "Continuar",
    content: [
      "Evite burlas e anúncios enganadores",
      "Receba gratuitamente a Checklist dos Pais e o guia complementar"
    ]
  };

  const privacyPolicy = {
    url: PRIVACY_URL,
    link_text: "Política de Privacidade do Guia do Proprietário"
  };

  const customDisclaimer = {
    title: "Consentimento para comunicações por email",
    body: {
      text: "Para receber os guias e as comunicações indicadas, confirme o consentimento abaixo."
    },
    checkboxes: [
      {
        key: "consentimento_email",
        text: "Aceito receber por email os guias solicitados, conselhos, novidades e comunicações comerciais do Guia do Proprietário, incluindo ofertas de empresas terceiras. O meu email não é partilhado com essas empresas. Posso cancelar a qualquer momento.",
        is_required: true,
        is_checked_by_default: false
      }
    ]
  };

  const thankYouPage = {
    title: "Obrigado — os dois manuais estão a caminho",
    body: "Enviámos os guias para o email indicado. Pode consultar também o Kit do Estudante Deslocado.",
    button_type: "VIEW_WEBSITE",
    button_text: "Ver o kit",
    website_url: KIT_URL
  };

  return {
    questions: JSON.stringify(questions),
    context_card: JSON.stringify(contextCard),
    privacy_policy: JSON.stringify(privacyPolicy),
    custom_disclaimer: JSON.stringify(customDisclaimer),
    thank_you_page: JSON.stringify(thankYouPage)
  };
}

export const onRequestPost = async ({ request, env }: RequestContext) => {
  const adminSecret = env.META_FORM_ADMIN_SECRET || "";
  if (!adminSecret || !isAuthorized(request, adminSecret)) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const token = env.META_PAGE_ACCESS_TOKEN || "";
  const version = env.META_GRAPH_VERSION || DEFAULT_META_GRAPH_VERSION;
  if (!token) return json({ error: "meta_page_access_token_missing" }, 503);

  try {
    const existing = (await listForms(token, version)).find(
      (form) => cleanText(form.name, 120) === FORM_NAME
    );
    if (existing) {
      const id = cleanText(existing.id, 100);
      const status = cleanText(existing.status, 40);
      if (status !== "ACTIVE") {
        return json({ error: "form_exists_not_active", id, status }, 409);
      }
      return json({ ok: true, created: false, id, name: FORM_NAME, status });
    }

    const body = new URLSearchParams({
      name: FORM_NAME,
      locale: "PT_PT",
      allow_organic_lead_retrieval: "false",
      block_display_for_non_targeted_viewer: "true",
      is_optimized_for_quality: "false",
      follow_up_action_url: KIT_URL,
      question_page_custom_headline: "Preencha os dados para receber os dois manuais.",
      ...formFields()
    });

    const response = await fetch(graphEndpoint(version), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body,
      signal: AbortSignal.timeout(12_000)
    });
    const result = await metaJson(response);
    const id = cleanText(result.id, 100);
    if (!id) throw new Error("meta_form_missing_id");
    return json({ ok: true, created: true, id, name: FORM_NAME, status: "ACTIVE" }, 201);
  } catch (error) {
    const code = error instanceof Error ? cleanText(error.message, 120) : "meta_form_failed";
    return json({ error: code || "meta_form_failed" }, 502);
  }
};
