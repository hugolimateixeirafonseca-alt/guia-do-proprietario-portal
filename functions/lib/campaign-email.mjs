import {renderEmailLayout,emailCard,emailParagraph as p,escapeEmailHtml as esc} from './partner-email-layout.mjs';
export function renderCampaignEmail(kind,data){
 if(!['BF-confirmation','BF-reminder'].includes(kind))throw Error('invalid_campaign_email');
 const u=new URL(data.url);if(u.protocol!=='https:'||!['parceiros.guiadoproprietario.pt','engagement-test.guia-do-proprietario-parceiros.pages.dev'].includes(u.hostname)||u.username||u.password||u.port||!u.searchParams.get('t'))throw Error('invalid_personal_link');u.hash='pedidos';
 const progress=data.progress,rules=data.campaign?.terms;
 if(!progress||!Number.isInteger(progress.contacts)||progress.contacts<0||progress.contacts>5||!Array.isArray(rules)||rules.length<4||rules.some(x=>typeof x!=='string'||!x.trim())||!Number.isFinite(Date.parse(progress.purchase_deadline)))throw Error('invalid_campaign_data');
 const deadline=new Intl.DateTimeFormat('pt-PT',{timeZone:'Europe/Lisbon',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(progress.purchase_deadline));
 const reminder=kind==='BF-reminder',missing=5-progress.contacts;
 if(reminder&&(missing<1||data.remainingContacts!==missing))throw Error('invalid_campaign_remaining');
 const subject=reminder?'Campanha Flash: '+(missing===1?'falta 1 contacto':'faltam '+missing+' contactos')+' para completar os cinco':'Campanha Flash: a sua participação está confirmada';
 const paragraphs=reminder?[
 'Já adquiriu '+progress.contacts+' de 5 contactos abrangidos pela campanha. '+(missing===1?'Falta adquirir 1 contacto partilhado pago':'Faltam adquirir '+missing+' contactos partilhados pagos')+' até '+deadline+' (hora de Lisboa).',
 'Complete os cinco dentro do prazo para cumprir esta condição da garantia. Contacte também cada cliente nas primeiras 48 horas após obter o contacto. A devolução só pode ser pedida se não fechar nenhum serviço e cumprir as restantes condições aceites.'
 ]:[
 'Recebemos o seu carregamento de 15 € e a sua participação na Campanha Flash está confirmada.',
 'Tem até '+deadline+' (hora de Lisboa) para adquirir cinco contactos partilhados pagos abrangidos pela campanha.'
 ];
 const heading='As condições que aceitou';
 const content=emailCard(heading,'<ol style="margin:0;padding-left:22px">'+rules.map(x=>'<li style="margin:0 0 12px">'+esc(x)+'</li>').join('')+'</ol>')+p('A aquisição de contactos não garante a contratação de um serviço. Escolha pedidos adequados ao seu negócio e dê seguimento às conversas.');
 const textContent=heading+'\n'+rules.map((x,i)=>(i+1)+'. '+x).join('\n\n')+'\n\nA aquisição de contactos não garante a contratação de um serviço. Escolha pedidos adequados ao seu negócio e dê seguimento às conversas.';
 return renderEmailLayout({subject,title:reminder?'Complete os cinco contactos dentro do prazo.':'Já faz parte da Campanha Flash.',preview:paragraphs[0],name:data.name,paragraphs,content,textContent,button:{label:'Ver os pedidos na minha zona',url:u.toString()}});
}
