import { trackerLink } from "./tracker-link.mjs";
const parametrosCampanha = ["source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "campaign_id", "adset_id", "ad_id"] as const;
const primeiroAcesso = Date.now();
const linksPreparados = new WeakSet<HTMLAnchorElement>();

export function linkSeguroComCampanha(destino: string, origem: string, cookies = ""): string {
  const pagina = new URL(origem);
  const link = new URL(destino, pagina);
  if (link.origin === "https://track.guiadoproprietario.pt" && /^\/go\/seguro-vida-(landing|editorial)$/.test(link.pathname)) {
    if (!pagina.searchParams.has("source")) pagina.searchParams.set("source", pagina.pathname.split("/").filter(Boolean).at(-1) || "guia");
    return trackerLink({ offer: link.pathname.split("/").at(-1)!, trackerOrigin: link.origin, pageUrl: pagina.href, cookieString: cookies, firstSeenAt: primeiroAcesso });
  }
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
    const atualizar = () => { link.href = linkSeguroComCampanha(link.href, window.location.href, document.cookie); };
    atualizar();
    if (linksPreparados.has(link)) return;
    linksPreparados.add(link);
    for (const evento of ["click", "auxclick", "contextmenu"]) link.addEventListener(evento, atualizar);
  });
}
