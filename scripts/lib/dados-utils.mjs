import fs from "node:fs/promises";
import path from "node:path";

export const PROJECT_ROOT = path.resolve(import.meta.dirname, "..", "..");
export const USER_AGENT = "GuiaDoProprietario-Dados/1.0 (contacto: geral@guiadoproprietario.pt)";

export function argumentos(argv = process.argv.slice(2)) {
  const resultado = {};
  for (let indice = 0; indice < argv.length; indice += 1) {
    const item = argv[indice];
    if (!item.startsWith("--")) continue;
    const [chave, valorInline] = item.slice(2).split("=", 2);
    if (valorInline !== undefined) resultado[chave] = valorInline;
    else if (argv[indice + 1] && !argv[indice + 1].startsWith("--")) resultado[chave] = argv[++indice];
    else resultado[chave] = true;
  }
  return resultado;
}

export const esperar = (milissegundos) => new Promise((resolve) => setTimeout(resolve, milissegundos));

export async function lerJson(caminho) {
  return JSON.parse(await fs.readFile(caminho, "utf8"));
}

export async function escreverJson(caminho, valor) {
  await fs.mkdir(path.dirname(caminho), { recursive: true });
  const temporario = `${caminho}.tmp`;
  await fs.writeFile(temporario, `${JSON.stringify(valor, null, 2)}\n`, "utf8");
  await fs.rename(temporario, caminho);
}

export function normalizar(valor) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function slugBase(valor) {
  return normalizar(valor)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function descodificarEntidades(valor) {
  const entidades = {
    amp: "&", apos: "'", quot: "\"", nbsp: " ", euro: "€",
    aacute: "á", Aacute: "Á", acirc: "â", Acirc: "Â", agrave: "à", Agrave: "À",
    atilde: "ã", Atilde: "Ã", ccedil: "ç", Ccedil: "Ç", eacute: "é", Eacute: "É",
    ecirc: "ê", Ecirc: "Ê", iacute: "í", Iacute: "Í", oacute: "ó", Oacute: "Ó",
    ocirc: "ô", Ocirc: "Ô", otilde: "õ", Otilde: "Õ", uacute: "ú", Uacute: "Ú",
    ordm: "º", ordf: "ª"
  };
  return valor
    .replace(/&#x([0-9a-f]+);/gi, (_, codigo) => String.fromCodePoint(Number.parseInt(codigo, 16)))
    .replace(/&#(\d+);/g, (_, codigo) => String.fromCodePoint(Number(codigo)))
    .replace(/&([a-z]+);/gi, (original, nome) => entidades[nome] ?? original);
}

export function textoHtml(valor) {
  return descodificarEntidades(
    valor
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

export function linhasTabela(html) {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((resultado) => {
    const bruto = resultado[1];
    const celulas = [...bruto.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((celula) => ({
      html: celula[1],
      texto: textoHtml(celula[1])
    }));
    return { html: bruto, celulas };
  }).filter((linha) => linha.celulas.length);
}

export function percentagemParaFracao(valor, contexto) {
  const limpo = valor.replace("%", "").replace(/\s/g, "").replace(",", ".");
  const numero = Number(limpo);
  if (!Number.isFinite(numero)) throw new Error(`Percentagem inválida em ${contexto}: "${valor}"`);
  return numero / 100;
}

export async function obterTextoComCache({ url, cache, semRede = false, forcar = false, intervalo = 1000, encoding = "utf-8" }) {
  if (!forcar) {
    try {
      return await fs.readFile(cache, "utf8");
    } catch (erro) {
      if (erro.code !== "ENOENT") throw erro;
    }
  }
  if (semRede) throw new Error(`Cache em falta e rede desativada: ${cache}`);
  const resposta = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json" } });
  if (!resposta.ok) throw new Error(`Pedido falhou com HTTP ${resposta.status}: ${url}`);
  const bytes = await resposta.arrayBuffer();
  const texto = new TextDecoder(encoding).decode(bytes);
  await fs.mkdir(path.dirname(cache), { recursive: true });
  await fs.writeFile(cache, texto, "utf8");
  if (intervalo) await esperar(intervalo);
  return texto;
}

export async function obterJsonComCache(opcoes) {
  const texto = await obterTextoComCache({ ...opcoes, encoding: "utf-8" });
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`Resposta JSON inválida em ${opcoes.url}`);
  }
}

export function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export function periodoCurto(designacao) {
  const resultado = designacao.match(/([1-4])\.º Trimestre de (\d{4})/);
  if (!resultado) throw new Error(`Período trimestral desconhecido: ${designacao}`);
  return `${resultado[1]}T${resultado[2]}`;
}
