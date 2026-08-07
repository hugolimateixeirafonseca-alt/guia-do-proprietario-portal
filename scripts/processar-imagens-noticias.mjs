import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const rawDir = path.join(root, "public", "social", "noticias", "raw");
const outputDir = path.join(root, "public", "social", "noticias");
const notasDir = path.join(root, "src", "content", "notas");

const escapeXml = (value = "") => String(value).replace(/[<>&'\"]/g, (char) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;"
})[char]);

function wrapTitle(title, max = 24) {
  const words = String(title || "Novidade").trim().split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > max && line) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

async function metadataForSlug(slug) {
  for (const file of [`${slug}.mdx`, `${slug}.md`]) {
    try {
      const source = await fs.readFile(path.join(notasDir, file), "utf8");
      return {
        titulo: source.match(/^titulo:\s*["'](.+?)["']\s*$/m)?.[1] || "Novidade",
        fonte: source.match(/^fonte_nome:\s*["'](.+?)["']\s*$/m)?.[1] || "Fonte original"
      };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return { titulo: "Novidade", fonte: "Fonte original" };
}

async function listarPngs() {
  try { return (await fs.readdir(rawDir)).filter((file) => file.toLowerCase().endsWith(".png")); }
  catch (error) { if (error?.code === "ENOENT") return []; throw error; }
}

function textPanel({ titulo, fonte }) {
  const lines = wrapTitle(titulo, 24);
  const fontSize = lines.length >= 4 ? 48 : lines.length === 3 ? 54 : 58;
  const lineHeight = Math.round(fontSize * 1.08);
  const startY = lines.length >= 4 ? 230 : 250;
  const titleText = lines.map((line, index) => `<text x="70" y="${startY + index * lineHeight}" font-family="system-ui, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="#102a31">${escapeXml(line)}</text>`).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><pattern id="pattern" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M0 32 32 0l32 32-32 32Z" fill="none" stroke="#315f78" stroke-width="1" opacity=".08"/><circle cx="32" cy="32" r="14" fill="none" stroke="#d6a955" stroke-width="1" opacity=".10"/></pattern></defs>
    <rect width="720" height="630" fill="#f6efe0"/><rect width="720" height="630" fill="url(#pattern)"/><rect width="18" height="630" fill="#315f78"/>
    <rect x="70" y="64" width="188" height="48" rx="12" fill="#24594f"/><text x="164" y="96" text-anchor="middle" font-family="system-ui, Segoe UI, Arial, sans-serif" font-size="20" font-weight="800" letter-spacing="2.5" fill="#f6efe0">NOVIDADE</text>
    <text x="70" y="158" font-family="system-ui, Segoe UI, Arial, sans-serif" font-size="23" font-weight="800" letter-spacing="2.4" fill="#315f78">GUIA DO PROPRIETÁRIO</text>${titleText}
    <text x="70" y="548" font-family="system-ui, Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#24594f">Fonte: ${escapeXml(fonte)}</text>
    <text x="70" y="586" font-family="system-ui, Segoe UI, Arial, sans-serif" font-size="18" font-weight="650" fill="#5f7075">guiadoproprietario.pt</text>
  </svg>`);
}

const files = await listarPngs();
await fs.mkdir(outputDir, { recursive: true });
for (const file of files) {
  const slug = path.parse(file).name;
  const meta = await metadataForSlug(slug);
  const illustration = await sharp(path.join(rawDir, file)).resize(480, 630, { fit: "cover", position: "attention" }).png().toBuffer();
  const border = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="630"><rect width="480" height="630" fill="none" stroke="#315f78" stroke-width="10"/></svg>`);
  await sharp(textPanel(meta)).composite([{ input: illustration, left: 720, top: 0 }, { input: border, left: 720, top: 0 }]).png({ compressionLevel: 9 }).toFile(path.join(outputDir, file));
}
console.log(`Imagens sociais de novidades processadas: ${files.length}.`);