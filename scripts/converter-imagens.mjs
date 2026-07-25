import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const raiz = path.resolve(import.meta.dirname, "..");
const origem = path.join(raiz, "imagens");
const destino = path.join(raiz, "public", "imagens");
const extensoes = new Set([".png", ".jpg", ".jpeg"]);

async function listarImagens(diretorio) {
  const entradas = await fs.readdir(diretorio, { withFileTypes: true });
  const ficheiros = await Promise.all(entradas.map(async (entrada) => {
    const caminho = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) return listarImagens(caminho);
    return extensoes.has(path.extname(entrada.name).toLowerCase()) ? [caminho] : [];
  }));
  return ficheiros.flat();
}

async function precisaDeConversao(fonte, alvos) {
  const estadoFonte = await fs.stat(fonte);
  for (const alvo of alvos) {
    try {
      const estadoAlvo = await fs.stat(alvo);
      if (estadoAlvo.mtimeMs < estadoFonte.mtimeMs) return true;
    } catch {
      return true;
    }
  }
  return false;
}

const fontes = await listarImagens(origem);
let convertidas = 0;

for (const fonte of fontes) {
  const relativo = path.relative(origem, fonte);
  const pastaAlvo = path.join(destino, path.dirname(relativo));
  const nome = path.basename(relativo, path.extname(relativo));
  const avif = path.join(pastaAlvo, `${nome}.avif`);
  const webp = path.join(pastaAlvo, `${nome}.webp`);

  if (!(await precisaDeConversao(fonte, [avif, webp]))) continue;

  await fs.mkdir(pastaAlvo, { recursive: true });
  const imagem = sharp(fonte).rotate();
  await Promise.all([
    imagem.clone().avif({ quality: 58, effort: 5 }).toFile(avif),
    imagem.clone().webp({ quality: 78, effort: 5 }).toFile(webp)
  ]);
  convertidas += 1;
}

console.log(`Imagens encontradas: ${fontes.length}. Convertidas: ${convertidas}.`);
