import {trackerLink} from './tracker-link.mjs';
export function prepararJanelasEditorial(doc,win){
 const firstSeenAt=Date.now();
 for(const link of doc.querySelectorAll('[data-janelas-editorial-link]')){
  const atualizar=()=>{
   const page=new URL(win.location.href);
   page.searchParams.set('source',page.pathname.split('/').filter(Boolean).at(-1)||'janelas-editorial');
   link.href=trackerLink({offer:'janelas-diagnostico',trackerOrigin:'https://track.guiadoproprietario.pt',pageUrl:page.href,cookieString:doc.cookie,firstSeenAt});
  };
  atualizar();
  for(const event of ['click','auxclick','contextmenu','focus'])link.addEventListener(event,atualizar);
 }
}
