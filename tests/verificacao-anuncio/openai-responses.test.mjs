import assert from "node:assert/strict";
import test from "node:test";
import { createOpenAIResponsesAdapters } from "../../src/lib/verificacao-anuncio/openai-responses.mjs";
import { classification, extraction } from "./fixtures.mjs";

test("a Passagem A envia imagens e exige o schema de extração", async () => {
  let body;
  const adapters = createOpenAIResponsesAdapters({
    apiKey: "secret",
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify(extraction()) }] }] }), { status: 200 });
    }
  });
  await adapters.extractor.extract({ images: ["data:image/jpeg;base64,YQ=="], city: "Porto", attempt: 1 });
  assert.equal(body.model, "gpt-5.4-mini");
  assert.equal(body.store, false);
  assert.equal(body.input[1].content[1].type, "input_image");
  assert.equal(body.text.format.name, "verificacao_anuncio_extracao");
  const schemaJson = JSON.stringify(body.text.format.schema);
  assert.equal(/"(?:const|uniqueItems|maxLength|minLength)"/u.test(schemaJson), false);
});

test("a Passagem B recebe apenas estruturas e nunca volta a enviar imagens", async () => {
  let serializedBody;
  const adapters = createOpenAIResponsesAdapters({
    apiKey: "secret",
    fetchImpl: async (_url, init) => {
      serializedBody = init.body;
      return new Response(JSON.stringify({ output_text: JSON.stringify(classification()) }), { status: 200 });
    }
  });
  await adapters.classifier.classify({ extraction: extraction(), reverseResults: [], priceReference: null, attempt: 1 });
  assert.equal(serializedBody.includes("input_image"), false);
  assert.equal(JSON.parse(serializedBody).text.format.name, "verificacao_anuncio_classificacao");
});

test("um erro da OpenAI conserva apenas o diagnóstico técnico seguro", async () => {
  const adapters = createOpenAIResponsesAdapters({
    apiKey: "secret",
    fetchImpl: async () => new Response(JSON.stringify({
      error: { type: "invalid_request_error", code: "invalid_json_schema", param: "text.format.schema" }
    }), { status: 400 })
  });
  await assert.rejects(
    adapters.extractor.extract({ images: ["data:image/jpeg;base64,YQ=="], city: "Porto", attempt: 1 }),
    /openai_responses_400_invalid_request_error_invalid_json_schema_text.format.schema/u
  );
});
