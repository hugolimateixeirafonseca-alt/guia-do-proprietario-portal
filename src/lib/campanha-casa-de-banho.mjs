import { trackerLink } from './tracker-link.mjs';

export function prepararCampanhaBanho(doc, win) {
 const firstSeenAt = Date.now();
 const links = [...doc.querySelectorAll('[data-banho-link]')];
 const atualizar = () => {
  const page = new URL(win.location.href);
  page.searchParams.set('source', 'campanha-casa-de-banho');
  const href = trackerLink({ offer: 'casa-banho-campanha', trackerOrigin: 'https://track.guiadoproprietario.pt', pageUrl: page.href, cookieString: doc.cookie, firstSeenAt });
  for (const link of links) link.href = href;
 };
 atualizar();
 for (const link of links) {
  for (const event of ['click', 'auxclick', 'contextmenu', 'focus']) link.addEventListener(event, atualizar);
 }
 const next = doc.querySelector('[data-banho-next]');
 for (const input of doc.querySelectorAll('input[name="intervencao"]')) {
  input.addEventListener('change', () => {
   if (next) next.textContent = input.value === 'duche'
    ? 'Na página seguinte, preencha o pedido para renovar a base de duche.'
    : 'Na página seguinte, preencha o pedido para trocar a banheira.';
  });
 }
}
