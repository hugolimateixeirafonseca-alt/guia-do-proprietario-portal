import path from "node:path";
import {
  PROJECT_ROOT,
  argumentos,
  escreverJson,
  hojeIso,
  normalizar,
  obterJsonComCache,
  periodoCurto,
  slugBase
} from "./lib/dados-utils.mjs";
import { concelhosSchema, precosSchema } from "./dados-schemas.mjs";

const INDICADOR = "0012234";
const META_URL = `https://www.ine.pt/ine/json_indicador/pindicaMeta.jsp?varcd=${INDICADOR}&lang=PT`;
const API_URL = "https://www.ine.pt/ine/json_indicador/pindica.jsp";
const opcoes = argumentos();
const semRede = Boolean(opcoes["sem-rede"]);
const forcar = Boolean(opcoes.forcar);
const cacheDir = path.join(PROJECT_ROOT, "scripts", "cache", "ine", INDICADOR);
const dadosDir = path.join(PROJECT_ROOT, "src", "dados");

function categorias(meta, dimensao) {
  const recipiente = meta.Dimensoes?.Categoria_Dim?.[0];
  if (!recipiente) throw new Error("A metainformação do INE não contém Categoria_Dim.");
  return Object.values(recipiente)
    .flatMap((valor) => Array.isArray(valor) ? valor : [valor])
    .filter((item) => String(item.dim_num) === String(dimensao));
}

function distritoPorCodigo(codigo) {
  const prefixo = codigo.slice(0, 2);
  const distritos = {
    "01": "Aveiro", "02": "Beja", "03": "Braga", "04": "Bragança",
    "05": "Castelo Branco", "06": "Coimbra", "07": "Évora", "08": "Faro",
    "09": "Guarda", "10": "Leiria", "11": "Lisboa", "12": "Portalegre",
    "13": "Porto", "14": "Santarém", "15": "Setúbal", "16": "Viana do Castelo",
    "17": "Vila Real", "18": "Viseu"
  };
  if (distritos[prefixo]) return distritos[prefixo];
  if (["31", "32"].includes(prefixo)) return "Região Autónoma da Madeira";
  if (/^4[1-9]$/.test(prefixo)) return "Região Autónoma dos Açores";
  throw new Error(`Não foi possível determinar o distrito ou região do código INE ${codigo}.`);
}

function slugMunicipio(nome, codigo, nomesRepetidos) {
  const base = slugBase(nome);
  if (!nomesRepetidos.has(normalizar(nome))) return base;
  if (base === "calheta") return codigo.startsWith("31") ? "calheta-madeira" : "calheta-acores";
  if (base === "lagoa") return codigo.startsWith("08") ? "lagoa-algarve" : "lagoa-acores";
  return `${base}-${codigo}`;
}

function nomeMunicipio(designacao) {
  return designacao.replace(/\s*\(R\.A\.[AM]\.\)\s*$/i, "").trim();
}

