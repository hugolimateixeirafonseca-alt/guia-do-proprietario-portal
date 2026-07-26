import fs from "node:fs/promises";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const pastaArtigos = path.join(raiz, "src", "content", "artigos");
const limiteAvif = 35 * 1024;
const ficheiros = (await fs.readdir(pastaArtigos)).filter((nome) => /\.mdx?$/.test(nome));
let proprias = 0;
let fallback = 0;
const erros = [];

for (const ficheiro of ficheiros) {
  const conteudo = await fs.readFile(path.join(pastaArtigos, ficheiro), "utf8");
  const frontmatter = conteudo.match(/^---\s*([\s\S]*?)\s*---/)?.[1] ?? "";
  const imagem = frontmatter.match(/^imagem_capa:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  const alt = frontmatter.match(/^imagem_alt:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");

  if (!imagem || imagem === "auto") {
    fallback += 1;
    continue;
  }

  proprias += 1;
  if (!alt) erros.push(`${ficheiro}: falta imagem_alt`);
  const avif = path.join(raiz, "public", imagem.replace(/^\//, ""));
  const webp = avif.replace(/\.avif$/i, ".webp");

  for (const alvo of [avif, webp]) {
    try {
      await fs.access(alvo);
    } catch {
      erros.push(`${ficheiro}: falta ${path.relative(raiz, alvo)}`);
    }
  }

  try {
    const tamanho = (await fs.stat(avif)).size;
    if (tamanho >= limiteAvif) erros.push(`${ficheiro}: AVIF com ${(tamanho / 1024).toFixed(1)} KB, o limite é inferior a 35 KB`);
  } catch {}
}

if (erros.length) {
  console.error(`Validação de imagens falhou:
${erros.join("\n")}`);
  process.exit(1);
}

console.log(`Imagens de artigos validadas: ${proprias} próprias e ${fallback} com fallback do pilar.`);
