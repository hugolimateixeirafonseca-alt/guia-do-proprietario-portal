import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { pilares } from "../config";
import concelhos from "../dados/concelhos.json";

export const prerender = true;

export const GET: APIRoute = async () => {
  const artigos = await getCollection("artigos", ({ data }) => !data.rascunho);
  const notas = await getCollection("notas");

  const entradas = [
    ...artigos.map((artigo) => ({
      titulo: artigo.data.titulo,
      descricao: artigo.data.descricao,
      pilar: pilares.find((item) => item.slug === artigo.data.pilar)?.nome ?? artigo.data.pilar,
      url: `/${artigo.data.pilar}/${artigo.id}/`
    })),
    ...notas.map((nota) => ({
      titulo: nota.data.titulo,
      descricao: nota.data.resumo,
      pilar: "Novidades",
      url: `/novidades/${nota.id}/`
    })),
    ...pilares.map((pilar) => ({
      titulo: pilar.nome,
      descricao: pilar.descricao,
      pilar: "Tema",
      url: `/${pilar.slug}/`
    })),
    ...concelhos.dados.flatMap((concelho) => [
      {
        titulo: `IMI em ${concelho.nome}`,
        descricao: `Taxa de IMI, prazos e informação municipal para proprietários em ${concelho.nome}.`,
        pilar: "IMI por concelho",
        url: `/imi/${concelho.slug}/`
      },
      {
        titulo: `Preços das casas em ${concelho.nome}`,
        descricao: `Mediana das vendas e evolução recente dos preços da habitação em ${concelho.nome}.`,
        pilar: "Preços por concelho",
        url: `/precos-casas/${concelho.slug}/`
      }
    ]),
    { titulo: "Calendário do proprietário", descricao: "Prazos e datas importantes ao longo do ano.", pilar: "Calendário", url: "/calendario/" },
    { titulo: "Simuladores", descricao: "Ferramentas gratuitas para estimar o IMI e o valor líquido de uma venda.", pilar: "Ferramentas", url: "/simuladores/" },
    { titulo: "Simulador de IMI", descricao: "Estime o IMI anual a partir do concelho e do valor patrimonial.", pilar: "Ferramentas", url: "/simuladores/imi/" },
    { titulo: "Simulador do valor líquido da venda", descricao: "Estime quanto pode sobrar depois dos principais custos de vender uma casa.", pilar: "Ferramentas", url: "/simuladores/valor-liquido-venda/" },
    { titulo: "Glossário", descricao: "Definições simples dos termos usados no portal.", pilar: "Informação", url: "/glossario/" },
    { titulo: "Novidades", descricao: "Atualizações recentes para proprietários em Portugal.", pilar: "Novidades", url: "/novidades/" },
    { titulo: "Sobre o Guia do Proprietário", descricao: "Quem está por trás do portal e qual é o seu objetivo.", pilar: "Informação", url: "/sobre/" },
    { titulo: "Como produzimos os conteúdos", descricao: "Fontes, verificação, atualizações e correções editoriais.", pilar: "Informação", url: "/metodologia/" }
  ];

  return new Response(JSON.stringify(entradas), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" }
  });
};
