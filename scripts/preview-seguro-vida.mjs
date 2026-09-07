// Exporta só as quatro páginas locais da campanha. Não executa um build nem publica.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { parse, serialize, parseFragment } from "parse5";
import { transform } from "@astrojs/compiler";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const localOrigin = process.argv[2] || "http://127.0.0.1:4327";
assert(["127.0.0.1", "localhost"].includes(new URL(localOrigin).hostname), "A exportação só aceita o servidor local.");
const output = path.resolve(process.argv[3] || path.join(root, "out", "preview-seguro-vida"));
const pages = [
  { route: "/seguro-vida-credito-habitacao/", file: "index.html", label: "Landing", id: "7efb1337347c0ae601f420f34ba38154", links: 3 },
  { route: "/casa/seguro-vida-credito-habitacao-poupar/", file: "artigo-poupanca.html", label: "Artigo: poupança", id: "4713195f3e647940b7614c616838155c", links: 2 },
  { route: "/casa/mudar-seguro-vida-credito-habitacao-banco/", file: "artigo-mudar-seguro.html", label: "Artigo: mudar o seguro", id: "4713195f3e647940b7614c616838155c", links: 2 },
  { route: "/casa/comparar-seguro-vida-credito-habitacao/", file: "artigo-comparar.html", label: "Artigo: comparar", id: "4713195f3e647940b7614c616838155c", links: 2 },
];
const attrs = (node) => Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
const set = (node, name, value) => { const attr = node.attrs.find((a) => a.name === name); if (attr) attr.value = value; else node.attrs.push({ name, value }); };
function* walk(node) { yield node; for (const child of node.childNodes || []) yield* walk(child); }
const text = (node) => [...walk(node)].filter((n) => n.nodeName === "#text").map((n) => n.value).join(" ");
function remove(node) { const children = node.parentNode?.childNodes; if (children) children.splice(children.indexOf(node), 1); }

