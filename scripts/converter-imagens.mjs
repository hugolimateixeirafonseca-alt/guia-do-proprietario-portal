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
  const imagemDeArtigo = relativo.split(path.sep)[0] === "artigos";
  const socialJpeg = imagemDeArtigo ? path.join(pastaAlvo, `${nome}.social.jpg`) : null;
  const alvos = socialJpeg ? [avif, webp, socialJpeg] : [avif, webp];

  if (!(await precisaDeConversao(fonte, alvos))) continue;

  await fs.mkdir(pastaAlvo, { recursive: true });

  const imagem = sharp(fonte)
    .rotate()
    .resize(1200, 675, { fit: "cover", position: "centre" });

  const qualidadeWebp = imagemDeArtigo ? 92 : 78;
  const trabalhos = [
    criarAvifAbaixoDoLimite(imagem, fonte),
    imagem.clone().webp({ quality: qualidadeWebp, effort: 5 }).toBuffer(),
  ];
  if (socialJpeg) trabalhos.push(imagem.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer());

  const [avifBuffer, webpBuffer, socialJpegBuffer] = await Promise.all(trabalhos);
  const escritas = [fs.writeFile(avif, avifBuffer), fs.writeFile(webp, webpBuffer)];
  if (socialJpeg && socialJpegBuffer) escritas.push(fs.writeFile(socialJpeg, socialJpegBuffer));
  await Promise.all(escritas);

  convertidas += 1;
}

// Algumas capas antigas já só existem em public/imagens/artigos como WebP.
// Gera a variante JPEG social-safe também para esse legado, para o social-feed
// nunca devolver um URL .social.jpg inexistente.
const artigosPublicos = path.join(destino, "artigos");
let sociaisBackfill = 0;
try {
  const entradas = await fs.readdir(artigosPublicos, { withFileTypes: true });
  for (const entrada of entradas) {
    if (!entrada.isFile() || !entrada.name.toLowerCase().endsWith(".webp")) continue;
    const webp = path.join(artigosPublicos, entrada.name);
    const socialJpeg = path.join(artigosPublicos, entrada.name.replace(/\.webp$/i, ".social.jpg"));
    if (!(await precisaDeConversao(webp, [socialJpeg]))) continue;
    await sharp(webp).rotate().jpeg({ quality: 90, mozjpeg: true }).toFile(socialJpeg);
    sociaisBackfill += 1;
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log(`Imagens encontradas: ${fontes.length}. Convertidas: ${convertidas}. JPEG sociais legado: ${sociaisBackfill}.`);
