import { trackerLink } from './tracker-link.mjs';
const attributionFields = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','adset_id','ad_id','fbclid'];
export function banhoThankYouUrl(href) {
  const from = new URL(href);
  const to = new URL('/pdf-casa-de-banho/obrigado/', from.origin);
  for (const key of attributionFields) {
    const value = from.searchParams.get(key);
    if (value) to.searchParams.set(key, value);
  }
  return to.href;
}
export function prepararCampanhaPdfBanho(doc, win) {
  const firstSeenAt = Date.now();
  for (const link of doc.querySelectorAll('[data-kit-campaign]')) {
    const update = () => {
      const page = new URL(win.location.href);
      page.searchParams.set('source', 'pdf-casa-de-banho-obrigado');
      for (const [key,value] of Object.entries({utm_source:'pdf-casa-de-banho',utm_medium:'thank-you',utm_campaign:'guia-banheira-duche-2026'})) {
        if (!page.searchParams.has(key)) page.searchParams.set(key,value);
      }
      if (!page.searchParams.has('utm_content')) page.searchParams.set('utm_content','cta-obrigado');
      link.href = trackerLink({offer:'casa-banho-campanha',trackerOrigin:'https://track.guiadoproprietario.pt',pageUrl:page.href,cookieString:doc.cookie,firstSeenAt});
    };
    update();
    for (const event of ['click','auxclick','contextmenu','focus']) link.addEventListener(event,update);
  }
}
