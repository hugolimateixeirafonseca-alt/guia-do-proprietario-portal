import { CLASSIFICATION_SCHEMA, EXTRACTION_SCHEMA } from "./schemas.mjs";
import { CLASSIFICATION_PROMPT, EXTRACTION_PROMPT } from "./prompts.mjs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function diagnosticPart(value) {
  return String(value ?? "unknown").replace(/[^a-z0-9_.-]/giu, "_").slice(0, 80);
}

function readOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("openai_output_text_missing");
}

function parseStructuredOutput(payload) {
  const text = readOutputText(payload);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("openai_output_json_invalid");
  }
}

function imageUrl(image) {
  const value = typeof image === "string" ? image : image?.dataUrl ?? image?.url;
  if (!/^data:image\/(?:png|jpeg|webp);base64,/u.test(value ?? "") && !/^https:\/\//u.test(value ?? "")) {
    throw new TypeError("Imagem sem data URL ou URL HTTPS válida.");
  }
  return value;
}

export function createOpenAIResponsesAdapters({
  apiKey,
  fetchImpl = fetch,
  extractionModel = "gpt-5.4-mini",
  classificationModel = "gpt-5.4-mini",
  onUsage = (_record) => {}
}) {
  if (!apiKey) throw new TypeError("OPENAI_API_KEY não configurada.");

  const request = async (body) => {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ...body, store: false }),
      signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      const apiError = failure?.error;
      throw new Error([
        "openai_responses",
        response.status,
        diagnosticPart(apiError?.type),
        diagnosticPart(apiError?.code),
        diagnosticPart(apiError?.param)
      ].join("_"));
    }
    const payload = await response.json();
    onUsage({ model: body.model, usage: payload?.usage ?? null });
    return parseStructuredOutput(payload);
  };

  return {
    extractor: {
      async extract({ images, city, attempt }) {
        return request({
          model: extractionModel,
          input: [
            { role: "developer", content: EXTRACTION_PROMPT },
            {
              role: "user",
              content: [
                { type: "input_text", text: JSON.stringify({ city: city ?? null, attempt, image_count: images.length }) },
                ...images.map((image) => ({ type: "input_image", image_url: imageUrl(image) }))
              ]
            }
          ],
          text: { format: { type: "json_schema", name: "verificacao_anuncio_extracao", strict: true, schema: EXTRACTION_SCHEMA } }
        });
      }
    },
    classifier: {
      async classify({ extraction, priceReference, attempt }) {
        return request({
          model: classificationModel,
          input: [
            { role: "developer", content: CLASSIFICATION_PROMPT },
            { role: "user", content: JSON.stringify({ extraction, priceReference, attempt }) }
          ],
          text: { format: { type: "json_schema", name: "verificacao_anuncio_classificacao", strict: true, schema: CLASSIFICATION_SCHEMA } }
        });
      }
    }
  };
}
