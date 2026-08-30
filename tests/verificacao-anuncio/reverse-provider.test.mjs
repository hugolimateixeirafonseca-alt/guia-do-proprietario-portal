import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleVisionProvider, createTinEyeProvider } from "../../src/lib/verificacao-anuncio/reverse-provider.mjs";

test("o adapter Google Vision pede Web Detection e normaliza a resposta", async () => {
  let request;
  const provider = createGoogleVisionProvider({
    apiKey: "api-key",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ responses: [{ webDetection: { pagesWithMatchingImages: [
        { url: "https://example.com/anuncio" }
      ] } }] }), { status: 200 });
    }
  });
  const results = await provider.search({ id: "sala", base64: "YWJj" });
  assert.equal(JSON.parse(request.init.body).requests[0].features[0].type, "WEB_DETECTION");
  assert.equal(results[0].source_domain, "example.com");
  assert.equal(request.url.includes("api-key"), true);
});

test("o adapter Google Vision conserva apenas o motivo técnico seguro", async () => {
  const provider = createGoogleVisionProvider({
    apiKey: "api-key",
    fetchImpl: async () => new Response(JSON.stringify({
      error: { status: "PERMISSION_DENIED", details: [{ reason: "API_KEY_SERVICE_BLOCKED" }] }
    }), { status: 403 })
  });
  await assert.rejects(
    provider.search({ id: "sala", base64: "YWJj" }),
    /google_vision_403_API_KEY_SERVICE_BLOCKED/u
  );
});

test("o adapter TinEye mantém o cliente substituível no benchmark", async () => {
  const provider = createTinEyeProvider({ client: { search: async () => ({ matches: [] }) } });
  assert.deepEqual(await provider.search({ id: "sala", image: new Uint8Array() }), []);
});
