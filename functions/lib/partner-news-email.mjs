import {renderEmailCopyV2} from './partner-email-copy-v2.mjs';
export const NEWS_VERSION='commercial_news_v1';
export const NEWS_PREVIEW_URL='https://parceiros.guiadoproprietario.pt/?t=EXEMPLO-LIGACAO-PESSOAL#saldo';
export function renderPartnerNewsEmail(data={}){return renderEmailCopyV2('P1',{url:'https://parceiros.guiadoproprietario.pt/?t=EXEMPLO-LIGACAO-PESSOAL',requests:[],freeContacts:0,registrationConfirmationReady:true,whatsappReady:true,...data});}

