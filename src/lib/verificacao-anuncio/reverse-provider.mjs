import {
  deduplicateReverseCandidates,
  normalizeGoogleVisionResult,
  normalizeTinEyeResult
} from "./reverse-image.mjs";

const diagnosticPart = (value) => String(value ?? "unknown")
  .replace(/[^a-z0-9_.-]/giu, "_")
  .slice(0, 80);

export function createGoogleVisionProvider({ apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new TypeError("GOOGLE_CLOUD_VISION_API_KEY não configurada.");
  return {
    name: "google_cloud_vision",
    async search(photo) {
      if (!photo?.base64 && !photo?.imageBase64) throw new TypeError("A fotografia não contém dados base64.");
      const response = await fetchImpl(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ requests: [{
          image: { content: photo.base64 ?? photo.imageBase64 },
          features: [{ type: "WEB_DETECTION", maxResults: 10 }]
        }] }),
        signal: AbortSignal.timeout(20_000)
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        const reason = failure?.error?.details?.find((detail) => detail?.reason)?.reason
          ?? failure?.error?.status
          ?? failure?.error?.code;
        throw new Error(`google_vision_${response.status}_${diagnosticPart(reason)}`);
      }
      return deduplicateReverseCandidates(normalizeGoogleVisionResult(await response.json(), photo.id));
    }
  };
}

export function createTinEyeProvider({ client }) {
  if (!client || typeof client.search !== "function") {
    throw new TypeError("Cliente oficial ou compatível do TinEye não configurado.");
  }
  return {
    name: "tineye",
    async search(photo) {
      const raw = await client.search({ image: photo.image, photoId: photo.id });
      return deduplicateReverseCandidates(normalizeTinEyeResult(raw, photo.id));
    }
  };
}
