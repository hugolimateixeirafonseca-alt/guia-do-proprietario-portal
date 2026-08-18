import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { compararPorPublicacao } from "../lib/artigos";

export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString() || "https://guiadoproprietario.pt/";
  const artigos = (await getCollection("artigos", ({ data }) => !data.rascunho))
    .sort(compararPorPublicacao)
    .slice(0, 80);

  const items = artigos.map((artigo) => {
    const route = `/${artigo.data.pilar}/${artigo.id}/`;
    return {
      titulo: artigo.data.titulo,
      url: new URL(route, base).toString(),
      descricao: artigo.data.descricao,
      pilar: artigo.data.pilar,
      temas: artigo.data.temas || [],
      publicado: artigo.data.publicado_em.toISOString(),
      revisto: artigo.data.revisto.toISOString(),
      aviso: artigo.data.aviso,
      imagem: artigo.data.imagem_capa || new URL(`/og${route}index.png`, base).toString(),
    };
  });

  return new Response(
    JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), count: items.length, items }),
    { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" } },
  );
};
