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
    const imagemCapa = artigo.data.imagem_capa || "";
    const imagemWeb = imagemCapa
      ? new URL(imagemCapa.replace(/\.avif(?:\?.*)?$/i, ".webp"), base).toString()
      : new URL(`/og${route}index.png`, base).toString();
    const imagemSocial = imagemCapa
      ? new URL(imagemCapa.replace(/\.(?:avif|webp|png|jpe?g)(?:\?.*)?$/i, ".social.jpg"), base).toString()
      : new URL(`/og${route}index.png`, base).toString();

    return {
      titulo: artigo.data.titulo,
      url: new URL(route, base).toString(),
      descricao: artigo.data.descricao,
      pilar: artigo.data.pilar,
      temas: artigo.data.temas || [],
      publicado: artigo.data.publicado_em.toISOString(),
      revisto: artigo.data.revisto.toISOString(),
      aviso: artigo.data.aviso,
      imagem: imagemSocial,
      imagem_social: imagemSocial,
      imagem_web: imagemWeb,
    };
  });

  return new Response(
    JSON.stringify({ version: 2, generatedAt: new Date().toISOString(), count: items.length, items }),
    { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" } },
  );
};
