const parametrosCampanha = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function linkSeguroComCampanha(destino: string, origem: string): string {
  const pagina = new URL(origem);
  const link = new URL(destino, pagina);
  // Conservar as ligações de afiliado exatamente como fornecidas.
  // A plataforma já distingue landing/editorial através do adsid.
  if (link.origin !== pagina.origin) return destino;
  for (const chave of parametrosCampanha) {
    const valor = pagina.searchParams.get(chave);
    // Apenas etiquetas de campanha. Não copiar o query string, click IDs ou contactos.
    if (valor && /^[\p{L}\p{N}_ .~+\-]{1,160}$/u.test(valor)) link.searchParams.set(chave, valor);
  }
  return link.toString();
}

export function prepararLinksSeguroVida() {
  document.querySelectorAll<HTMLAnchorElement>('a[data-seguro-link], .article-body a[href^="/casa/"]').forEach((link) => {
    link.href = linkSeguroComCampanha(link.href, window.location.href);
  });
}
