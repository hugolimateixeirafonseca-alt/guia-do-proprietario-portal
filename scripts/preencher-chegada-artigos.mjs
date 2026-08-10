import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { lerDatasFrontmatter, preencherDatasFrontmatter } from "./lib/datas-artigos.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const articlesDirectory = path.join(root, "src", "content", "artigos");
const shouldWrite = process.argv.includes("--write");
const gitBinary = process.env.GIT_BINARY || "git";

async function firstCommitAt(relativePath) {
  const { stdout } = await execFileAsync(
    gitBinary,
    ["-c", "safe.directory=" + root, "-C", root, "log", "--reverse", "--format=%cI", "--", relativePath],
    { encoding: "utf8", windowsHide: true },
  );
  return stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

async function realDates(file) {
  const publishedPath = "src/content/artigos/" + file;
  const pendingPath = "src/content/por-publicar/" + file;
  const [publishedAt, pendingAt] = await Promise.all([
    firstCommitAt(publishedPath),
    firstCommitAt(pendingPath),
  ]);
  const timestamps = [publishedAt, pendingAt]
    .filter(Boolean)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return { arrivalAt: timestamps[0] ?? null, publishedAt };
}

const files = (await readdir(articlesDirectory)).filter((file) => /\.mdx?$/i.test(file));
const changes = [];

for (const file of files) {
  const filePath = path.join(articlesDirectory, file);
  const source = await readFile(filePath, "utf8");
  const { chegada, publicadoEm } = lerDatasFrontmatter(source);
  const hasArrival = Boolean(chegada);
  const hasPublishedAt = Boolean(publicadoEm);
  if (hasArrival && hasPublishedAt) continue;

  const { arrivalAt, publishedAt } = await realDates(file);
  if (!arrivalAt) throw new Error("Não foi possível confirmar a chegada de " + file + " no histórico Git.");
  if (!publishedAt) throw new Error("Não foi possível confirmar a publicação de " + file + " no histórico Git.");

  changes.push({ file, arrivalAt, publishedAt });
  if (shouldWrite) {
    const nextSource = preencherDatasFrontmatter(source, {
      chegada: arrivalAt,
      publicadoEm: publishedAt,
    });
    await writeFile(filePath, nextSource, "utf8");
  }
}

if (changes.length === 0) {
  console.log("Todos os artigos publicados já têm datas verificáveis.");
} else if (shouldWrite) {
  console.log("Datas preenchidas em " + changes.length + " artigos a partir do histórico Git.");
} else {
  console.log(changes.length + " artigos precisam de datas. Execute com --write para os atualizar.");
  process.exitCode = 1;
}
