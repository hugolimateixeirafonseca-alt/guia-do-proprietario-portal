import { trackerLink } from './tracker-link.mjs';
export function prepararLinksJanelas(doc,win) {
 const firstSeenAt=Date.now();
 for(const link of doc.querySelectorAll('[data-janelas-link]')) {
  const atualizar=()=>{
   const page=new URL(win.location.href);
   page.searchParams.set('source','campanha-janelas');
   link.href=trackerLink({offer:'janelas-diagnostico',trackerOrigin:'https://track.guiadoproprietario.pt',pageUrl:page.href,cookieString:doc.cookie,firstSeenAt});
  };
  atualizar();
  for(const event of ['click','auxclick','contextmenu','focus'])link.addEventListener(event,atualizar);
 }
}
