import path from "node:path";
import {
  PROJECT_ROOT,
  argumentos,
  escreverJson,
  hojeIso,
  linhasTabela,
  lerJson,
  normalizar,
  obterTextoComCache,
  percentagemParaFracao,
  textoHtml
} from "./lib/dados-utils.mjs";
import { imiSchema } from "./dados-schemas.mjs";

const FORM_URL = "https://www.portaldasfinancas.gov.pt/pt/main.jsp?body=/imi/consultarTaxasIMIForm.jsp";
const BASE_URL = "https://www.portaldasfinancas.gov.pt/pt/";
const opcoes = argumentos();
const ano = Number(opcoes.ano ?? new Date().getFullYear() - 1);
if (!Number.isInteger(ano) || ano < 2003) throw new Error(`Ano inválido: ${opcoes.ano}`);
const anoAnterior = ano - 1;
const semRede = Boolean(opcoes["sem-rede"]);
const forcar = Boolean(opcoes.forcar);
const dadosDir = path.join(PROJECT_ROOT, "src", "dados");

const distritos = [
  ["19ANGRA DO HEROISMO", "Angra do Heroísmo", "19-angra-do-heroismo"],
  ["01AVEIRO", "Aveiro", "01-aveiro"], ["02BEJA", "Beja", "02-beja"],
  ["03BRAGA", "Braga", "03-braga"], ["04BRAGANCA", "Bragança", "04-braganca"],
  ["05C BRANCO", "Castelo Branco", "05-castelo-branco"], ["06COIMBRA", "Coimbra", "06-coimbra"],
  ["07EVORA", "Évora", "07-evora"], ["08FARO", "Faro", "08-faro"],
  ["22FUNCHAL", "Funchal", "22-funchal"], ["09GUARDA", "Guarda", "09-guarda"],
  ["20HORTA", "Horta", "20-horta"], ["10LEIRIA", "Leiria", "10-leiria"],
  ["11LISBOA", "Lisboa", "11-lisboa"], ["21PONTA DELGADA", "Ponta Delgada", "21-ponta-delgada"],
  ["12PORTALEGRE", "Portalegre", "12-portalegre"], ["13PORTO", "Porto", "13-porto"],
  ["14SANTAREM", "Santarém", "14-santarem"], ["15SETUBAL", "Setúbal", "15-setubal"],
  ["16VIANA DO CASTELO", "Viana do Castelo", "16-viana-do-castelo"],
  ["17VILA REAL", "Vila Real", "17-vila-real"], ["18VISEU", "Viseu", "18-viseu"]
];

function urlDistrito(anoConsulta, codigoDistrito) {
  const parametros = new URLSearchParams({
    body: "/imi/consultarTaxasIMI.jsp",
    ano: String(anoConsulta),
    distrito: codigoDistrito
  });
  return `https://www.portaldasfinancas.gov.pt/pt/main.jsp?${parametros}`;
}

function ligacao(celula) {
  const resultado = celula.html.match(/href=["']([^"']+)["']/i);
  return resultado?.[1] ?? null;
}

function taxaOuNull(valor, contexto) {
  if (!valor || valor.trim() === "-") return null;
  return percentagemParaFracao(valor, contexto);
}

function nomesCompativeis(nomeIne, nomeAt) {
  const ine = normalizar(nomeIne);
  const at = normalizar(nomeAt).replace(/\s*\([^)]*\)\s*$/, "");
  return ine === at;
}