const changed = ["src/components/SeguroVidaCta.astro", "src/pages/seguro-vida-credito-habitacao/index.astro", "src/layouts/BaseLayout.astro", "src/pages/[pilar]/[slug].astro"];
for (const file of changed) {
  const source = await readFile(path.join(root, file), "utf8");
  assert(!/[\u2013\u2014]/u.test(source), `${file}: travessão`);
  const compiled = await transform(source, { filename: file });
  assert(!(compiled.diagnostics || []).some((d) => d.severity === 1), `${file}: erro de compilação`);
}
for (const page of pages.slice(1)) {
  const slug = page.route.split("/").filter(Boolean).at(-1);
  const source = await readFile(path.join(root, "src/content/artigos", slug + ".mdx"), "utf8");
  assert(!/[\u2013\u2014]/u.test(source), `${slug}: travessão`);
  assert(/^rascunho: true$/m.test(source), `${slug}: precisa de continuar como rascunho`);
  assert(!/certezza/i.test(source), `${slug}: marca do cliente`);
  const body = source.split(/\n---\s*\n/)[1] || "";
  const words = body.replace(/<[^>]+>/g, " ").replace(/https?:\/\/\S+/g, " ").match(/\p{L}[\p{L}\p{N}ªº%-]*/gu)?.length || 0;
  assert(words <= 800, `${slug}: ${words} palavras`);
}
const linkSource = await readFile(path.join(root, "src/lib/seguro-vida-links.ts"), "utf8");
const linkJs = ts.transpileModule(linkSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { linkSeguroComCampanha } = await import("data:text/javascript;base64," + Buffer.from(linkJs).toString("base64"));
for (const page of pages) {
  const affiliate = "https://adsplatform.com/?adsid=" + page.id;
  assert.equal(linkSeguroComCampanha(affiliate, localOrigin + "/?adsid=outro&utm_source=meta&email=private%40example.com"), affiliate);
}
const internal = new URL(linkSeguroComCampanha("/casa/exemplo/", localOrigin + "/?utm_source=meta&utm_campaign=seguro_vida&email=private%40example.com&fbclid=123"));
assert.equal(internal.searchParams.get("utm_source"), "meta");
assert.equal(internal.searchParams.get("utm_campaign"), "seguro_vida");
assert.equal(internal.searchParams.has("email"), false);
assert.equal(internal.searchParams.has("fbclid"), false);
assert.equal(new URL(linkSeguroComCampanha("/casa/exemplo/", localOrigin + "/?utm_source=private%40example.com")).search, "");

await mkdir(output, { recursive: true });
const reports = [];
for (const page of pages) {
  const response = await fetch(localOrigin + page.route);
  assert.equal(response.status, 200, page.route);
  const html = await response.text();
  const dom = parse(html);
  const nodes = [...walk(dom)];
  assert.equal(nodes.filter((n) => n.tagName === "h1").length, 1, page.route + ": H1");
  assert(!/certezza/i.test(text(nodes.find((n) => n.tagName === "body"))), "Marca na copy");
  const affiliates = nodes.filter((n) => n.tagName === "a" && attrs(n).href?.startsWith("https://adsplatform.com/"));
  assert.equal(affiliates.length, page.links, page.route + ": quantidade de CTAs");
  for (const link of affiliates) {
    assert.equal(attrs(link).href, "https://adsplatform.com/?adsid=" + page.id, "Destino incorreto");
    assert(attrs(link).rel.includes("sponsored"), "Ligação comercial sem identificação");
  }
  assert(!nodes.some((n) => n.tagName === "form"), "A pré-visualização não deve recolher dados");
  assert(nodes.some((n) => n.tagName === "meta" && attrs(n).name === "robots" && attrs(n).content.includes("noindex")), "Falta noindex");
  for (const node of nodes) {
    if (node.tagName === "script" || attrs(node).id === "cookie-banner" || attrs(node)["data-cookie-settings"] !== undefined) { remove(node); continue; }
    if (!node.attrs) continue;
    node.attrs = node.attrs.filter((a) => a.name !== "data-vite-dev-id");
    for (const name of ["src", "srcset"]) {
      const value = attrs(node)[name];
      if (value?.startsWith("/imagens/")) {
        const absolute = path.resolve(root, "public", value.slice(1));
        assert(absolute.startsWith(path.join(root, "public") + path.sep));
        const bytes = await readFile(absolute);
        const mime = { ".avif": "image/avif", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png" }[path.extname(absolute)];
        assert(mime, value);
        set(node, name, `data:${mime};base64,${bytes.toString("base64")}`);
      }
    }
    if (node.tagName === "a" && attrs(node).href?.startsWith("/")) {
      const original = attrs(node).href;
      const local = pages.find((p) => p.route === original);
      set(node, "href", local ? "./" + local.file : "https://guiadoproprietario.pt" + original);
    }
    if (node.tagName === "link" && attrs(node).rel === "icon") {
      set(node, "href", "data:image/svg+xml;base64," + (await readFile(path.join(root, "public/favicon.svg"))).toString("base64"));
    }
    if (node.tagName === "table") {
      const tableNodes = [...walk(node)];
      const heads = tableNodes.filter((n) => n.tagName === "th").map(text);
      set(node, "class", (attrs(node).class || "") + " mobile-card-table");
      for (const row of tableNodes.filter((n) => n.tagName === "tr")) {
        row.childNodes.filter((n) => n.tagName === "td").forEach((cell, i) => set(cell, "data-label", heads[i] || ""));
      }
    }
  }
  const body = nodes.find((n) => n.tagName === "body");
  const nav = parseFragment(`<nav aria-label="Pré-visualização da campanha" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px 22px;background:#143b34;color:white;font:14px/1.5 system-ui"><strong>Pré-visualização</strong>${pages.map((p) => `<a href="./${p.file}" ${p === page ? 'aria-current="page"' : ""} style="color:white;padding:4px 8px;border:1px solid #769b89;border-radius:3px">${p.label}</a>`).join("")}</nav>`).childNodes;
  for (const node of nav) node.parentNode = body;
  body.childNodes.unshift(...nav);
  const exported = serialize(dom);
  assert(!/<script\b/i.test(exported), "Scripts no artefacto de revisão");
  await writeFile(path.join(output, page.file), exported, "utf8");
  reports.push({ route: page.route, file: page.file, affiliateLinks: affiliates.length, status: 200 });
}
await writeFile(path.join(output, "validacao.json"), JSON.stringify({ localOnly: true, checkedAt: new Date().toISOString(), checks: ["Quatro rotas compiladas", "Nove CTAs com o adsid correto", "Copy sem marca nem travessões", "Rascunhos excluídos da publicação", "UTM só em navegação interna", "Recursos incorporados no HTML", "Sem formulários ou scripts no artefacto"], pages: reports }, null, 2) + "\n");
console.log(JSON.stringify({ output, pages: reports.length, affiliateLinks: reports.reduce((sum, p) => sum + p.affiliateLinks, 0), result: "ok" }));
