const FRONTMATTER_PATTERN = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/;

export function formatarDataIso(value) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.valueOf())) {
    throw new Error("Data inválida: " + value);
  }
  if (value instanceof Date) return date.toISOString().replace(/\.\d{3}Z$/, "Z");

  const timestamp = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) {
    throw new Error("A data não está no formato ISO 8601 esperado: " + value);
  }
  return timestamp;
}

export function lerDatasFrontmatter(source) {
  const match = source.match(FRONTMATTER_PATTERN);
  if (!match) throw new Error("O artigo não tem frontmatter YAML válido.");

  const frontmatter = match[2];
  const chegada = frontmatter.match(/^chegada:[ \t]*(.+)$/m)?.[1]?.trim() || null;
  const publicadoEm = frontmatter.match(/^publicado_em:[ \t]*(.+)$/m)?.[1]?.trim() || null;
  return { chegada, publicadoEm };
}

export function preencherDatasFrontmatter(source, { chegada, publicadoEm }) {
  const match = source.match(FRONTMATTER_PATTERN);
  if (!match) throw new Error("O artigo não tem frontmatter YAML válido.");

  const newline = match[1].includes("\r\n") ? "\r\n" : "\n";
  let frontmatter = match[2];
  const datasAtuais = lerDatasFrontmatter(source);

  if (!datasAtuais.chegada) {
    if (!/^publicado:[ \t]*.+$/m.test(frontmatter)) {
      throw new Error("O artigo não tem o campo publicado no frontmatter.");
    }
    const arrivalLine = "chegada: " + formatarDataIso(chegada);
    frontmatter = /^chegada:[ \t]*$/m.test(frontmatter)
      ? frontmatter.replace(/^chegada:[ \t]*$/m, arrivalLine)
      : frontmatter.replace(/^(publicado:[ \t]*.+)$/m, "$1" + newline + arrivalLine);
  }

  if (!datasAtuais.publicadoEm) {
    const publishedLine = "publicado_em: " + formatarDataIso(publicadoEm);
    frontmatter = /^publicado_em:[ \t]*$/m.test(frontmatter)
      ? frontmatter.replace(/^publicado_em:[ \t]*$/m, publishedLine)
      : frontmatter.replace(/^(chegada:[ \t]*.+)$/m, "$1" + newline + publishedLine);
  }

  return match[1] + frontmatter + match[3] + source.slice(match[0].length);
}
