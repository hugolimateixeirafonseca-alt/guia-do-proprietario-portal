import { validateReverseEvidence } from "./validate.mjs";

const httpsUrl = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const privateIp = /^(?:10|127)\.|^169\.254\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\.|^0\.|^\[?::1\]?$/u.test(host);
    const localName = host === "localhost" || host.endsWith(".local") || host.endsWith(".internal");
    return url.protocol === "https:" && !url.username && !url.password && !privateIp && !localName ? url : null;
  } catch {
    return null;
  }
};

const slug = (value) => String(value ?? "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, "_")
  .replace(/^_|_$/gu, "")
  .slice(0, 60);

export function normalizeGoogleVisionResult(raw, photoId) {
  const web = raw?.responses?.[0]?.webDetection ?? raw?.webDetection ?? {};
  const candidates = [];
  for (const [index, page] of (web.pagesWithMatchingImages ?? []).entries()) {
    const pageUrl = httpsUrl(page.url);
    if (!pageUrl) continue;
    const full = page.fullMatchingImages?.[0]?.url ?? web.fullMatchingImages?.[index]?.url ?? null;
    const partial = page.partialMatchingImages?.[0]?.url ?? web.partialMatchingImages?.[index]?.url ?? null;
    candidates.push({
      id: `imagem_${slug(photoId)}_google_${index + 1}`,
      photo_id: photoId,
      provider: "google_cloud_vision",
      match_type: full ? "exact" : partial ? "near_exact" : "visual",
      source_url: pageUrl.href,
      source_domain: pageUrl.hostname,
      matched_image_url: httpsUrl(full ?? partial)?.href ?? null,
      provider_score: Number.isFinite(page.score) ? page.score : null,
      provider_title: typeof page.pageTitle === "string" ? page.pageTitle : null
    });
  }
  return candidates;
}

export function normalizeTinEyeResult(raw, photoId) {
  const matches = raw?.results?.matches ?? raw?.matches ?? [];
  const candidates = [];
  for (const [matchIndex, match] of matches.entries()) {
    for (const [backlinkIndex, backlink] of (match.backlinks ?? []).entries()) {
      const pageUrl = httpsUrl(backlink.backlink);
      if (!pageUrl) continue;
      candidates.push({
        id: `imagem_${slug(photoId)}_tineye_${matchIndex + 1}_${backlinkIndex + 1}`,
        photo_id: photoId,
        provider: "tineye",
        match_type: "near_exact",
        source_url: pageUrl.href,
        source_domain: pageUrl.hostname,
        matched_image_url: httpsUrl(backlink.url)?.href ?? null,
        provider_score: Number.isFinite(match.score) ? match.score : null,
        provider_crawl_date: typeof backlink.crawl_date === "string" ? backlink.crawl_date : null
      });
    }
  }
  return candidates;
}

export function deduplicateReverseCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.photo_id}|${candidate.source_domain}|${candidate.source_url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function finalizeReverseEvidence(candidate, localMatch, pageEvidence) {
  const strongMatch = localMatch?.decision === "same" || localMatch?.decision === "near_exact";
  const contextVerified = pageEvidence?.verified === true;
  let state = "correspondencia_inconclusiva";
  if (strongMatch && contextVerified && pageEvidence.context_relation === "same") {
    state = "correspondencia_mesmo_contexto";
  } else if (strongMatch && contextVerified && pageEvidence.context_relation === "different") {
    state = "correspondencia_contexto_diferente";
  }
  return validateReverseEvidence({
    id: candidate.id,
    photo_id: candidate.photo_id,
    provider: candidate.provider,
    state,
    match_type: candidate.match_type,
    source_url: candidate.source_url,
    source_domain: candidate.source_domain,
    matched_image_url: candidate.matched_image_url,
    context_verified: contextVerified,
    context_excerpt: contextVerified ? pageEvidence.excerpt ?? null : null,
    source_location: contextVerified ? pageEvidence.location ?? null : null,
    source_date: contextVerified ? pageEvidence.date ?? null : null
  });
}
