import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[char]!);

export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString() || "https://guiadoproprietario.pt/";
  const artigos = (await getCollection("artigos", ({ data }) => !data.rascunho)).sort((a, b) => b.data.publicado.valueOf() - a.data.publicado.valueOf());
  const items = artigos.map((artigo) => { const url = new URL(`/${artigo.data.pilar}/${artigo.id}/`, base).toString(); return `<item><title>${escapeXml(artigo.data.titulo)}</title><link>${url}</link><guid>${url}</guid><description>${escapeXml(artigo.data.descricao)}</description><pubDate>${artigo.data.publicado.toUTCString()}</pubDate></item>`; }).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Guia do Proprietário</title><link>${base}</link><description>Guias e ferramentas para proprietários em Portugal.</description>${items}</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
