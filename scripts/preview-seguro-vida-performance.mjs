// Validação e exportação isoladas da variante adicional. Não publica nem abre o afiliado.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { parse, parseFragment, serialize } from "parse5";
import { transform } from "@astrojs/compiler";
import postcss from "postcss";

const root = path.resolve(import.meta.dirname, "..");
const origin = process.argv[2] || "http://127.0.0.1:4327";
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const output = path.resolve(process.argv[3] || path.join(root, "out/preview-seguro-vida"));
const route = "/seguro-vida-simulacao/";
const source = await readFile(path.join(root, "src/pages", route, "index.astro"), "utf8");
const result = await transform(source, { filename: "seguro-vida-simulacao/index.astro" });
assert(!(result.diagnostics || []).some((d) => d.severity === 1), "Compilação da página");
assert(!/[\u2013\u2014]/u.test(source), "Copy sem travessões");
const css = await readFile(path.join(root, "src/styles/seguro-vida-performance.css"), "utf8");
postcss.parse(css);
assert(css.includes("@media(max-width:760px)"), "Regras mobile");
const response = await fetch(origin + route);
assert.equal(response.status, 200);
const dom = parse(await response.text());
function* walk(n) { yield n; for (const c of n.childNodes || []) yield* walk(c); }
const attrs = (n) => Object.fromEntries((n.attrs || []).map((a) => [a.name, a.value]));
const set = (n, name, value) => { const a = n.attrs.find((a) => a.name === name); if (a) a.value = value; else n.attrs.push({ name, value }); };
const remove = (n) => { if (n.parentNode) n.parentNode.childNodes = n.parentNode.childNodes.filter((c) => c !== n); };
const nodes = [...walk(dom)];
const copy = nodes.filter((n) => n.nodeName === "#text" && !["script", "style"].includes(n.parentNode?.tagName)).map((n) => n.value).join(" ");
assert(!/certezza|60%|20.000/u.test(copy), "Marca ou alegações não reproduzidas");
assert.equal(nodes.filter((n) => n.tagName === "h1").length, 1);
assert.equal(nodes.filter((n) => n.tagName === "form").length, 0);
assert.equal(nodes.filter((n) => n.tagName === "details").length, 4);
assert(nodes.some((n) => n.tagName === "meta" && attrs(n).name === "robots" && attrs(n).content === "noindex,follow"));
const affiliates = nodes.filter((n) => n.tagName === "a" && attrs(n).href?.startsWith("https://adsplatform.com/"));
assert.equal(affiliates.length, 4);
for (const a of affiliates) {
  assert.equal(attrs(a).href, "https://adsplatform.com/?adsid=7efb1337347c0ae601f420f34ba38154");
  assert(attrs(a).rel.includes("sponsored"));
  assert.equal(attrs(a).target, undefined, "Continuação na mesma janela");
}
let imageBytes = 0;
for (const n of nodes) {
  if (n.tagName === "script" || n.tagName === "astro-dev-toolbar" || attrs(n).id === "cookie-banner" || attrs(n)["data-cookie-settings"] !== undefined || (n.tagName === "link" && attrs(n).rel === "stylesheet")) { remove(n); continue; }
  if (n.tagName === "img") {
    assert(attrs(n).src?.startsWith("/imagens/landings/seguro-vida/"));
    const bytes = await readFile(path.join(root, "public", attrs(n).src));
    imageBytes += bytes.length;
    assert(bytes.length < 200000, "Imagem leve para tráfego mobile");
    set(n, "src", "data:image/webp;base64," + bytes.toString("base64"));
  }
  if (n.tagName === "a" && attrs(n).href?.startsWith("/")) set(n, "href", "https://guiadoproprietario.pt" + attrs(n).href);
}
const head = nodes.find((n) => n.tagName === "head");
const style = parseFragment("<style>" + css + "</style>").childNodes[0];
style.parentNode = head; head.childNodes.push(style);
const exported = serialize(dom);
assert(!/<script\b|<form\b|src="\/|href="\/|astro-dev-toolbar/u.test(exported));
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "landing-performance.html"), exported);
const report = { localOnly: true, checkedAt: new Date().toISOString(), route, file: "landing-performance.html", affiliateLinks: 4, imageBytes, htmlBytes: Buffer.byteLength(exported), checks: ["Compilação isolada e CSS válidos", "Quatro links de afiliado exatos", "Uma H1 e quatro FAQ nativas", "Sem formulário, scripts ou marca do cliente", "Imagem incorporada e regras mobile", "Noindex e sem publicação"], visualBrowserReview: false, measuredConversion: false };
await writeFile(path.join(output, "validacao-performance.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
