import { createPdfOptinHandler } from '../lib/pdf-optin';
import { windowsMessage } from '../lib/pdf-optin-messages';
import { KIT_JANELAS_CONSENT_VERSION } from '../../src/data/consent';
const PDF_URL = "https://guiadoproprietario.pt/downloads/kit-trocar-janelas-2026.pdf";
const PAGE_URL = "https://guiadoproprietario.pt/kit-trocar-janelas/";
const CAMPAIGN_URL = "https://track.guiadoproprietario.pt/go/kit-trocar-janelas?source=kit-trocar-janelas-email&utm_source=kit-trocar-janelas&utm_medium=email&utm_campaign=checklist-17-pontos&utm_content=cta-email";
export const onRequestPost = createPdfOptinHandler({
 source: 'kit-trocar-janelas', pageUrl: PAGE_URL, consentVersion: KIT_JANELAS_CONSENT_VERSION,
 dbBinding: 'KIT_JANELAS_DB', eventPrefix: 'janelas', registrationPrefix: 'kit-janelas-registration', hashPrefix: 'kit-janelas', legacyHistory: true,
 message: windowsMessage(PDF_URL, CAMPAIGN_URL)
});
