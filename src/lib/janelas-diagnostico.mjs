import { trackerLink } from './tracker-link.mjs';
export const zonas = ['Amadora','Cascais','Lisboa','Loures','Odivelas','Oeiras','Sintra'];
export const quantidades = ['1-2','3-5','6-10','mais-10','nao-sei'];
export const sugestoes = {
 temperatura: 'Para o seu caso, vale a pena avaliar o isolamento térmico. As janelas em PVC podem ajudar a reduzir as perdas de calor e melhorar o conforto.',
 ruido: 'Para o seu caso, vale a pena avaliar o isolamento acústico. Na visita técnica, a NUVI poderá recomendar uma solução adequada ao ruído que sente em casa.',
 condensacao: 'A condensação pode ter várias causas. Uma avaliação das janelas e da ventilação ajuda a perceber a solução adequada à sua casa.',
 vedacao: 'Janelas que já não vedam bem podem deixar entrar ar e ruído. A visita técnica permite avaliar a substituição e o isolamento.',
 renovar: 'A substituição das janelas pode melhorar o conforto e renovar a casa. A NUVI poderá apresentar uma proposta adequada ao seu espaço.'
};
export function avaliarRespostas([problema, quantidade, zona]) {
 if (!Object.hasOwn(sugestoes,problema) || !quantidades.includes(quantidade) || !(zonas.includes(zona)||zona==='outra')) return 'incompleto';
 if (quantidade==='1-2') return 'quantidade';
 if (zona==='outra') return 'zona';
 return 'abrangido';
}
export function iniciarDiagnostico(raiz) {
 if (!raiz) return;
 const etapas = [...raiz.querySelectorAll('[data-step]')];
 const respostas = [];
 let atual = 0, temporizador;
 const primeiroAcesso = Date.now();
 const mostrar = (indice) => {
  clearTimeout(temporizador); atual=indice; raiz.dataset.active=String(indice>0);
  etapas.forEach((etapa,i)=>{etapa.hidden=i!==indice});
  etapas[indice].querySelector('h1,h2')?.focus({preventScroll:true});
  raiz.scrollIntoView({block:'start',behavior:'instant'});
 };
 const link=raiz.querySelector('[data-outbound]');
 const atualizarLink=()=>{
  const origem=new URL(window.location.href);origem.searchParams.set('source','janelas-diagnostico');
  link.href=trackerLink({offer:'janelas-diagnostico',trackerOrigin:'https://track.guiadoproprietario.pt',pageUrl:origem.href,cookieString:document.cookie,firstSeenAt:primeiroAcesso});
 };
 for(const evento of ['click','auxclick','contextmenu','focus'])link.addEventListener(evento,atualizarLink);
 const concluir=()=>{
  const resultado=avaliarRespostas(respostas);
  if(resultado==='incompleto'){mostrar(1);return}
  if(resultado!=='abrangido'){
   raiz.querySelector('[data-unavailable]').textContent=resultado==='quantidade'?'A campanha NUVI destina-se à substituição de 3 ou mais janelas. Indicou que pretende substituir 1–2 janelas.':'Por agora, esta campanha abrange Amadora, Cascais, Lisboa, Loures, Odivelas, Oeiras e Sintra. A zona que indicou ainda não está incluída.';
   mostrar(6);return;
  }
  raiz.querySelector('[data-personalized]').textContent=sugestoes[respostas[0]];
  raiz.querySelector('[data-zone]').textContent=respostas[2]+': zona abrangida';
  raiz.querySelector('[data-quantity]').textContent=respostas[1]==='nao-sei'?'A campanha aplica-se a 3 ou mais janelas. Confirme a quantidade com a NUVI.':'Substituição de 3 ou mais janelas';
  atualizarLink();mostrar(5);
 };
 raiz.querySelector('[data-start]').hidden=false;
 raiz.addEventListener('click',(evento)=>{
  if(!(evento.target instanceof Element))return;
  const botao=evento.target.closest('button');
  if(!botao||!etapas[atual].contains(botao))return;
  if(botao.hasAttribute('data-start'))mostrar(1);
  else if(botao.hasAttribute('data-back'))mostrar(atual-1);
  else if(botao.hasAttribute('data-edit'))mostrar(1);
  else if(botao.hasAttribute('data-answer') && atual>=1 && atual<=3){
   const pergunta=atual;
   respostas[pergunta-1]=botao.dataset.answer;
   etapas[pergunta].querySelectorAll('[data-answer]').forEach(opcao=>opcao.setAttribute('aria-pressed',String(opcao===botao)));
   if(pergunta<3)mostrar(pergunta+1);
   else {mostrar(4);temporizador=setTimeout(concluir,window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1200)}
  }
 });
}
