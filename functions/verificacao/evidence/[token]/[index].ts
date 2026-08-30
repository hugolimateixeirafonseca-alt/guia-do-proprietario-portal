import { validateAccessToken } from "../../../../src/lib/verificacao-anuncio/intake.mjs";
import { PublicVerificationError, requireConfiguration, safeError, sha256, type RequestContext } from "../../../lib/verificacao-anuncio";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const onRequestGet = async ({ request, env }: RequestContext) => {
  try {
    const config = requireConfiguration(env);
    if (!config.uploads) throw new PublicVerificationError(404, "evidence_not_found");
    const parts = new URL(request.url).pathname.split("/").filter(Boolean);
    const rawToken = decodeURIComponent(parts.at(-2) || "");
    const position = Number.parseInt(parts.at(-1) || "", 10);
    let token: string;
    try { token = validateAccessToken(rawToken); } catch { throw new PublicVerificationError(404, "evidence_not_found"); }
    if (!Number.isInteger(position) || position < 1 || position > 8) throw new PublicVerificationError(404, "evidence_not_found");

    const row = await config.db.prepare(
      `SELECT id, ficheiros_json AS ficheirosJson, imagens_apagadas AS imagensApagadas, expira_em AS expiraEm
       FROM verificacao_anuncio_jobs WHERE access_token_hash = ? AND estado = 'entregue' LIMIT 1`
    ).bind(await sha256(token)).first<{ id: string; ficheirosJson: string | null; imagensApagadas: number; expiraEm: string }>();
    if (!row || row.imagensApagadas || !row.ficheirosJson || Date.parse(row.expiraEm) <= Date.now()) {
      throw new PublicVerificationError(404, "evidence_not_found");
    }

    let files: Array<{ key?: string; contentType?: string }>;
    try { files = JSON.parse(row.ficheirosJson); } catch { throw new PublicVerificationError(404, "evidence_not_found"); }
    const file = files[position - 1];
    if (!file?.key?.startsWith(`${row.id}/`) || !file.contentType || !allowedTypes.has(file.contentType)) {
      throw new PublicVerificationError(404, "evidence_not_found");
    }
    const object = await config.uploads.get(file.key);
    if (!object) throw new PublicVerificationError(404, "evidence_not_found");
    return new Response(object.body, {
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return safeError(error);
  }
};
