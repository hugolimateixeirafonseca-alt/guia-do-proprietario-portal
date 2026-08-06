import type { CollectionEntry } from "astro:content";

type Artigo = CollectionEntry<"artigos">;

const palavrasGenericas = new Set([
  "agora", "ainda", "antes", "artigo", "casa", "caso", "como", "com", "cada",
  "depois", "desde", "deve", "entre", "esta", "este", "fazer", "mais", "menos",
  "mesmo", "muito", "nao", "para", "pela", "pelo", "pode", "porque", "quanto",
  "quais", "qual", "quando", "sem", "sobre", "tambem", "tudo", "uma", "voce"
]);

const equivalencias: Record<string, string> = {
  arrendar: "arrendamento",
  arrendada: "arrendamento",
  arrendado: "arrendamento",
  arrendamentos: "arrendamento",
  rendas: "renda",
  senhorios: "senhorio",
  inquilinos: "inquilino",
  condominios: "condominio",
  infiltracoes: "infiltracao",
  humidades: "humidade",
  impostos: "imposto",
  vendas: "venda"
};

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function termos(texto: string) {
  return normalizar(texto)
    .split(/\s+/)
    .filter((palavra) => palavra.length >= 3 && !palavrasGenericas.has(palavra))
    .map((palavra) => equivalencias[palavra] ?? palavra);
}

function contarTermos(artigo: Artigo) {
  const pesos = new Map<string, number>();
  const adicionar = (texto: string, peso: number) => {
    for (const termo of termos(texto)) pesos.set(termo, (pesos.get(termo) ?? 0) + peso);
  };

  adicionar(artigo.id, 7);
  adicionar(artigo.data.titulo, 7);
  adicionar(artigo.data.descricao, 3);
  adicionar(artigo.data.resposta_rapida, 1);
  for (const tema of artigo.data.temas ?? []) adicionar(tema, 12);

  return pesos;
}

export function dataDeChegada(artigo: Artigo) {
  return artigo.data.chegada ?? artigo.data.publicado;
}

export function compararPorChegada(a: Artigo, b: Artigo) {
  const diferencaChegada = dataDeChegada(b).valueOf() - dataDeChegada(a).valueOf();
  if (diferencaChegada !== 0) return diferencaChegada;

  const diferencaPublicacao = b.data.publicado.valueOf() - a.data.publicado.valueOf();
  if (diferencaPublicacao !== 0) return diferencaPublicacao;

  return a.data.titulo.localeCompare(b.data.titulo, "pt");
}

export function obterArtigosSemelhantes(artigo: Artigo, artigos: Artigo[], quantidade = 3) {
  const termosOrigem = contarTermos(artigo);

  return artigos
    .filter((candidato) => candidato.id !== artigo.id && candidato.id !== artigo.data.par)
    .map((candidato) => {
      const termosCandidato = contarTermos(candidato);
      let afinidade = candidato.data.pilar === artigo.data.pilar ? 4 : 0;

      for (const [termo, pesoOrigem] of termosOrigem) {
        const pesoCandidato = termosCandidato.get(termo);
        if (pesoCandidato) afinidade += Math.min(pesoOrigem, pesoCandidato);
      }

      return { artigo: candidato, afinidade };
    })
    .sort((a, b) => b.afinidade - a.afinidade || compararPorChegada(a.artigo, b.artigo))
    .slice(0, quantidade)
    .map((item) => item.artigo);
}
