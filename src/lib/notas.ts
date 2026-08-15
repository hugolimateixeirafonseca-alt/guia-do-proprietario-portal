import type { CollectionEntry } from "astro:content";

export function compararNotasRecentes(a: CollectionEntry<"notas">, b: CollectionEntry<"notas">) {
  const diferencaData = b.data.data.valueOf() - a.data.data.valueOf();
  if (diferencaData !== 0) return diferencaData;

  return b.id.localeCompare(a.id, "pt");
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarFonte(valor: string) {
  try {
    const url = new URL(valor);
    url.hash = "";
    for (const parametro of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(parametro)) url.searchParams.delete(parametro);
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return valor.trim().replace(/\/+$/, "");
  }
}

/**
 * Defesa final da camada pública. A lista deve chegar ordenada do mais recente
 * para o mais antigo; em caso de duplicação mantém-se sempre a entrada mais nova.
 */
export function deduplicarNotas(notas: CollectionEntry<"notas">[]) {
  const fontes = new Set<string>();
  const titulosPorDia = new Set<string>();

  return notas.filter((nota) => {
    const fonte = normalizarFonte(nota.data.fonte_url);
    const dia = nota.data.data.toISOString().slice(0, 10);
    const tituloDia = `${dia}|${normalizarTexto(nota.data.titulo)}`;

    if (fontes.has(fonte) || titulosPorDia.has(tituloDia)) return false;

    fontes.add(fonte);
    titulosPorDia.add(tituloDia);
    return true;
  });
}