function parseDistrito(html, distrito, anoConsulta) {
  if (html.includes("Não existem taxas IMI definidas")) return [];
  const linhas = linhasTabela(html);
  const indiceCabecalho = linhas.findIndex((linha) => normalizar(linha.celulas.map((item) => item.texto).join(" ")).includes("codigo municipio"));
  if (indiceCabecalho < 0) throw new Error(`${distrito} ${anoConsulta}: cabeçalho da tabela não encontrado.`);
  const cabecalho = linhas[indiceCabecalho].celulas.map((item) => normalizar(item.texto));
  const indices = {
    codigo: cabecalho.findIndex((item) => item.includes("codigo municipio")),
    nome: cabecalho.findIndex((item) => item === "municipio"),
    urbana: cabecalho.findIndex((item) => item.includes("predios urbanos")),
    rustica: cabecalho.findIndex((item) => item.includes("predios rusticos")),
    freguesias: cabecalho.findIndex((item) => item.includes("taxas por freguesia")),
    deducao: cabecalho.findIndex((item) => item.includes("deducao fixa"))
  };
  if (Object.values(indices).some((indice) => indice < 0)) throw new Error(`${distrito} ${anoConsulta}: colunas inesperadas: ${cabecalho.join(" | ")}`);
  const resultado = [];
  for (const linha of linhas.slice(indiceCabecalho + 1)) {
    if (!/^\d{4}$/.test(linha.celulas[indices.codigo]?.texto ?? "")) continue;
    if (linha.celulas.length !== cabecalho.length) {
      throw new Error(`${distrito} ${anoConsulta}: linha com ${linha.celulas.length} células, esperavam-se ${cabecalho.length}.`);
    }
    const codigo = linha.celulas[indices.codigo].texto;
    resultado.push({
      codigo,
      nome: linha.celulas[indices.nome].texto,
      taxa_urbana: taxaOuNull(linha.celulas[indices.urbana].texto, `${distrito} ${codigo}`),
      taxa_rustica: taxaOuNull(linha.celulas[indices.rustica].texto, `${distrito} ${codigo}`),
      link_freguesias: ligacao(linha.celulas[indices.freguesias]),
      link_deducao: ligacao(linha.celulas[indices.deducao])
    });
  }
  if (!resultado.length) throw new Error(`${distrito} ${anoConsulta}: tabela encontrada sem municípios.`);
  return resultado;
}

function parseDeducao(html, codigo) {
  const estado = html.match(/existeDeducao\s*=\s*(true|false)/i)?.[1]?.toLowerCase();
  if (estado === "false") return {};
  if (estado !== "true") throw new Error(`Estado da dedução não encontrado no município ${codigo}.`);
  const deducoes = {};
  for (const linha of linhasTabela(html)) {
    if (linha.celulas.length !== 3) continue;
    const dependentes = normalizar(linha.celulas[0].texto);
    if (!["1", "2", "3 ou mais"].includes(dependentes)) continue;
    if (normalizar(linha.celulas[2].texto) !== "sim") continue;
    const valor = Number(linha.celulas[1].texto.replace(",", "."));
    if (!Number.isFinite(valor)) throw new Error(`Dedução inválida no município ${codigo}.`);
    deducoes[dependentes.startsWith("3") ? "3" : dependentes] = valor;
  }
  if (Object.keys(deducoes).length === 0) throw new Error(`Estrutura de deduções inesperada no município ${codigo}.`);
  return deducoes;
}

function parseAjustesFreguesia(html, codigo, taxaMunicipal) {
  const ajustes = [];
  for (const linha of linhasTabela(html)) {
    if (linha.celulas.length !== 3) continue;
    const [freguesia, urbana] = linha.celulas.map((item) => item.texto);
    if (!/%/.test(urbana) || normalizar(freguesia) === "freguesia") continue;
    const taxaFreguesia = percentagemParaFracao(urbana, `taxa por freguesia ${codigo}`);
    const diferenca = taxaMunicipal === null ? null : Number((taxaFreguesia - taxaMunicipal).toFixed(6));
    if (diferenca === 0) continue;
    ajustes.push({
      freguesia,
      tipo: diferenca === null ? "taxa_especifica" : diferenca > 0 ? "majoracao" : "minoracao",
      valor: diferenca === null ? taxaFreguesia : Math.abs(diferenca)
    });
  }
  if (!ajustes.length) {
    const pagina = normalizar(textoHtml(html));
    if (!pagina.includes("nao exist") && !pagina.includes("sem taxas")) {
      throw new Error(`Estrutura das taxas por freguesia inesperada no município ${codigo}.`);
    }
  }
  return ajustes;
}

async function obterPaginaAuxiliar(link, cache) {
  const url = new URL(link, BASE_URL).toString();
  return obterTextoComCache({ url, cache, semRede, forcar, intervalo: 1000, encoding: "windows-1252" });
}

