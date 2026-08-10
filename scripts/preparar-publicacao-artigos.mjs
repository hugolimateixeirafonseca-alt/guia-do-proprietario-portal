import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { lerDatasFrontmatter, preencherDatasFrontmatter } from "./lib/datas-artigos.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const pendingDirectory = path.join(root, "src", "content", "por-publicar");
const gitBinary = process.env.GIT_BINARY || "git";
const files = process.argv.slice(2);

if (files.length === 0) {
  throw new Error("Indique pelo menos um artigo em src/content/por-publicar.");
}

async function firstCommitAt(relativePath) {
  const { stdout } = await execFileAsync(
    gitBinary,
    ["-c", "safe.directory=" + root, "-C", root, "log", "--reverse", "--format=%cI", "--", relativePath],
    { encoding: "utf8", windowsHide: true },
  );
  return stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

for (const input of files) {
  const filePath = path.resolve(root, input);
  const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
  const relativeToPending = path.relative(pendingDirectory, filePath);

  if (relativeToPending.startsWith("..") || path.isAbsolute(relativeToPending) || !/\.mdx?$/i.test(filePath)) {
    throw new Error("Artigo fora de src/content/por-publicar: " + input);
  }

  const source = await readFile(filePath, "utf8");
  const currentDates = lerDatasFrontmatter(source);
  const chegada = currentDates.chegada ?? await firstCommitAt(relativePath);
  if (!chegada) {
    throw new Error("Não foi possível confirmar a chegada de " + path.basename(filePath) + " no histórico Git.");
  }

  const nextSource = preencherDatasFrontmatter(source, {
    chegada,
    publicadoEm: currentDates.publicadoEm ?? new Date(),
  });
  await writeFile(filePath, nextSource, "utf8");

  const finalDates = lerDatasFrontmatter(nextSource);
  if (!finalDates.chegada || !finalDates.publicadoEm) {
    throw new Error("As datas obrigatórias não foram preenchidas em " + path.basename(filePath) + ".");
  }
  console.log("Datas de publicação preparadas: " + path.basename(filePath));
}
