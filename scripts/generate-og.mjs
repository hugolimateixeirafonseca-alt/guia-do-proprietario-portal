import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const artigosDir = path.join(root, "src", "content", "artigos");
const notasDir = path.join(root, "src", "content", "notas");
const outputDir = path.join(root, "public", "og");

const escapeXml = (value) => value.replace(/[<>&'"]/g, (char) => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  "\"": "&quot;"
})[char]);

function wrapTitle(title, max = 29) {
  const words = title.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

async function titlesFromContent(directory, routeForFile) {
  const files = await fs.readdir(directory);
  return Promise.all(files.filter((file) => /\.(md|mdx)$/.test(file)).map(async (file) => {
    const source = await fs.readFile(path.join(directory, file), "utf8");
    if (/^rascunho:\s*true\s*$/mi.test(source)) return null;
    const title = source.match(/^titulo:\s*["'](.+?)["']\s*$/m)?.[1];
    if (!title) throw new Error(`Título em falta em ${file}`);
    const route = routeForFile(file, source);
    const pilar = source.match(/^pilar:\s*(\S+)\s*$/m)?.[1];
    return { title, route, image: pilar ? `pilar-${pilar}` : undefined };
  })).then((items) => items.filter(Boolean));
}

function articleRoute(file, source) {
  const pilar = source.match(/^pilar:\s*(\S+)\s*$/m)?.[1];
  return `/${pilar}/${path.parse(file).name}/`;
}

const concelhos = JSON.parse(await fs.readFile(path.join(root, "src", "dados", "concelhos.json"), "utf8"));
const contentPages = [
  ...(await titlesFromContent(artigosDir, articleRoute)),
  ...(await titlesFromContent(notasDir, (file) => `/novidades/${path.parse(file).name}/`))
];
const pages = [
  { route: "/vender/", title: "Vender casa", image: "pilar-vender" },
  { route: "/impostos/", title: "Impostos", image: "pilar-impostos" },
  { route: "/arrendar/", title: "Arrendamento", image: "pilar-arrendar" },
  { route: "/condominio/", title: "Condomínio", image: "pilar-condominio" },
  { route: "/casa/", title: "Casa e obras", image: "pilar-casa" },
  { route: "/calendario/", title: "Calendário do proprietário", image: "pilar-impostos" },
  { route: "/novidades/", title: "Novidades" },
  { route: "/simuladores/", title: "Simuladores gratuitos" },
  { route: "/simuladores/imi/", title: "Simulador de IMI", image: "pilar-impostos" },
  { route: "/simuladores/valor-liquido-venda/", title: "Simulador de valor líquido da venda", image: "pilar-vender" },
  ...concelhos.dados.flatMap((concelho) => [
    { route: `/imi/${concelho.slug}/`, title: `IMI em ${concelho.nome}`, image: "pilar-impostos" },
    { route: `/precos-casas/${concelho.slug}/`, title: `Preços das casas em ${concelho.nome}`, image: "pilar-vender" }
  ]),
  ...contentPages
];

await fs.rm(outputDir, { recursive: true, force: true });
async function renderCard(page, target) {
  const lines = wrapTitle(page.title, page.image ? 22 : 29);
  const text = lines.map((line, index) => `<text x="88" y="${250 + index * 78}" font-size="64" font-weight="750" fill="#102a31">${escapeXml(line)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <pattern id="azulejo" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M0 32 32 0l32 32-32 32Z" fill="none" stroke="#256b5c" stroke-width="1" opacity=".12"/>
        <circle cx="32" cy="32" r="14" fill="none" stroke="#256b5c" stroke-width="1" opacity=".12"/>
        <path d="M16 16 48 48M48 16 16 48" fill="none" stroke="#256b5c" stroke-width="1" opacity=".12"/>
      </pattern>
    </defs>
    <rect width="1200" height="630" fill="#f5f2e9"/>
    <rect width="1200" height="630" fill="url(#azulejo)"/>
    <rect x="0" y="0" width="26" height="630" fill="#256b5c"/>
    <text x="88" y="110" font-size="25" font-weight="700" letter-spacing="4" fill="#256b5c">GUIA DO PROPRIETÁRIO</text>
    ${text}
    <text x="88" y="570" font-size="24" fill="#5f7075">guiadoproprietario.pt</text>
  </svg>`;
  let card = sharp(Buffer.from(svg));
  if (page.image) {
    const imagePath = path.join(root, "public", "imagens", `${page.image}.avif`);
    const illustration = await sharp(imagePath).resize(390, 630, { fit: "cover" }).png().toBuffer();
    card = card.composite([
      { input: illustration, left: 810, top: 0 },
      { input: Buffer.from(`<svg width="390" height="630"><rect width="390" height="630" fill="none" stroke="#256b5c" stroke-width="14"/></svg>`), left: 810, top: 0 }
    ]);
  } else {
    const motif = Buffer.from(`<svg width="250" height="250"><circle cx="125" cy="125" r="92" fill="#e2c58f"/><path d="M80 141 125 102l45 39v55H80z" fill="none" stroke="#256b5c" stroke-width="12" stroke-linejoin="round"/></svg>`);
    card = card.composite([{ input: motif, left: 920, top: 35 }]);
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await card.png({ compressionLevel: 9 }).toFile(target);
}

for (const page of pages) {
  const target = path.join(outputDir, page.route.replace(/^\/|\/$/g, ""), "index.png");
  await renderCard(page, target);
}

await renderCard(
  { title: "A sua casa, sem complicações.", image: "hero-home" },
  path.join(root, "public", "og-1200x630.png")
);
await fs.copyFile(path.join(root, "public", "og-1200x630.png"), path.join(root, "public", "og.png"));

console.log(`Cartões OG gerados: ${pages.length}.`);
