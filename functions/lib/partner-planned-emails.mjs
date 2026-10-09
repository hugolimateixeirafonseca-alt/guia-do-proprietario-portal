import {renderEmailLayout,emailParagraph,emailCard,emailButton,emailLink,escapeEmailHtml as esc} from './partner-email-layout.mjs';
export const FUTURE_EMAIL_IDS=['P4','P5','P7','P8','P9','P10','P11','P12','C2','C3','C4','C5','C6'];
export const RETIRED_EMAIL_IDS=['P2','P3'];
function required(value){if(typeof value!=='string'||!value.trim()||/^(undefined|null|\{.*\})$/i.test(value.trim()))throw Error('missing_email_data');return value.trim();}
function access(value,hash){const u=new URL(value);if(u.protocol!=='https:'||!['parceiros.guiadoproprietario.pt','engagement-test.guia-do-proprietario-parceiros.pages.dev'].includes(u.hostname)||u.port||u.username||u.password||!u.searchParams.get('t'))throw Error('invalid_personal_link');if(hash)u.hash=hash;return u.toString();}
function response(value){const u=new URL(value);if(u.protocol!=='https:'||!['parceiros.guiadoproprietario.pt','engagement-test.guia-do-proprietario-parceiros.pages.dev'].includes(u.hostname)||u.pathname!=='/pedido-resposta.html'||u.username||u.password||u.port||!u.searchParams.get('t'))throw Error('invalid_response_link');return u.toString();}
const steps='1. Vê o pedido completo: tipo de limpeza, casa, frequência e dias.\n2. Obtém o contacto dos pedidos que lhe interessam.\n3. Fala diretamente com o cliente e apresenta o seu orçamento.';
const money=n=>{if(!Number.isSafeInteger(n)||n<1500)throw Error('invalid_topup_amount');return (n/100).toFixed(2).replace('.',',')+' €';};
/** Content only. No scheduling or sending is enabled by this renderer. */
export function renderPlannedPartnerEmail(id,data){
 if(RETIRED_EMAIL_IDS.includes(id)||!FUTURE_EMAIL_IDS.includes(id))throw Error('email_not_in_plan');
 const client=id.startsWith('C'),paragraphs=[],secondary=[];let subject,preview,title='',button,content='',textContent='',offer=false;
 const place=id==='P4'||id==='P5'?'':required(data.place);
 const add=(heading,body,opts={})=>{content+=emailCard(heading,body.split('\n').map(line=>emailParagraph(esc(line))).join(''),opts);textContent+=(textContent?'\n\n':'')+heading+'\n'+body;};
 const dashboard=client?null:access(data.url);
 switch(id){
 case 'P4':{
  if(!['novo','anterior'].includes(data.model))throw Error('invalid_partner_model');subject='A sua conta foi aprovada';title='Bem-vindo(a).\nA sua conta está aprovada.';
  paragraphs.push('Já pode ver os pedidos de limpeza da sua zona.');
  if(data.model==='novo'&&data.firstTopupDone===true){
   return renderEmailLayout({subject,preview:'A sua área de parceiro está pronta.',title,name:data.name,paragraphs:['A sua conta foi aprovada e o primeiro carregamento já está registado. Consulte o saldo e os contactos disponíveis na sua área.'],button:{label:'Ver pedidos disponíveis',url:access(data.url,'pedidos')}});
  }
  if(data.model==='novo'){
   preview='Carregue 15 € e receba 2 contactos grátis para começar.';paragraphs.push('Para obter contactos, falta só um passo: carregar saldo.');offer=true;
   add('🎁 Carregue 15 €. Receba 2 contactos grátis.','Os contactos grátis são partilhados.\nOs 15 € ficam no seu saldo para os contactos seguintes.\nE se eu quiser sair? Devolvemos o dinheiro que não gastou. Se sair nos primeiros 60 dias, descontamos os contactos grátis que usou.',{offer:true});button={label:'Carregar 15 € e receber 2 contactos grátis',url:access(data.url,'saldo')};
  }else{
   preview='A sua área de parceiro está pronta.';
   if(!Number.isSafeInteger(data.freeContacts)||data.freeContacts<0)throw Error('invalid_free_count');
   if(data.freeContacts){offer=true;add('🎁 Tem '+data.freeContacts+' contactos grátis','Os contactos grátis anteriores continuam a poder ser usados como antes. A opção exclusiva depende da disponibilidade do pedido.',{offer:true});}
   button={label:'Entrar na minha área de parceiro',url:dashboard};
  }
  add('Como funciona',steps);if(data.guaranteeReady===true)add('O cliente não atende? Damos-lhe outro contacto.','Tente 3 vezes, em 2 dias úteis diferentes, pelos botões da plataforma. Depois, carregue em Pedir outro contacto. Verificamos cada caso. Só para contactos pagos.\nVer as regras: '+access(data.url).replace('/?','/regras-garantia.html?').split('#')[0],{rules:true});paragraphs.push('Guarde este email para voltar a entrar. Esta ligação é pessoal: não a partilhe.');secondary.push({label:'Ver os pedidos da minha zona',url:access(data.url,'pedidos')});break;
 }
 case 'P5':{
  if(data.bonusGranted!==true||!['novo','anterior'].includes(data.model))throw Error('bonus_not_confirmed');
  if(!Number.isSafeInteger(data.freeContacts)||data.freeContacts<0)throw Error('invalid_free_count');
  subject='Recebemos o seu carregamento de '+money(data.amount);preview='O seu carregamento foi confirmado.';title='Carregamento confirmado.';
  paragraphs.push('Recebemos o seu carregamento de '+money(data.amount)+'.'+(data.model==='novo'?' A sua conta está ativa.':''));
  if(data.freeContacts>0){offer=true;add('🎁 Tem '+data.freeContacts+(data.freeContacts===1?' contacto grátis disponível.':' contactos grátis disponíveis.'),'Os contactos grátis são usados antes do saldo quando escolhe o tipo de contacto correspondente.',{offer:true});}
  if(data.guaranteeReady===true)add('Lembre-se','Se houver um problema real num contacto pago, pode pedir outro contacto. Verificamos cada caso.\nVer as regras: '+access(data.url).replace('/?','/regras-garantia.html?').split('#')[0],{rules:true});
  if(data.confirmedRequestsReady===true)add('Dica','Procure os pedidos com esta etiqueta:\n✓ Interesse confirmado pelo cliente\nSão clientes com quem já falámos e que estão à espera do seu contacto.');
  button={label:'Ver pedidos disponíveis',url:access(data.url,'pedidos')};break;
 }
 case 'P7':subject='O contacto do cliente de '+place+' está à sua espera';preview='Ainda não temos uma tentativa registada na plataforma.';paragraphs.push('Ainda não temos uma tentativa de contacto registada na plataforma para o cliente de '+place+'.','Se ainda não falou com o cliente, contacte agora. Se já falou, atualize o estado na sua área.');button={label:'Contactar o cliente',url:access(data.url,'meus')};break;
 case 'P8':subject='Já enviou o orçamento ao cliente de '+place+'?';preview='Faça o seguimento e diga-nos como correu.';paragraphs.push('Já enviou o orçamento ao cliente de '+place+'?','Se ainda não teve resposta, mande uma mensagem curta.','Já falou com o cliente? Diga-nos como correu na plataforma.');button={label:'Enviar mensagem ao cliente',url:access(data.url,'meus')};break;
 case 'P9':subject='Recebemos o seu pedido de outro contacto';preview='Vamos confirmar com o cliente. Damos-lhe a resposta brevemente.';paragraphs.push('Recebemos o seu pedido de outro contacto, sobre o cliente de '+place+'.','Vamos confirmar com o cliente. Damos-lhe a resposta brevemente.');break;
 case 'P10':{
  if(data.rightGranted!==true||!['partilhado','exclusivo'].includes(data.contactType))throw Error('right_not_confirmed');subject='Pronto: já tem outro contacto';preview='Pode usá-lo num pedido disponível do mesmo tipo.';
  paragraphs.push('Confirmámos o que aconteceu com o cliente de '+place+'.');add('Já tem 1 contacto '+data.contactType+' para usar','Pode usá-lo noutro pedido disponível do mesmo tipo. Não expira.',{rules:true});button={label:'Ver pedidos disponíveis',url:access(data.url,'pedidos')};break;
 }
 case 'P11':subject='Sobre o seu pedido de outro contacto';preview='Veja o resultado da análise do cliente de '+place+'.';
  if(!['contactado','contratacao_posterior','outro'].includes(data.reason))throw Error('invalid_refusal_reason');
  if(data.reason!=='outro'&&data.clientConfirmed!==true)throw Error('client_response_not_confirmed');
  paragraphs.push(data.reason==='contactado'?'Falámos com o cliente de '+place+'. O cliente disse-nos que foi contactado(a).':data.reason==='contratacao_posterior'?'Falámos com o cliente de '+place+'. O cliente disse-nos que ainda não tinha contratado ninguém quando comprou este contacto.':required(data.reasonText),'Por isso, desta vez não podemos dar outro contacto.','Se achar que há um engano, responda a este email e vemos o seu caso.');break;
 case 'P12':if(data.clientConfirmed!==true)throw Error('hire_not_confirmed');subject='Parabéns! O cliente de '+place+' contratou-o';preview='O cliente confirmou que contratou os seus serviços.';title='Parabéns! 🎉';paragraphs.push('O cliente do pedido de '+place+' disse-nos que contratou os seus serviços.','Gostou da experiência? Responda a este email com uma frase sobre como correu. Com a sua autorização, podemos partilhá-la com outros profissionais.');button={label:'Ver pedidos disponíveis',url:access(data.url,'pedidos')};break;
 case 'C2':case 'C3':{
  if(!Array.isArray(data.professionals)||!data.professionals.length||data.professionals.length>3)throw Error('invalid_professionals');
  subject=id==='C2'?'Como correu o seu pedido de limpeza?':'Só uma pergunta sobre a sua limpeza';preview='Já contratou alguém?';
  paragraphs.push(id==='C2'?'Há uns dias fez um pedido de limpeza em '+place+'.':'Ainda não sabemos como correu. Já contratou alguém para a limpeza em '+place+'?');
  if(id==='C2')add('Estes profissionais receberam o seu pedido',data.professionals.map(p=>required(p.name)).join('\n'));
  textContent+='\n\nJá contratou alguém?';content+=emailParagraph('<strong>Já contratou alguém?</strong>');
  for(const p of data.professionals){const label='Sim, contratei '+required(p.name),url=response(p.url);content+=emailButton(label,url,{outline:true});textContent+='\n'+label+': '+url;}
  for(const [key,label] of [['other','Contratei outra pessoa'],['notYet','Ainda não contratei'],['noNeed','Já não preciso']]){const url=response(data.responses?.[key]);content+=emailButton(label,url,{outline:true});textContent+='\n'+label+': '+url;}break;
 }
 case 'C4':subject='Falou com '+required(data.professional)+'?';preview='Uma pergunta rápida sobre a sua limpeza.';paragraphs.push(data.professional+' também recebeu o seu pedido de limpeza em '+place+'. Contratou este profissional?');break;
 case 'C5':subject='Uma pergunta rápida sobre o seu pedido de limpeza';preview='Confirme o contacto deste profissional.';paragraphs.push('Sobre o seu pedido de limpeza em '+place+': '+(data.specificProfessional===false?'algum profissional já falou consigo?':required(data.professional)+' já falou consigo?'));break;
 case 'C6':subject='Uma pergunta rápida sobre o seu pedido de limpeza';preview='Ajude-nos a confirmar quando contratou o serviço.';paragraphs.push('Sobre o seu pedido de limpeza em '+place+': antes de '+required(data.professional)+' obter o seu contacto através do Guia, já tinha contratado alguém?');break;
 }
 if(['C4','C5','C6'].includes(id))for(const [key,label] of [['yes',id==='C4'?'Sim, contratei '+data.professional:'Sim'],['no','Não']]){const url=response(data.responses?.[key]);content+=emailButton(label,url,{outline:true});textContent+='\n'+label+': '+url;}
 if(client){paragraphs.push('A resposta só fica registada quando confirmar na página que abre.');offer=false;}
 return renderEmailLayout({subject,preview,title,name:data.name,audience:client?'client':'partner',paragraphs,content,textContent,button,secondary,offer,signature:!client});
}