function construirConcelhos(meta) {
  const geografia = categorias(meta, 2);
  const nuts3 = new Map(geografia.filter((item) => item.categ_nivel === "4").map((item) => [item.cat_id, item.categ_dsg]));
  const municipios = geografia
    .filter((item) => item.categ_nivel === "5")
    .map((item) => ({ ...item, nome: nomeMunicipio(item.categ_dsg) }));
  if (municipios.length !== 308) throw new Error(`Esperavam-se 308 municípios na metainformação, foram encontrados ${municipios.length}.`);
  const contagemNomes = new Map();
  for (const municipio of municipios) {
    const chave = normalizar(municipio.nome);
    contagemNomes.set(chave, (contagemNomes.get(chave) || 0) + 1);
  }
  const repetidos = new Set([...contagemNomes].filter(([, total]) => total > 1).map(([nome]) => nome));
  const dados = municipios.map((municipio) => {
    const codigoIne = municipio.cat_id.slice(-4);
    const nuts3Codigo = municipio.cat_id.slice(0, -4);
    const nuts3Nome = nuts3.get(nuts3Codigo);
    if (!nuts3Nome) throw new Error(`NUTS III em falta para ${municipio.nome} (${municipio.cat_id}).`);
    return {
      slug: slugMunicipio(municipio.nome, codigoIne, repetidos),
      nome: municipio.nome,
      distrito: distritoPorCodigo(codigoIne),
      codigo_ine: codigoIne,
      nuts3: nuts3Nome,
      nuts3_codigo: nuts3Codigo
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  return {
    fonte: "INE",
    fonte_url: META_URL,
    periodo_referencia: "NUTS 2024",
    extraido_em: hojeIso(),
    notas: "Lista mestra dos 308 municípios usada para juntar as fontes da AT e do INE.",
    dados
  };
}

function corpoResposta(resposta) {
  if (resposta?.Dados) return resposta;
  if (Array.isArray(resposta) && resposta[0]?.Dados) return resposta[0];
  if (Array.isArray(resposta?.value) && resposta.value[0]?.Dados) return resposta.value[0];
  throw new Error("A resposta do indicador não contém o objeto Dados esperado.");
}

function mapaValores(resposta, designacao) {
  const corpo = corpoResposta(resposta);
  const linhas = corpo.Dados?.[designacao];
  if (!Array.isArray(linhas)) throw new Error(`O INE não devolveu linhas para ${designacao}.`);
  return new Map(linhas.map((linha) => [
    linha.geocod,
    linha.valor === undefined || linha.valor === null || linha.valor === "" ? null : Number(linha.valor)
  ]));
}

function validarControlos(periodo, mapa, concelhos) {
  if (periodo !== "4.º Trimestre de 2025") return;
  const esperados = {
    Portugal: 2076, Lisboa: 4875, Cascais: 4550, Oeiras: 4187,
    Funchal: 3100, Coimbra: 2095, Braga: 1996
  };
  const codigos = new Map(concelhos.dados.map((item) => [item.nome, `${item.nuts3_codigo}${item.codigo_ine}`]));
  codigos.set("Portugal", "PT");
  for (const [nome, esperado] of Object.entries(esperados)) {
    const obtido = mapa.get(codigos.get(nome));
    if (obtido !== esperado) throw new Error(`Controlo INE falhou para ${nome} em 4T2025: esperado ${esperado}, obtido ${obtido}.`);
  }
}

console.log(`A obter metainformação do indicador ${INDICADOR}...`);
const metaResposta = await obterJsonComCache({
  url: META_URL,
  cache: path.join(cacheDir, "meta.json"),
  semRede,
  forcar,
  intervalo: 400
});
const meta = Array.isArray(metaResposta) ? metaResposta[0] : metaResposta;
if (meta.IndicadorCod !== INDICADOR) throw new Error(`Indicador inesperado: ${meta.IndicadorCod}`);
if (!meta.IndicadorNome.includes("últimos 12 meses")) throw new Error("O indicador deixou de representar os últimos 12 meses.");

const concelhos = construirConcelhos(meta);
concelhosSchema.parse(concelhos);
await escreverJson(path.join(dadosDir, "concelhos.json"), concelhos);
console.log("Lista mestra escrita: 308 municípios.");

const periodos = categorias(meta, 1)
  .sort((a, b) => Number(a.categ_ord) - Number(b.categ_ord))
  .slice(-5);
if (periodos.length !== 5) throw new Error("Não foi possível resolver as cinco leituras mais recentes.");

const leituras = [];
for (const periodo of periodos) {
  const parametros = new URLSearchParams({
    op: "2", varcd: INDICADOR, Dim1: periodo.cat_id, Dim3: "H1", lang: "PT"
  });
  console.log(`A obter ${periodo.categ_dsg}...`);
  const resposta = await obterJsonComCache({
    url: `${API_URL}?${parametros}`,
    cache: path.join(cacheDir, `${periodo.cat_id}.json`),
    semRede,
    forcar,
    intervalo: 400
  });
  const mapa = mapaValores(resposta, periodo.categ_dsg);
  validarControlos(periodo.categ_dsg, mapa, concelhos);
  leituras.push({ periodo: periodoCurto(periodo.categ_dsg), designacao: periodo.categ_dsg, mapa });
}

const ultima = leituras.at(-1);
const seriePeriodos = leituras.slice(-4);
const dados = concelhos.dados.map((concelho) => {
  const codigoGeografico = `${concelho.nuts3_codigo}${concelho.codigo_ine}`;
  const atualMunicipio = ultima.mapa.get(codigoGeografico) ?? null;
  const atualNuts3 = ultima.mapa.get(concelho.nuts3_codigo) ?? null;
  const fallbackNuts3 = atualMunicipio === null && atualNuts3 !== null;
  const codigoSerie = fallbackNuts3 ? concelho.nuts3_codigo : codigoGeografico;
  const valorAtual = fallbackNuts3 ? atualNuts3 : atualMunicipio;
  const valorHomologo = leituras[0].mapa.get(codigoSerie) ?? null;
  const variacao = valorAtual !== null && valorHomologo !== null && valorHomologo !== 0
    ? Number(((valorAtual - valorHomologo) / valorHomologo).toFixed(4))
    : null;
  return {
    slug: concelho.slug,
    nome: concelho.nome,
    codigo_ine: concelho.codigo_ine,
    nuts3: concelho.nuts3,
    valor_atual: valorAtual,
    periodo_atual: ultima.periodo,
    variacao_homologa: variacao,
    serie: seriePeriodos.map((leitura) => ({
      periodo: leitura.periodo,
      valor: leitura.mapa.get(codigoSerie) ?? null
    })),
    fallback_nuts3: fallbackNuts3
  };
});

const precos = {
  fonte: "INE",
  fonte_url: META_URL,
  periodo_referencia: ultima.periodo,
  extraido_em: hojeIso(),
  notas: `Mediana das vendas dos últimos 12 meses, atualizada no ${ultima.periodo}. Fonte: INE.`,
  indicador: INDICADOR,
  dados
};
precosSchema.parse(precos);
await escreverJson(path.join(dadosDir, "precos-concelhos.json"), precos);
const fallbacks = dados.filter((item) => item.fallback_nuts3).length;
const indisponiveis = dados.filter((item) => item.valor_atual === null).length;
console.log(`Preços escritos: 308 municípios, ${fallbacks} fallbacks NUTS III, ${indisponiveis} sem valor.`);
