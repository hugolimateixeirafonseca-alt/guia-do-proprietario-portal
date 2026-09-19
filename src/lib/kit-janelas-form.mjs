import { initPdfOptin } from './pdf-optin-form.mjs';
import { kitThankYouUrl } from './kit-janelas-campaign.mjs';
export function initKitJanelas(doc, win) {
  return initPdfOptin(doc, win, { endpoint:'/api/kit-trocar-janelas', source:'kit-trocar-janelas', thankYouUrl:kitThankYouUrl });
}
