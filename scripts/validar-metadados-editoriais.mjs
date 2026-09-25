import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { valorFrontmatter } from "./lib/frontmatter.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const directories = ["src/content/artigos", "src/content/por-publicar", "src/content/notas"];
const errors = [];

for (const directory of directories) {
  const absoluteDirectory = path.join(root, directory);
  const files = await fs.readdir(absoluteDirectory);
  for (const file of files.filter((candidate) => /\.mdx?$/i.test(candidate))) {
    const source = await fs.readFile(path.join(absoluteDirectory, file), "utf8");
    if (/^rascunho:\s*true\s*$/mi.test(source)) continue;
    if (!valorFrontmatter(source, "titulo")) errors.push(`${directory}/${file}: título em falta ou inválido.`);
  }
}

if (errors.length > 0) throw new Error(`Metadados editoriais inválidos:\n${errors.join("\n")}`);
console.log("Metadados editoriais validados.");
