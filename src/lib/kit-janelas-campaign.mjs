import { trackerLink } from './tracker-link.mjs';
const attributionFields = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','adset_id','ad_id','fbclid'];
export function kitThankYouUrl(href) {
  const from = new URL(href);
  const to = new URL('/kit-trocar-janelas/obrigado/', from.origin);
  for (const key of attributionFields) {
    const value = from.searchParams.get(key);
    if (value) to.searchParams.set(key, value);
  }
  return to.href;
}
export function prepararCampanhaKit(doc, win) {
  const firstSeenAt = Date.now();
  for (const link of doc.querySelectorAll('[data-kit-campaign]')) {
    const update = () => {
      const page = new URL(win.location.href);
      page.searchParams.set('source', 'kit-trocar-janelas-obrigado');
      for (const [key,value] of Object.entries({utm_source:'kit-trocar-janelas',utm_medium:'thank-you',utm_campaign:'checklist-17-pontos'})) {
        if (!page.searchParams.has(key)) page.searchParams.set(key,value);
      }
      page.searchParams.set('utm_content','cta-obrigado');
      link.href = trackerLink({offer:'kit-trocar-janelas',trackerOrigin:'https://track.guiadoproprietario.pt',pageUrl:page.href,cookieString:doc.cookie,firstSeenAt});
    };
    update();
    for (const event of ['click','auxclick','contextmenu','focus']) link.addEventListener(event,update);
  }
}
