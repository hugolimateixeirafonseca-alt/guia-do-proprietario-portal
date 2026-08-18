import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const raiz = path.resolve(import.meta.dirname, "..");
const origem = path.join(raiz, "imagens");
const destino = path.join(raiz, "public", "imagens");
const extensoes = new Set([".png", ".jpg", ".jpeg"]);
const limiteAvif = 35 * 1024;

async function listarImagens(diretorio) {
  const entradas = await fs.readdir(diretorio, { withFileTypes: true });
  const ficheiros = await Promise.all(
    entradas.map(async (entrada) => {
      const caminho = path.join(diretorio, entrada.name);
      if (entrada.isDirectory()) return listarImagens(caminho);
      return extensoes.has(path.extname(entrada.name).toLowerCase()) ? [caminho] : [];
    }),
  );
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

async function criarAvifAbaixoDoLimite(imagem, fonte) {
  const qualidades = [58, 54, 50, 46, 42, 38, 34, 30];
  let ultimo = null;

  for (const quality of qualidades) {
    ultimo = await imagem.clone().avif({ quality, effort: 5 }).toBuffer();
    if (ultimo.length < limiteAvif) return ultimo;
  }

  throw new Error(
    `${path.relative(raiz, fonte)}: não foi possível obter AVIF abaixo de 35 KB ` +
      `(último resultado ${(ultimo.length / 1024).toFixed(1)} KB).`,
  );
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

  const imagem = sharp(fonte)
    .rotate()
    .resize(1200, 675, { fit: "cover", position: "centre" });

  const imagemDeArtigo = relativo.split(path.sep)[0] === "artigos";
  const qualidadeWebp = imagemDeArtigo ? 92 : 78;

  const [avifBuffer, webpBuffer] = await Promise.all([
    criarAvifAbaixoDoLimite(imagem, fonte),
    imagem.clone().webp({ quality: qualidadeWebp, effort: 5 }).toBuffer(),
  ]);

  await Promise.all([
    fs.writeFile(avif, avifBuffer),
    fs.writeFile(webp, webpBuffer),
  ]);

  convertidas += 1;
}

console.log(`Imagens encontradas: ${fontes.length}. Convertidas: ${convertidas}.`);
