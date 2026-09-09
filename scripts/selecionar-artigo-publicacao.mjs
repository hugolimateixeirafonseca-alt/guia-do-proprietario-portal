import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function selecionarArtigo({ fila, pendentes, publicados }) {
  const entradas = fila.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  for (const nome of entradas) {
    if (!/^[a-z0-9][a-z0-9-]*\.mdx$/.test(nome)) throw new Error("Entrada inválida na fila: " + nome);
    if (!pendentes.includes(nome) && !publicados.includes(nome)) throw new Error("Ficheiro da fila não encontrado: " + nome);
    if (pendentes.includes(nome) && publicados.includes(nome)) throw new Error("Artigo já publicado e duplicado na pasta de pendentes: " + nome);
  }
  const proximo = entradas.find((nome) => pendentes.includes(nome)) ?? "";
  if (!proximo && pendentes.length) throw new Error("FILA_DESATUALIZADA: existem artigos pendentes sem prioridade na fila. Atualize src/content/fila-publicacao-artigos.txt.");
  return proximo;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const content = path.join(root, "src/content");
  const [fila, pendentes, publicados] = await Promise.all([
    readFile(path.join(content, "fila-publicacao-artigos.txt"), "utf8"),
    readdir(path.join(content, "por-publicar")),
    readdir(path.join(content, "artigos")),
  ]);
  const nome = selecionarArtigo({ fila, pendentes: pendentes.filter((nome) => nome.endsWith(".mdx")), publicados });
  if (nome) console.log(nome);
}
