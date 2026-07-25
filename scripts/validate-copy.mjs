import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const forbidden = /[—–]/u;
const extensions = new Set([".astro", ".md", ".mdx", ".ts", ".json", ".css"]);
const failures = [];
const warnings = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (extensions.has(path.extname(entry.name))) {
      const text = fs.readFileSync(target, "utf8");
      if (forbidden.test(text)) failures.push(path.relative(path.dirname(root), target));
    }
  }
}

visit(root);

const artigosDir = path.join(root, "content", "artigos");
const artigos = fs.readdirSync(artigosDir)
  .filter((file) => /\.(md|mdx)$/.test(file))
  .map((file) => {
    const source = fs.readFileSync(path.join(artigosDir, file), "utf8");
    const [, frontmatter = "", body = ""] = source.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/) || [];
    return {
      id: path.parse(file).name,
      file,
      nivel: frontmatter.match(/^nivel:\s*(\S+)/m)?.[1],
      pilar: frontmatter.match(/^pilar:\s*(\S+)/m)?.[1],
      par: frontmatter.match(/^par:\s*(\S+)/m)?.[1],
      body
    };
  });
const porId = new Map(artigos.map((artigo) => [artigo.id, artigo]));

for (const artigo of artigos) {
  if (!artigo.nivel) failures.push(`src/content/artigos/${artigo.file}: nivel em falta`);
  if (artigo.pilar === "casa" && artigo.nivel !== "essencial") {
    failures.push(`src/content/artigos/${artigo.file}: Casa e obras só aceita nivel essencial`);
  }
  if (artigo.par) {
    const par = porId.get(artigo.par);
    if (!par) failures.push(`src/content/artigos/${artigo.file}: par ${artigo.par} não existe`);
    else if (par.par !== artigo.id) failures.push(`src/content/artigos/${artigo.file}: ligação ao par não é recíproca`);
  }
  if (artigo.nivel === "essencial") {
    const texto = artigo.body
      .replace(/<[^>]+>/g, " ")
      .replace(/[#*_[\]()`]/g, " ")
      .replace(/https?:\/\/\S+/g, " ");
    const palavras = texto.match(/\p{L}[\p{L}\p{N}ªº%-]*/gu)?.length || 0;
    if (palavras > 800) warnings.push(`${artigo.file}: ${palavras} palavras, acima do máximo editorial de 800`);
    if (!artigo.body.includes("<Termo ")) warnings.push(`${artigo.file}: confirme se os termos técnicos precisam do componente Termo`);
  }
}

if (failures.length) {
  console.error(`Validação falhou: ${failures.join(", ")}`);
  process.exit(1);
}
for (const warning of warnings) console.warn(`Aviso editorial: ${warning}`);
console.log("Copy validado: sem travessões longos ou médios.");
