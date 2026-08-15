import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import precos from "../dados/precos-concelhos.json";
import imi from "../dados/imi-concelhos.json";
import { compararPorPublicacao } from "../lib/artigos";
import { compararNotasRecentes, deduplicarNotas } from "../lib/notas";

export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString() || "https://guiadoproprietario.pt/";
  const artigos = (await getCollection("artigos", ({ data }) => !data.rascunho)).sort(compararPorPublicacao);
  const notas = deduplicarNotas((await getCollection("notas")).sort(compararNotasRecentes));
  const og = (route: string) => new URL(`/og${route}index.png`, base).toString();
  const artigoItems = artigos.map((artigo) => {
    const route = `/${artigo.data.pilar}/${artigo.id}/`;
    return { titulo: artigo.data.titulo, url: new URL(route, base).toString(), descricao: artigo.data.descricao, pilar: artigo.data.pilar, nivel: artigo.data.nivel, publicado: artigo.data.publicado_em.toISOString(), revisto: artigo.data.revisto.toISOString(), tipo: "artigo", imagem_og: og(route) };
  });
  const notaItems = notas.map((nota) => {
    const route = `/novidades/${nota.id}/`;
    return { titulo: nota.data.titulo, url: new URL(route, base).toString(), descricao: nota.data.resumo, pilar: nota.data.pilar || null, publicado: nota.data.data.toISOString(), revisto: nota.data.data.toISOString(), tipo: "nota", imagem_og: og(route) };
  });
  const atualizadoImi = `${imi.extraido_em}T00:00:00.000Z`;
  const atualizadoPrecos = `${precos.extraido_em}T00:00:00.000Z`;
  const imiItems = imi.dados.map((item) => { const route = `/imi/${item.slug}/`; return { titulo: `IMI em ${item.nome}`, url: new URL(route, base).toString(), descricao: `Taxa oficial de IMI de ${imi.periodo_referencia} em ${item.nome}.`, pilar: "impostos", publicado: atualizadoImi, revisto: atualizadoImi, tipo: "programatica-imi", imagem_og: og(route) }; });
  const precoItems = precos.dados.map((item) => { const route = `/precos-casas/${item.slug}/`; return { titulo: `Preços das casas em ${item.nome}`, url: new URL(route, base).toString(), descricao: `Mediana das vendas dos últimos 12 meses em ${item.nome}, atualizada no ${item.periodo_atual}.`, pilar: "vender", publicado: atualizadoPrecos, revisto: atualizadoPrecos, tipo: "programatica-precos", imagem_og: og(route) }; });
  return new Response(JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), items: [...artigoItems, ...notaItems, ...imiItems, ...precoItems] }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
