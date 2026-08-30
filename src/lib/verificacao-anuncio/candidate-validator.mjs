import { finalizeReverseEvidence } from "./reverse-image.mjs";
import { SUPPORTED_CITIES } from "./price-reference.mjs";

const normalize = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLocaleLowerCase("pt-PT");

const textOnly = (html) => String(html ?? "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
  .replace(/<[^>]+>/gu, " ")
  .replace(/&nbsp;|&#160;/giu, " ")
  .replace(/&amp;/giu, "&")
  .replace(/&quot;/giu, "\"")
  .replace(/&#39;|&apos;/giu, "'")
  .replace(/\s+/gu, " ")
  .trim();

function excerptAround(text, needle) {
  const normalized = normalize(text);
  const index = normalized.indexOf(normalize(needle));
  if (index < 0) return null;
  const start = Math.max(0, index - 170);
  return text.slice(start, Math.min(text.length, start + 450)).trim();
}

export function createCandidateValidator({ fetchImpl = fetch } = {}) {
  return {
    async validate({ candidate, city }) {
      const localMatch = {
        decision: candidate.match_type === "exact" ? "same"
          : candidate.match_type === "near_exact" ? "near_exact" : "review"
      };
      let pageEvidence = { verified: false };
      try {
        const response = await fetchImpl(candidate.source_url, {
          headers: { Accept: "text/html,application/xhtml+xml" },
          redirect: "follow",
          signal: AbortSignal.timeout(8_000)
        });
        const contentType = response.headers.get("Content-Type") || "";
        const declaredLength = Number(response.headers.get("Content-Length") || "0");
        if (!response.ok || !contentType.toLowerCase().includes("text/html") || declaredLength > 1_500_000) {
          return finalizeReverseEvidence(candidate, localMatch, pageEvidence);
        }
        const html = (await response.text()).slice(0, 1_500_000);
        const visible = textOnly(html).slice(0, 150_000);
        const advertisedCity = SUPPORTED_CITIES.find((name) => normalize(name) === normalize(city));
        const mentioned = SUPPORTED_CITIES.filter((name) => normalize(visible).includes(normalize(name)));
        const sourceCity = advertisedCity && mentioned.includes(advertisedCity)
          ? advertisedCity
          : mentioned.find((name) => name !== advertisedCity) ?? null;
        if (sourceCity) {
          pageEvidence = {
            verified: true,
            context_relation: sourceCity === advertisedCity ? "same" : "different",
            excerpt: excerptAround(visible, sourceCity),
            location: sourceCity,
            date: null
          };
        }
      } catch {
        pageEvidence = { verified: false };
      }
      return finalizeReverseEvidence(candidate, localMatch, pageEvidence);
    }
  };
}
