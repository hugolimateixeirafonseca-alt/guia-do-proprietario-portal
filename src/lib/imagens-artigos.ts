import type { CollectionEntry } from "astro:content";

const TOTAL_IMAGENS_POR_PILAR = 6;

function hashEstavel(texto: string) {
  let hash = 2166136261;

  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function caminhoAlternativo(caminho: string, extensao: "avif" | "webp") {
  return caminho.replace(/\.(avif|webp|png|jpe?g)$/i, `.${extensao}`);
}

export function obterImagensArtigo(artigo: CollectionEntry<"artigos">) {
  const imagemPropria = artigo.data.imagem_capa;

  if (imagemPropria && imagemPropria !== "auto") {
    return {
      avif: caminhoAlternativo(imagemPropria, "avif"),
      webp: caminhoAlternativo(imagemPropria, "webp")
    };
  }

  const numero = (hashEstavel(artigo.id) % TOTAL_IMAGENS_POR_PILAR) + 1;
  const nome = String(numero).padStart(2, "0");
  const base = `/imagens/pilares/${artigo.data.pilar}/${nome}`;

  return {
    avif: `${base}.avif`,
    webp: `${base}.webp`
  };
}