async function obterAno(anoConsulta) {
  const mapa = new Map();
  for (const [codigoDistrito, nomeDistrito, ficheiro] of distritos) {
    const cache = path.join(PROJECT_ROOT, "scripts", "cache", "imi", String(anoConsulta), `${ficheiro}.html`);
    console.log(`A obter ${nomeDistrito}, ${anoConsulta}...`);
    const html = await obterTextoComCache({
      url: urlDistrito(anoConsulta, codigoDistrito),
      cache,
      semRede,
      forcar,
      intervalo: 1000,
      encoding: "windows-1252"
    });
    const municipios = parseDistrito(html, nomeDistrito, anoConsulta);
    for (const municipio of municipios) {
      if (mapa.has(municipio.codigo)) throw new Error(`Código municipal duplicado na AT: ${municipio.codigo}`);
      mapa.set(municipio.codigo, { ...municipio, distrito_at: nomeDistrito });
    }
  }
  return mapa;
}

const concelhos = await lerJson(path.join(dadosDir, "concelhos.json"));
if (!Array.isArray(concelhos.dados) || concelhos.dados.length !== 308) {
  throw new Error("A lista mestra de concelhos ainda não tem 308 municípios. Execute primeiro obter-precos-ine.mjs.");
}

console.log(`Extração das taxas de IMI de ${ano}, com comparação a ${anoAnterior}.`);
const atuais = await obterAno(ano);
const anteriores = await obterAno(anoAnterior);
if (atuais.size && atuais.size > 308) throw new Error(`A AT devolveu ${atuais.size} municípios em ${ano}.`);

for (const municipio of atuais.values()) {
  if (municipio.link_deducao) {
    const cache = path.join(PROJECT_ROOT, "scripts", "cache", "imi", String(ano), "deducoes", `${municipio.codigo}.html`);
    const html = await obterPaginaAuxiliar(municipio.link_deducao, cache);
    municipio.deducao_agregado = parseDeducao(html, municipio.codigo);
  } else municipio.deducao_agregado = {};
  if (municipio.link_freguesias) {
    const cache = path.join(PROJECT_ROOT, "scripts", "cache", "imi", String(ano), "freguesias", `${municipio.codigo}.html`);
    const html = await obterPaginaAuxiliar(municipio.link_freguesias, cache);
    municipio.ajustes_freguesia = parseAjustesFreguesia(html, municipio.codigo, municipio.taxa_urbana);
  } else municipio.ajustes_freguesia = [];
}

const dados = concelhos.dados.map((concelho) => {
  const atual = atuais.get(concelho.codigo_ine);
  const anterior = anteriores.get(concelho.codigo_ine);
  if (atual && !nomesCompativeis(concelho.nome, atual.nome)) {
    console.warn(`Aviso de nomenclatura no código ${concelho.codigo_ine}: INE "${concelho.nome}", AT "${atual.nome}". A junção mantém o código oficial comum.`);
  }
  return {
    slug: concelho.slug,
    nome: concelho.nome,
    distrito: concelho.distrito,
    codigo_ine: concelho.codigo_ine,
    taxa_urbana: atual?.taxa_urbana ?? null,
    taxa_urbana_ano_anterior: anterior?.taxa_urbana ?? null,
    taxa_rustica: atual?.taxa_rustica ?? null,
    deducao_agregado: atual?.deducao_agregado ?? {},
    ajustes_freguesia: atual?.ajustes_freguesia ?? [],
    estado: atual ? "publicada" : "nao_publicada"
  };
});

const imi = {
  fonte: "Autoridade Tributária",
  fonte_url: FORM_URL,
  periodo_referencia: String(ano),
  extraido_em: hojeIso(),
  notas: `Taxas municipais de IMI de ${ano}. As taxas urbanas são guardadas como fração decimal.`,
  dados
};
imiSchema.parse(imi);
await escreverJson(path.join(dadosDir, "imi-concelhos.json"), imi);
console.log(`IMI escrito: ${dados.filter((item) => item.estado === "publicada").length} publicadas, ${dados.filter((item) => item.estado === "nao_publicada").length} não publicadas.`);
