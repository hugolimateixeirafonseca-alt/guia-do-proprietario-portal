import {renderPlannedPartnerEmail} from './partner-planned-emails.mjs';
import {renderEmailLayout,emailCard,emailParagraph as p,emailButton,emailLink,escapeEmailHtml as esc} from './partner-email-layout.mjs';
export const V2_REVIEW_IDS=['P1','P4','Resumo','Candidatura'];
export const V2_ADDITION_IDS=['Inativo','Oferta-individual','C1-partilhada','C1-exclusiva','C2','C3','C4','C5','C6','Interesse-5','Interesse-15','Candidatura-admin'];
export const V2_REMAINING_IDS=['P5','P6','P7','P8','P9','P10','P11','P12','Sem-acesso','Gratis-por-usar','Feedback-atual','Gratis-esgotados','Carregamentos-pausados','Partilhado-outro','Pedido-termina','Pedidos-terminam','Cliente-sem-contactos','Z1'];
const euro=n=>{if(!Number.isSafeInteger(n)||n<=0)throw Error('invalid_account_price');return (n/100).toFixed(2).replace('.',',')+' €';};
function personal(value){const u=new URL(value);if(u.protocol!=='https:'||!['parceiros.guiadoproprietario.pt','engagement-test.guia-do-proprietario-parceiros.pages.dev'].includes(u.hostname)||u.port||u.username||u.password||!u.searchParams.get('t'))throw Error('invalid_personal_link');return u;}
const path=(value,hash)=>{const u=personal(value);u.hash=hash;return u.toString();};
function badges(r,{registrationConfirmationReady=false,whatsappReady=false}={}){
 const badges=[];
 if(registrationConfirmationReady&&r.registrationConfirmed===true)badges.push({label:'✓ Pedido confirmado pelo cliente no registo',style:'background:#EEF5F0;color:#1E4634;border:1px solid #EEF5F0'});
 if(whatsappReady&&r.whatsappVerified===true)badges.push({label:'◉ WhatsApp verificado',style:'background:#FFFFFF;color:#1E4634;border:1px solid #1E4634'});
 if(whatsappReady&&r.interestConfirmed===true)badges.push({label:'✓ Interesse confirmado pelo cliente por WhatsApp',style:'background:#1E4634;color:#FFFFFF!important;border:1px solid #1E4634'});
 return badges;
}
export function renderEmailRequestCard(r,data,{candidate=false}={}){
 for(const key of ['id','cleaningType','place','typology','frequency','when','day','period'])if(typeof r[key]!=='string'||!r[key].trim())throw Error('invalid_request_card');
 if(!/^[a-z0-9-]{6,80}$/i.test(r.id)||!/^\d{4}(?:-\d{3})?$/.test(r.postalCode))throw Error('invalid_request_identifier');
 if(!Number.isSafeInteger(r.remaining)||r.remaining<1||r.remaining>3||!Number.isSafeInteger(r.obtained)||r.obtained<0||r.obtained>2)throw Error('invalid_capacity');
 const short=r.id.slice(0,6).toUpperCase(),cp4=r.postalCode.slice(0,4),b=badges(r,{...data,registrationConfirmationReady:false}).filter(v=>v.label.includes('WhatsApp'));
 const location=r.place+' · '+cp4+(r.municipality&&r.municipality!==r.place?' · '+r.municipality:'');
 const identity='Pedido '+short+' · '+r.cleaningType+' · '+location+' · '+r.typology;
 const available=r.obtained===0?'Ainda ninguém obteve este contacto':'Restam '+r.remaining+' '+(r.remaining===1?'lugar':'lugares');
 const u=candidate?null:personal(data.url);if(u){u.searchParams.set('pedido',r.id);u.hash='pedidos';}
 const free=(data.freeSharedContacts??data.freeContacts)>0||r.obtained===0&&(data.freeExclusiveContacts??0)>0;
 const price=candidate||data.hidePrices?'':free?'GRÁTIS':'Partilhado '+euro(data.prices?.partilhada)+(r.obtained===0?' · Exclusivo '+euro(data.prices?.exclusiva):'');
 const freeType=(data.freeSharedContacts??data.freeContacts)>0?'partilhado':'exclusivo';
 const freeExplanation=free?'Pode usar 1 contacto '+freeType+' grátis da sua conta neste pedido.':'';
 const preferences=(r.contactPreferences||[]).map(v=>({phone:'Chamada telefónica',sms:'SMS',whatsapp:'WhatsApp',email:'Email'})[v]).filter(Boolean).join(' · ')||'Sem preferência de contacto';
 const entered=r.createdAt&&!Number.isNaN(Date.parse(r.createdAt))?new Date(r.createdAt).toLocaleString('pt-PT',{timeZone:'Europe/Lisbon',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
 const header='<tr><td bgcolor="#EEF5F0" style="padding:16px 18px;background:#EEF5F0;border-radius:12px 12px 0 0;border-bottom:1px solid #c6d6cc"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td valign="top" style="padding:0 12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;font-weight:bold;color:#1E4634!important"><span style="font-size:22px;line-height:28px;color:#1E4634!important">'+esc(r.cleaningType)+' · '+esc(r.frequency)+'</span></td><td valign="top" align="right" style="padding:3px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;font-weight:normal;white-space:nowrap;color:#1E4634!important">Pedido '+esc(short)+'</td></tr><tr><td colspan="2" style="padding:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;font-weight:bold;color:#1E4634!important">'+esc(location)+'</td></tr></table></td></tr>';

 const details=p('<strong>Dias:</strong> '+esc(r.day)+'<br><strong>Períodos:</strong> '+esc(r.period));
 const body=(b.length?'<p style="margin:0 0 16px">'+b.map(v=>'<span style="display:inline-block;margin:0 8px 8px 0;padding:8px;font-size:14px;line-height:1.4;font-weight:bold;border-radius:6px;'+v.style+'">'+esc(v.label)+'</span>').join('')+'</p>':'')+p('<strong>Tipo de espaço:</strong> '+esc(r.typology)+'<br><strong>Quando pretende começar:</strong> '+esc(r.when))+p('<strong>Preferência de contacto:</strong> '+esc(preferences))+(entered?p('<strong>Entrada do pedido:</strong> '+esc(entered)):'')+p('<strong>Lugares disponíveis:</strong> '+r.remaining+'<br>'+esc(available))+details+(u?p(emailLink('Ver detalhes',u.toString())):'')+(price?p('<strong>'+esc(price)+'</strong>'+(free?'<br>'+esc(freeExplanation):'')):'')+(u?'<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#1E4634" style="border-radius:8px"><a class="request-cta" href="'+esc(u.toString())+'" style="display:block;padding:14px 20px;background:#1E4634;color:#FFFFFF!important;font-size:16px;font-weight:bold;text-decoration:none;border-radius:8px">Obter contacto</a></td></tr></table>':'');
 return {html:'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:2px solid #c6d6cc;border-radius:12px;box-shadow:0 3px 10px rgba(30,70,52,.04)">'+header+'<tr><td style="padding:20px">'+body+'</td></tr></table>',text:[r.cleaningType+' · '+r.frequency,'Pedido '+short,location,...b.map(v=>v.label),'Tipo de espaço: '+r.typology,'Quando pretende começar: '+r.when,'Preferência de contacto: '+preferences,entered?'Entrada do pedido: '+entered:'','Lugares disponíveis: '+r.remaining,available,'Dias: '+r.day,'Períodos: '+r.period,u?'Ver detalhes: '+u:'',price,price&&free?freeExplanation:'',u?'Obter contacto: '+u:''].filter(Boolean).join('\n')};
}
function cards(requests,data,candidate=false){
 const list=requests.map(r=>renderEmailRequestCard(r,data,{candidate}));
 const notice='Todos os pedidos foram confirmados pelo cliente no registo e são igualmente válidos, com ou sem as etiquetas de WhatsApp.';
 return {html:(list.length?emailCard('',p(esc(notice)),{rules:true}):'')+'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'+list.map(v=>'<tr><td class="request-column" style="padding:0 0 32px">'+v.html+'</td></tr>').join('')+'</table>',text:[list.length?notice:'',...list.map(v=>v.text)].filter(Boolean).join('\n\n')};
}

/** Pure content renderer. Delivery readiness is enforced by the event queue. */
function renderEmailCopyV2Core(id,data){
 if(V2_REMAINING_IDS.includes(id))return renderEmailCopyV2Remaining(id,data);
 if(V2_ADDITION_IDS.includes(id))return renderEmailCopyV2Addition(id,data);
 if(!V2_REVIEW_IDS.includes(id))throw Error('email_awaits_four_draft_review');
 if(!Array.isArray(data.requests)||!Number.isSafeInteger(data.freeContacts)||data.freeContacts<0)throw Error('invalid_email_data');
 const candidate=id==='Candidatura',requests=data.requests.slice(0,id==='Resumo'?6:3);if(!candidate)personal(data.url);
 let subject,preview,title,content='',textContent='';
 const add=(html,text)=>{content+=html;textContent+=(textContent?'\n\n':'')+text;};
 const block=(heading,text,options={})=>add(emailCard(heading,text.split('\n').map(line=>p(esc(line))).join(''),options),heading+'\n'+text);
 const grid=()=>{const c=cards(requests,{...data,hidePrices:id==='P4'},candidate);add(c.html,c.text);};
 const main=(label)=>add(emailButton(label,path(data.url,'pedidos')),label+': '+path(data.url,'pedidos'));
 const labelsUrl=()=>{const u=personal(data.url);u.hash='etiquetas';return u.toString();};
 switch(id){
 case 'P1':{
  subject='Novidades: mais informação em cada pedido e contactos mais baratos';preview='Veja os pedidos que já estão na sua zona.';title='Mais informação em cada pedido.\nContactos mais baratos.\nUm bónus para si.';
  add(p('Obrigado por fazer parte do Guia do Proprietário. <strong>Temos novidades que fazem cada contacto valer mais.</strong>'),'Obrigado por fazer parte do Guia do Proprietário. Temos novidades que fazem cada contacto valer mais.');
  let labelHtml=p('Os pedidos passam a mostrar como foram confirmados:'),labelText='Os pedidos passam a mostrar como foram confirmados:';
  const samples=badges({registrationConfirmed:true,whatsappVerified:true,interestConfirmed:true},data);
  for(const v of samples){const explanation=v.label.includes('no registo')?'Todos os pedidos confirmados no registo têm esta etiqueta.':v.label.includes('Interesse')?'Falámos com o cliente e ele confirmou que quer o serviço.':'O número do cliente tem WhatsApp.';labelHtml+=p('<strong style="display:inline-block;padding:10px;border-radius:6px;'+v.style+'">'+esc(v.label)+'</strong>')+p(esc(explanation));labelText+='\n'+v.label+'\n'+explanation;}
  const explanation=data.registrationConfirmationReady?'Os clientes submetem pedidos para encontrar um profissional de limpeza. A verificação por WhatsApp é um passo extra. Sem essa etiqueta, o interesse foi indicado pelo cliente no registo. Veja a confirmação disponível em cada pedido.':'As etiquetas de WhatsApp são passos extra quando conseguimos falar com o cliente. Um pedido sem estas etiquetas é tão válido como os outros.';
  labelHtml+=p('<strong>'+esc(explanation)+'</strong>');labelText+='\n'+explanation;add(emailCard('1. Saiba mais sobre cada pedido',labelHtml),'1. Saiba mais sobre cada pedido\n'+labelText);
  const priceText='Partilhado: '+euro(data.prices?.partilhada)+'. Até 3 profissionais podem receber o mesmo contacto.\nExclusivo: '+euro(data.prices?.exclusiva)+'. Só você recebe este contacto através do Guia do Proprietário. Disponível enquanto ninguém tiver obtido o contacto.';
  const priceCell=(label,amount,description)=>'<td class="request-column" width="50%" valign="top" style="padding:16px;background:#EEF5F0;border-radius:8px"><p style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1E4634">'+label+'</p><p style="margin:0 0 14px;font-size:40px;font-weight:bold;line-height:1.2;color:#1E4634">'+euro(amount)+'</p>'+p(description)+'</td>';
  add(emailCard('2. Contactos mais baratos','<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>'+priceCell('Partilhado',data.prices.partilhada,'Até <strong>3 profissionais</strong> podem receber o mesmo contacto.')+priceCell('Exclusivo',data.prices.exclusiva,'<strong>Só você</strong> recebe este contacto através do Guia do Proprietário.')+'</tr></table>'+p('Disponível enquanto ninguém tiver obtido o contacto.')),'2. Contactos mais baratos\n'+priceText);
  const u=personal(data.url);u.pathname='/regras-garantia.html';u.hash='';
  const guarantee='Tente 3 vezes, em 2 dias úteis diferentes, pelos botões da plataforma. Depois, carregue em “Pedir outro contacto”.\nO cliente já tinha contratado outra pessoa antes de comprar o seu contacto? Também lhe damos outro contacto.\nNós confirmamos com o cliente. Só para contactos pagos.';
  add(emailCard('3. O cliente não atende? Damos-lhe outro contacto.',guarantee.split('\n').map(v=>p(esc(v))).join('')+p(emailLink('Ver as regras',u.toString())),{rules:true}),'3. O cliente não atende? Damos-lhe outro contacto.\n'+guarantee+'\nVer as regras: '+u);
  if(requests.length){add('<h2 style="font-size:24px;color:#1E4634">Pedidos na sua zona agora</h2>','Pedidos na sua zona agora');grid();}main('Ver os pedidos da minha zona');
  const offer='Num carregamento de 15 € ou mais, recebe 2 contactos partilhados grátis, uma única vez.\nOs 15 € ficam no seu saldo para os contactos seguintes.\nA oferta é opcional.';
  add(emailCard('4. Oferta para si: carregue 15 € e receba 2 contactos grátis',offer.split('\n').map(v=>p(esc(v))).join('')+p(emailLink('Ver a oferta',path(data.url,'saldo'))),{offer:true}),'4. Oferta para si: carregue 15 € e receba 2 contactos grátis\n'+offer+'\nVer a oferta: '+path(data.url,'saldo'));
  block('O que já tem continua a ser seu','O seu saldo e os contactos grátis que ainda tem mantêm-se.\nSe quiser sair, devolvemos o dinheiro que não gastou. Nos primeiros 60 dias depois de receber esta oferta, descontamos os contactos da oferta que usou. Os contactos grátis anteriores ficam fora deste desconto.');break;
 }
 case 'P4':{
  if(!['novo','anterior'].includes(data.model))throw Error('invalid_partner_model');
  subject='A sua conta foi aprovada: veja os pedidos da sua zona';preview=requests.length?'Já há pedidos de limpeza à sua espera.':'A sua conta está aprovada. Avisamos quando houver pedidos na sua zona.';title=requests.length?'Bem-vindo(a)!\nJá há pedidos à sua espera.':'Bem-vindo(a)!\nA sua conta está aprovada.';
  add(p(esc(requests.length?'A sua conta está aprovada. Já pode ver todos os pedidos de limpeza da sua zona.':'A sua conta está aprovada. Assim que entrar um pedido na sua zona, avisamos por email.'))+p('<strong>Guarde este email para voltar a entrar.</strong> Esta ligação é pessoal: não a partilhe.'),(requests.length?'A sua conta está aprovada. Já pode ver todos os pedidos de limpeza da sua zona.':'A sua conta está aprovada. Assim que entrar um pedido na sua zona, avisamos por email.')+'\n\nGuarde este email para voltar a entrar. Esta ligação é pessoal: não a partilhe.');
  if(requests.length){add('<h2 style="font-size:24px;color:#1E4634">Alguns pedidos na sua zona</h2>','Alguns pedidos na sua zona');grid();}main('Ver os pedidos da minha zona');
  block('Como funciona','1. Vê o pedido completo: tipo de limpeza, casa, frequência e dias.\n2. Escolhe os pedidos que lhe interessam e obtém o contacto.\n3. Fala diretamente com o cliente e apresenta o seu orçamento.');
  const words='Todos os pedidos são de pessoas reais, que pediram preço no nosso site.';add(p(esc(words))+p(emailLink('O que significam as etiquetas?',labelsUrl())),words+'\nO que significam as etiquetas?: '+labelsUrl());
  const welcome=data.model==='anterior'?'Tem '+data.freeContacts+' contactos grátis para começar.':'Na sua área tem também uma oferta de boas-vindas à sua espera.';add(p('<strong>'+esc(welcome)+'</strong>'),welcome);break;
 }
 case 'Resumo':{
  if(!Number.isSafeInteger(data.total)||data.total<requests.length||!requests.length)throw Error('invalid_request_count');
  subject=data.total===1?'1 novo pedido de limpeza nas suas zonas':data.total+' novos pedidos de limpeza nas suas zonas';title=data.total===1?'1 novo pedido na sua zona':data.total+' novos pedidos nas suas zonas';preview=[...new Set(requests.map(r=>r.place))].slice(0,2).join(', ')+(data.total>requests.length?' e mais.':'.')+' Veja antes que outros profissionais.';
  add(p('Entraram novos pedidos de limpeza nas suas zonas:'),'Entraram novos pedidos de limpeza nas suas zonas:');grid();if(data.total>requests.length)add(p(emailLink('Ver mais '+(data.total-requests.length)+' pedidos',path(data.url,'pedidos'))),'Ver mais '+(data.total-requests.length)+' pedidos: '+path(data.url,'pedidos'));main('Ver todos os pedidos');
  const words='Os pedidos são submetidos por clientes que procuram um profissional. Veja no cartão como o interesse foi confirmado. As etiquetas de WhatsApp identificam uma verificação adicional.';add(p(esc(words)),words);const preferences='Pode escolher um ou dois resumos por dia, ou desligar estes avisos, em “O meu perfil”.';add(p(esc(preferences)),preferences);break;
 }
 case 'Candidatura':{
  subject=requests.length?'Recebemos a sua candidatura: já há pedidos na sua zona':'Recebemos a sua candidatura';preview=requests.length?'Veja os pedidos que estão à espera de um profissional.':'Enquanto a analisamos, preparamos o seu acesso.';title='Obrigado pela sua candidatura!';
  const intro=requests.length?'Recebemos a sua candidatura. Enquanto a analisamos, veja alguns pedidos que entraram na sua zona:':'Recebemos a sua candidatura. Enquanto a analisamos, preparamos o seu acesso.';add(p(esc(intro)),intro);if(requests.length)grid();block('O que acontece agora','1. Confirmamos os seus dados.\n2. Aprovamos a sua conta, normalmente em 24 horas úteis.\n3. Recebe o acesso por email e pode ver todos os pedidos da sua zona.');
  if(data.proofMissing===true){const proof=clientLink(data.proofUrl,'/documentos.html');add(p('Este comprovativo foi solicitado pela gestão. <strong>Tem 15 dias a contar do envio efetivo do pedido para o entregar.</strong> Se não lhe for solicitado nenhum documento, não tem de enviar comprovativos.'),'Este comprovativo foi solicitado pela gestão. Tem 15 dias a contar do envio efetivo do pedido para o entregar. Se não lhe for solicitado nenhum documento, não tem de enviar comprovativos.');add(emailButton('Enviar o meu comprovativo',proof.toString()),'Enviar o meu comprovativo: '+proof);}break;
 }
 }
 const result=renderEmailLayout({subject,preview,title,name:data.name,content,textContent});result.html=result.html.replace('</style>','@media only screen and (max-width:480px){.request-column{display:block!important;width:100%!important;padding:0 0 24px!important;box-sizing:border-box}.request-empty{display:none!important}}</style>');return result;
}

function required(value){if(typeof value!=='string'||!value.trim()||/^(undefined|null|\{.*\})$/i.test(value.trim()))throw Error('missing_email_data');return value.trim();}
function clientLink(value,pathname){const u=new URL(value);if(u.protocol!=='https:'||!['parceiros.guiadoproprietario.pt','engagement-test.guia-do-proprietario-parceiros.pages.dev'].includes(u.hostname)||u.port||u.username||u.password||u.pathname!==pathname||!u.hash&&!u.searchParams.get('t'))throw Error('invalid_client_link');return u.toString();}
export function renderEmailCopyV2Addition(id,data){
 if(!V2_ADDITION_IDS.includes(id))throw Error('unsupported_addition');
 if(/^C[2-6]$/.test(id)){
  const e=renderPlannedPartnerEmail(id,data),old='A resposta só fica registada quando confirmar na página que abre.',note='Depois de escolher, confirme na página que abre.';
  e.html=e.html.replace(p(esc(old)),'').replace('<p style="margin:20px 0 0;',p(esc(note))+'<p style="margin:20px 0 0;');
  e.text=e.text.replace(old+'\n\n','').replace('Recebe este email porque fez um pedido de limpeza',note+'\n\nRecebe este email porque fez um pedido de limpeza');
  if(id==='C4'){
   e.subject='Contratou '+required(data.professional)+' para a sua limpeza?';
   e.html=e.html.replace('Uma pergunta rápida sobre a sua limpeza.','Uma pergunta rápida, com um clique.');
   if(data.serviceWon){
    const old=data.professional+' também recebeu o seu pedido de limpeza em '+data.place+'. Contratou este profissional?';
    const question=data.professional+' indicou-nos que ficou com o seu serviço de limpeza em '+data.place+'. Confirma que contratou este profissional?';
    e.html=e.html.replace(esc(old),esc(question));e.text=e.text.replace(old,question);
   }
  }
  return e;
 }
 if(id==='Oferta-individual'){
  if(data.rightGranted!==true||!['partilhado','exclusivo'].includes(data.contactType))throw Error('offer_not_confirmed');
  const reason=typeof data.offerReason==='string'?data.offerReason.trim():'';
  return renderEmailLayout({subject:'Tem 1 contacto grátis na sua conta',preview:'Já pode usá-lo num pedido disponível.',name:data.name,paragraphs:[...(reason?[reason]:[]),'Atribuímos-lhe 1 contacto '+data.contactType+' grátis. Já pode usá-lo num pedido disponível.'],button:{label:'Usar o meu contacto grátis',url:path(data.url,'pedidos')},offer:true});
 }
 if(id==='Inativo'){
  if(!Number.isSafeInteger(data.missedRequests)||data.missedRequests<=0||!Array.isArray(data.requests))throw Error('invalid_inactive_data');
  const c=cards(data.requests.slice(0,3),data),intro='Na última semana, '+data.missedRequests+' pedidos nas suas zonas foram obtidos por outros profissionais ou terminaram.';
  const available=data.requests.length?'Há novos pedidos a entrar. Estes ainda estão disponíveis:':'Veja os pedidos que estão disponíveis na sua área.';
  const advice='Os pedidos não lhe servem?\nAjuste as zonas e os tipos de limpeza em “O meu perfil”.\nIndique os dias e horários em que tem disponibilidade.\nSem disponibilidade agora? Pode pausar a receção de pedidos.';
  const content=p(esc(intro))+p(esc(available))+c.html+emailButton('Ver pedidos disponíveis',path(data.url,'pedidos'))+emailCard('Os pedidos não lhe servem?',p('Ajuste as zonas e os tipos de limpeza em <strong>“O meu perfil”</strong>.')+p('Indique os dias e horários em que tem disponibilidade.')+p('Sem disponibilidade agora? Pode pausar a receção de pedidos.'));
  const e=renderEmailLayout({subject:data.missedRequests+' pedidos na sua zona passaram-lhe ao lado',preview:'Veja os que ainda estão disponíveis.',name:data.name,content,textContent:[intro,available,c.text,'Ver pedidos disponíveis: '+path(data.url,'pedidos'),advice].filter(Boolean).join('\n\n')});
  e.html=e.html.replace('</style>','@media only screen and (max-width:480px){.request-column{display:block!important;width:100%!important;padding:0 0 24px!important;box-sizing:border-box}.request-empty{display:none!important}}</style>');return e;
 }
 if(id==='C1-partilhada'||id==='C1-exclusiva'){
  const place=required(data.place),professional=required(data.professional),phone=required(data.professionalPhone);if(!/^\+?[\d ()-]{9,24}$/.test(phone))throw Error('invalid_professional_phone');
  const resolve=clientLink(data.resolveUrl,'/pedido-resposta.html'),stop=clientLink(data.stopUrl,'/pedido-contactos.html');
  const intro='Boas notícias: o seu pedido de limpeza em '+place+' foi aceite por um profissional da sua zona.',recognize='Se receber uma chamada de um número desconhecido nas próximas horas, atenda: pode ser este profissional.';
  const timing='Pedimos ao profissional que o(a) contacte até ao próximo dia útil. Se preferir, pode também ligar diretamente.';
  const mode=id==='C1-partilhada'?'O seu pedido pode ser aceite por até 3 profissionais.':'Este profissional é o único a receber o seu contacto através do Guia do Proprietário.';
  const conditions='Antes de marcar o serviço:\nPeça o orçamento por escrito.\nConfirme o que está incluído e o preço final.';
  const service='O Guia do Proprietário encaminha o pedido, mas não presta o serviço de limpeza.';
  const content=p(esc(intro))+emailCard(professional,p('📞 '+esc(phone)))+p(esc(recognize))+p(esc(timing))+p(esc(mode))+emailCard('Antes de marcar o serviço:',p('Peça o orçamento por escrito.')+p('Confirme o que está incluído e o preço final.'),{rules:true})+p(esc(service))+p('<strong>'+emailLink('Já resolveu a limpeza? Avise-nos aqui.',resolve)+'</strong>')+'<p style="margin:24px 0 0;font-size:14px;line-height:1.6">'+emailLink('Não quero receber mais contactos',stop)+'</p>';
  return renderEmailLayout({subject:professional+' vai contactá-lo(a) sobre a sua limpeza',preview:'Guarde este contacto para reconhecer a chamada.',title:'Um profissional vai contactá-lo(a).',name:data.name,audience:'client',signature:false,content,textContent:[intro,professional+'\n📞 '+phone,recognize,timing,mode,conditions,service,'Já resolveu a limpeza? Avise-nos aqui.: '+resolve,'Não quero receber mais contactos: '+stop].join('\n\n')});
 }
 if(id==='Interesse-5'||id==='Interesse-15'){
  const place=required(data.place),interest=clientLink(data.interestUrl,'/pedido-interesse.html'),stop=clientLink(data.stopUrl,'/pedido-contactos.html');
  const rawDate=String(data.requestedAt||''),date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(rawDate)?rawDate:rawDate.replace(' ','T')+'Z');
  const day=Number.isNaN(date.getTime())?'':date.toLocaleDateString('pt-PT',{timeZone:'Europe/Lisbon'});
  const service=String(data.cleaningType||'limpeza').trim().replace(/^Limpeza/, 'limpeza');
  const intro=(day?'No dia '+day+' pediu-nos preço para ':'Pediu-nos preço para ')+(service.startsWith('limpeza')?'uma ':'')+service+' em ';
  const availability=id==='Interesse-5'?'O seu pedido continua disponível para os profissionais da sua zona.':'O prazo do seu pedido terminou. Confirme que ainda precisa da limpeza para o voltarmos a disponibilizar por mais 15 dias.';
  const instruction='Clique no botão abaixo. Na página seguinte, confirme que ainda precisa da limpeza.';
  const content=p(esc(intro)+'<strong>'+esc(place)+'</strong>.')+p(esc(availability))+p('<strong>Ainda precisa da limpeza?</strong>')+p(esc(instruction))+emailButton('Sim, ainda preciso',interest)+p('Já resolveu ou já não precisa? '+emailLink('Avise-nos aqui',stop))+p('Obrigado,<br>Guia do Proprietário');
  const textContent=[intro+place+'.',availability,'Ainda precisa da limpeza?',instruction,'Sim, ainda preciso: '+interest,'Já resolveu ou já não precisa? Avise-nos aqui: '+stop,'Obrigado,\nGuia do Proprietário'].join('\n\n');
  return renderEmailLayout({subject:'Ainda precisa da limpeza em '+place+'?',preview:'Abra o botão e confirme na página seguinte.',name:String(data.name||'').trim().split(/\s+/)[0],audience:'client',content,textContent,signature:false});
 }
 if(id==='Candidatura-admin'){
  const candidate=required(data.candidateName),zones=required(data.zones),type=required(data.partnerType),proof=required(data.proofStatus);
  if(!['empresa','profissional independente'].includes(type)||!['enviado','em falta','não solicitado'].includes(proof))throw Error('invalid_candidate_data');
  const u=new URL(data.adminUrl);if(u.protocol!=='https:'||!['parceiros.guiadoproprietario.pt','engagement-test.guia-do-proprietario-parceiros.pages.dev'].includes(u.hostname)||u.port||u.username||u.password||u.pathname!=='/admin')throw Error('invalid_admin_link');
  if(!u.searchParams.get('candidatura')||u.searchParams.has('t'))throw Error('invalid_admin_session_link');
  const lines=['Nova candidatura de parceiro:','Nome: '+candidate,'Tipo: '+type,'Zonas: '+zones,'Serviços: '+required(data.services),'Comprovativo de atividade: '+proof,'Recebida a: '+required(data.receivedAt)];
  const e=renderEmailLayout({subject:'Nova candidatura: '+candidate+' ('+zones+')',preview:type+' · comprovativo '+proof,title:'Nova candidatura de parceiro',name:'',audience:'admin',paragraphs:lines,button:{label:'Analisar candidatura',url:u.toString()},signature:false});
  e.html=e.html.replace(p('Olá,'),'').replace(/<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#5B6B62">[\s\S]*?<\/p>/,'');
  e.text=e.text.replace(/^Olá,\n\n/,'').replace(/\n\nRecebe este email porque administra[\s\S]*$/,'');return e;
 }
 throw Error('unsupported_addition');
}

export function requestIdentity(r){
 for(const key of ['id','cleaningType','place','typology'])required(r?.[key]);
 if(!/^[a-z0-9-]{6,80}$/i.test(r.id)||!/^\d{4}(?:-\d{3})?$/.test(r.postalCode))throw Error('invalid_request_identifier');
 return 'Pedido '+r.id.slice(0,6).toUpperCase()+' · '+r.cleaningType+' · '+r.place+' ('+r.postalCode.slice(0,4)+') · '+r.typology;
}
export function renderEmailCopyV2Remaining(id,data){
 if(!V2_REMAINING_IDS.includes(id))throw Error('unsupported_email');
 const url=personal(data.url),r=data.request,needsRequest=['P6','P7','P8','P9','P10','P11','P12','Feedback-atual','Partilhado-outro','Pedido-termina','Cliente-sem-contactos'].includes(id);
 const identity=needsRequest?requestIdentity(r):'',short=needsRequest?r.id.slice(0,6).toUpperCase():'';
 const requestUrl=()=>{const u=personal(data.url);u.hash=id==='Pedido-termina'?'pedidos':'meus';u.searchParams.set('pedido',required(data.assignmentId||r.id));return u.toString();};
 let subject,preview,title='',content='',textContent='',button,offer=false;
 const paragraph=s=>{content+=p(esc(s).replaceAll('\n','<br>'));textContent+=(textContent?'\n\n':'')+s;};
 const block=(heading,s,opts={})=>{content+=emailCard(heading,p(esc(s).replaceAll('\n','<br>')),opts);textContent+=(textContent?'\n\n':'')+heading+'\n'+s;};
 const identify=()=>block(identity,'');
 const grid=()=>{if(!Array.isArray(data.requests))throw Error('invalid_email_data');if(data.requests.length){const c=cards(data.requests.slice(0,3),data);content+=c.html;textContent+='\n\n'+c.text;}};
 const action=(label,hash='pedidos')=>button={label,url:path(url.toString(),hash)};
 const contact=label=>button={label,url:requestUrl()};
 const right=()=>{if(data.rightGranted!==true||!['partilhado','exclusivo'].includes(data.contactType))throw Error('right_not_confirmed');};
 switch(id){
 case 'P5':
  if(data.bonusGranted!==true||!Number.isSafeInteger(data.amount)||data.amount<1500)throw Error('bonus_not_confirmed');
  subject='Tem 2 contactos grátis na sua conta';preview='São partilhados e são usados antes do seu saldo.';title='Tudo pronto.\nTem 2 contactos grátis.';
  paragraph('Recebemos o seu carregamento de '+euro(data.amount)+'. A sua conta está ativa.');
  block('🎁 Tem 2 contactos grátis.','São partilhados e são usados antes do seu saldo.\nOs contactos grátis que já tinha mantêm-se.\nSe sair nos primeiros 60 dias depois de receber esta oferta, descontamos apenas os contactos desta oferta que usou. Os contactos grátis anteriores ficam fora deste desconto.',{offer:true});
  if(data.guaranteeReady===true){block('Lembre-se','O cliente de um contacto pago não atende? Damos-lhe outro contacto. Verificamos cada caso.',{rules:true});const u=personal(data.url);u.pathname='/regras-garantia.html';u.hash='';content+=p(emailLink('Ver as regras',u.toString()));textContent+='\nVer as regras: '+u;}
  block('Dica','Os clientes submetem pedidos para encontrar um profissional de limpeza.'+(data.whatsappReady===true?' Os pedidos com “✓ Interesse confirmado pelo cliente por WhatsApp” são clientes com quem já falámos.':''));action('Ver pedidos disponíveis');break;
 case 'P6':
  if(data.contactAcquired!==true||!['partilhada','exclusiva'].includes(data.modality))throw Error('contact_not_acquired');
  subject='O contacto do pedido '+short+' ('+r.place+')';preview='Contacte na próxima hora: quem fala primeiro tem mais hipóteses.';title='Tem um novo cliente para contactar.';
  paragraph('Obteve o contacto deste pedido:');identify();
  const phone=required(data.clientPhone);if(!/^\+?[\d ()-]{9,24}$/.test(phone))throw Error('invalid_client_phone');
  paragraph(required(data.clientName)+'\n📞 '+phone+(data.clientEmail?'\n✉️ '+required(data.clientEmail):'')+'\n📍 '+required(data.clientPostalCode)+', '+r.place);
  paragraph('O pedido: '+r.cleaningType+' · '+r.typology+' · '+required(r.frequency)+' · prefere '+required(r.day)+', '+required(r.period));
  paragraph('Notas do cliente: '+(data.notes?.trim()||'O cliente não deixou notas.'));
  paragraph(data.modality==='exclusiva'?'Só você recebe este contacto através do Guia do Proprietário.':'Este contacto é partilhado: outros profissionais podem receber o mesmo cliente. Ser o primeiro a falar faz a diferença.');
  block('Como aumentar as suas hipóteses de ganhar este cliente','1. Contacte na próxima hora. Quem fala primeiro tem mais hipóteses.\n2. Diga que vem do Guia do Proprietário. O cliente reconhece e confia mais.\n3. Envie o orçamento por escrito no mesmo dia.');
  paragraph('Contacte o cliente pelos botões da sua área. Assim fica registado.'+(data.guaranteeReady===true?' Pode pedir outro contacto se o cliente não atender.':''));contact('Contactar o cliente');paragraph('Use estes dados apenas para responder a este pedido.');break;
 case 'P7':
  if(data.attempts!==0)throw Error('attempt_already_recorded');subject='Ainda não contactou o cliente do pedido '+short+'?';preview='Quem fala primeiro tem mais hipóteses.';
  paragraph('Ainda não temos nenhuma tentativa de contacto registada para este pedido:');identify();paragraph('Quem fala primeiro tem mais hipóteses. Contacte agora pelos botões da sua área.');paragraph('Já falou com o cliente? Atualize o estado na sua área.');contact('Contactar o cliente');break;
 case 'P8':subject='Já enviou o orçamento do pedido '+short+'?';preview='Faça o seguimento do seu orçamento.';paragraph('Já enviou o orçamento para este pedido?');identify();paragraph('Se ainda não teve resposta, mande uma mensagem curta. Um segundo contacto pode ajudar o cliente a decidir.');paragraph('Já falou com o cliente? Diga-nos como correu na sua área.');contact('Enviar mensagem ao cliente');break;
 case 'P9':subject='Recebemos o seu pedido de outro contacto (pedido '+short+')';preview='Vamos confirmar com o cliente e damos-lhe a resposta brevemente.';paragraph('Recebemos o seu pedido de outro contacto:');identify();paragraph('Vamos confirmar com o cliente. Damos-lhe a resposta brevemente.');break;
 case 'P10':right();subject='Pronto: já tem outro contacto (pedido '+short+')';preview='Pode usá-lo noutro pedido disponível.';paragraph('Confirmámos o que aconteceu com este pedido:');identify();paragraph('Já tem 1 contacto '+data.contactType+' para usar noutro pedido disponível. Não expira.');action('Ver pedidos disponíveis');break;
 case 'P11':
  if(data.reason!=='outro'&&(data.clientConfirmed!==true||!['contactado','contratacao_posterior'].includes(data.reason)))throw Error('client_response_not_confirmed');
  subject='Sobre o seu pedido de outro contacto (pedido '+short+')';preview=data.reason==='outro'?'Veja o resultado da análise do seu pedido.':'Falámos com o cliente deste pedido.';paragraph(data.reason==='outro'?'Analisámos o seu pedido de outro contacto:':'Falámos com o cliente deste pedido:');identify();paragraph(data.reason==='outro'?required(data.reasonText):data.reason==='contactado'?'O cliente disse-nos que foi contactado(a).':'O cliente disse-nos que ainda não tinha contratado ninguém quando comprou o seu contacto.');paragraph('Por isso, desta vez não podemos dar outro contacto.');paragraph('Se achar que há um engano, responda a este email e vemos o seu caso.');break;
 case 'P12':
  if(data.clientConfirmed!==true)throw Error('hire_not_confirmed');subject='Parabéns! O cliente do pedido '+short+' contratou-o';preview='O cliente confirmou que contratou os seus serviços.';title='Parabéns! 🎉';paragraph('O cliente deste pedido disse-nos que contratou os seus serviços:');identify();paragraph(data.availableRequests>0?'Continue assim. Há mais pedidos à sua espera.':'Continue assim.');action('Ver pedidos disponíveis');paragraph('Gostou da experiência? Responda a este email com uma frase sobre como correu. Com a sua autorização, podemos partilhá-la com outros profissionais.');break;
 case 'Sem-acesso':subject=data.requests?.length?'Há pedidos à sua espera em '+[...new Set(data.requests.map(r=>r.place))].join(', '):'A sua área de parceiro já está pronta';preview='A sua área de parceiro já está pronta.';paragraph('A sua área de parceiro está pronta, mas ainda não entrou.');if(data.requests?.length)paragraph('Estes pedidos estão à espera de um profissional na sua zona:');grid();if(data.freeContacts>0)paragraph('Tem '+data.freeContacts+' contactos grátis para começar.');paragraph('Teve alguma dificuldade a entrar? Responda a este email e ajudamos.');action('Ver os pedidos da minha zona');break;
 case 'Gratis-por-usar':
  if(!Number.isSafeInteger(data.freeContacts)||data.freeContacts<=0||!data.requests?.length||!Number.isSafeInteger(data.total)||data.total<data.requests.length)throw Error('no_free_offer');
  subject=data.total+' pedidos de limpeza na sua zona e '+data.freeContacts+' contactos grátis por usar';preview='Fale com clientes reais sem gastar nada.';paragraph('Ainda tem '+data.freeContacts+' contactos grátis na sua conta.');paragraph('Estes pedidos estão disponíveis na sua zona:');grid();block('É simples','1. Vê o pedido completo.\n2. Obtém o contacto dos que lhe interessam.\n3. Liga ao cliente.');action('Usar os meus contactos grátis');offer=true;break;
 case 'Feedback-atual':subject='Como correu com o cliente do pedido '+short+'?';preview='Leva 10 segundos.';paragraph('Já conseguiu falar com o cliente deste pedido?');identify();paragraph('Diga-nos como correu. Leva 10 segundos, e ajuda-nos a enviar-lhe os pedidos certos.');contact('Dizer como correu');break;
 case 'Gratis-esgotados':case 'Carregamentos-pausados':
  subject='Já usou os contactos grátis iniciais';preview=id==='Gratis-esgotados'?'Continue a receber clientes a partir de '+euro(data.prices?.partilhada)+'.':'O seu saldo e os contactos grátis por usar mantêm-se.';paragraph('Já usou os contactos grátis iniciais. O seu saldo e outros contactos grátis que tenha mantêm-se.');
  if(id==='Carregamentos-pausados'){
   if(data.zoneBlocked!==true)throw Error('zone_not_blocked');paragraph('De momento há poucos pedidos na sua zona. Por isso, ainda não é possível carregar saldo.');paragraph('Avisamos por email quando houver novos pedidos na sua zona.');
  }else{block('Escolha como obter o contacto','Partilhado: '+euro(data.prices?.partilhada)+'. Até 3 profissionais podem receber o mesmo contacto.\nExclusivo: '+euro(data.prices?.exclusiva)+'. Só você recebe este contacto através do Guia do Proprietário.');paragraph('Sem mensalidade. Só paga quando obtém um contacto.');}action('Ver o meu saldo','saldo');break;
 case 'Partilhado-outro':subject='Há mais alguém no pedido '+short+' ('+r.place+')';preview='Outro profissional obteve o mesmo contacto.';paragraph('Outro profissional também obteve o contacto deste pedido:');identify();paragraph('O cliente pode comparar propostas. Se ainda não falou com ele, este é o momento.');paragraph('Dica: se o cliente não atender, envie logo uma mensagem por WhatsApp a dizer que vem do Guia do Proprietário.');contact('Contactar o cliente');break;
 case 'Pedidos-terminam':{
  if(!Array.isArray(data.requests)||!data.requests.length||!Number.isSafeInteger(data.total)||data.total!==data.requests.length||data.requests.some(r=>r.obtained!==0||!Number.isSafeInteger(r.daysRemaining)||r.daysRemaining<=0))throw Error('invalid_expiry_digest');
  subject=data.total===1?'1 pedido ainda sem contacto obtido na sua zona':data.total+' pedidos ainda sem contacto obtido nas suas zonas';preview='Veja os pedidos disponíveis antes de terminarem.';title='Estes pedidos ainda estão disponíveis';
  paragraph('Ainda ninguém obteve o contacto destes pedidos nas suas zonas:');
  for(const r of data.requests){const c=cards([r],data);content+=c.html;textContent+='\n\n'+c.text;paragraph('Pedido '+r.id.slice(0,6).toUpperCase()+': termina dentro de '+r.daysRemaining+' '+(r.daysRemaining===1?'dia.':'dias.'));}
  paragraph('Pode escolher partilhado ou exclusivo. Só você recebe o contacto exclusivo através do Guia do Proprietário.');action('Ver pedidos disponíveis');break;
 }
 case 'Pedido-termina':
  if(r.obtained!==0||!Number.isSafeInteger(data.daysRemaining)||data.daysRemaining<=0)throw Error('invalid_expiring_request');subject='Ainda ninguém obteve o contacto do pedido '+short+' ('+r.place+')';preview='Pode ficar com ele em exclusivo. Faltam '+data.daysRemaining+' dias.';paragraph('Ainda ninguém obteve o contacto deste pedido:');const c=cards([r],data);content+=c.html;textContent+='\n\n'+c.text;paragraph('Pode escolher o exclusivo. Só você recebe este contacto através do Guia do Proprietário.');paragraph('O pedido termina dentro de '+data.daysRemaining+' dias.');contact('Ver pedido');break;
 case 'Cliente-sem-contactos':right();subject='O cliente do pedido '+short+' pediu para não ser contactado(a)';preview='Já tem outro contacto para usar noutro pedido.';paragraph('O cliente deste pedido pediu para não receber mais contactos:');identify();paragraph('Por favor, não volte a contactá-lo(a) sobre este pedido.');paragraph('Já tem 1 contacto '+data.contactType+' para usar noutro pedido disponível.');paragraph('Se já tinha combinado um serviço com este cliente, esse serviço não é afetado.');action('Ver pedidos disponíveis');break;
 case 'Z1':
  if(data.zoneUnlocked!==true||!data.requests?.length)throw Error('zone_not_unlocked');subject='Já há pedidos na sua zona';preview='Já pode carregar saldo e obter contactos.';title='Já há pedidos na sua zona.';paragraph('Entraram novos pedidos de limpeza nas suas zonas. Já pode carregar saldo e obter contactos.');grid();action('Ver os pedidos da minha zona');break;
 }
 const e=renderEmailLayout({subject,preview,title,name:data.name,content,textContent,button,offer});e.html=e.html.replace('</style>','@media only screen and (max-width:480px){.request-column{display:block!important;width:100%!important;padding:0 0 24px!important;box-sizing:border-box}.request-empty{display:none!important}}</style>');return e;
}

export function renderEmailCopyV2(id,data){
 const e=renderEmailCopyV2Core(id,data);if(!['P1','P4','P5'].includes(id))return e;
 let html='',text='';if(['P4','P5'].includes(id)){const url=path(data.url,'dicas');html+=p(emailLink('Veja as dicas para conquistar clientes',url));text+='Veja as dicas para conquistar clientes: '+url+'\n\n';}
 const t=data.testimonial;if(t&&typeof t.texto==='string'&&typeof t.nome==='string'&&typeof t.zona==='string'){html+=emailCard('A experiência de quem já usa o Guia',p('“'+esc(t.texto)+'”')+p('<strong>'+esc(t.nome)+'</strong> · '+esc(t.tipo||'empresa')+' · '+esc(t.zona)));text+='A experiência de quem já usa o Guia\n“'+t.texto+'”\n'+t.nome+' · '+(t.tipo||'empresa')+' · '+t.zona+'\n\n';}
 if(html){e.html=e.html.replace('<p style="margin:20px 0 0;',html+'<p style="margin:20px 0 0;');e.text=e.text.replace('Recebe este email porque é parceiro',text+'Recebe este email porque é parceiro');}return e;
}
