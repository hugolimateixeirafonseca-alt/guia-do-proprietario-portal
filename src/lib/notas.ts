import type { CollectionEntry } from "astro:content";

export function compararNotasRecentes(a: CollectionEntry<"notas">, b: CollectionEntry<"notas">) {
  const diferencaData = b.data.data.valueOf() - a.data.data.valueOf();
  if (diferencaData !== 0) return diferencaData;

  return a.id.localeCompare(b.id, "pt");
}
