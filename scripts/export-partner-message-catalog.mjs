// Offline snapshots of the real senders. All fetches are mocked, never send email.
import fs from 'node:fs';
import {renderPartnerEngagementEmail} from '../functions/lib/partner-engagement-email.mjs';
import {onRequestPost} from '../functions/api/make/partner-lead-notification.ts';
import {deliveryFixture} from '../tests/partner-email-fixture.mjs';
const destination=process.argv[2];if(!destination)throw Error('output path required');
const url='https://parceiros.guiadoproprietario.pt/?t=EXEMPLO_SEM_ACESSO';
const base={partner_name:'Empresa de exemplo',dashboard_url:url};
const specs=[
 ['contact_accepted','Contacto aceite','Imediatamente após aceitar, gratuito ou pago.',{municipality:'Lisboa',client_name:'Cliente de exemplo',client_phone:'912000000',client_email:'cliente@example.invalid',postal_code:'1000-000',cleaning_type:'regular',space_type:'apartamento',size:'t2',frequency:'semanal',days:['seg'],periods:['manha'],notes:'Exemplo de notas do cliente.',modality:'partilhada'}],
 ['shared_contact_acquired','Outro profissional recebeu o contacto','Quando outro profissional adquire o mesmo contacto sem exclusividade.',{municipality:'Lisboa',client_phone:'912000000'}],
 ['approved_no_login','Aprovado, mas ainda não entrou','Uma vez, 48 horas após aprovação. Só novas aprovações com medição de acesso; exclui visitas da gestão.',{active_requests:2,free_contacts:4,localities:'Lisboa'}],
 ['unused_free_contacts','Gratuitos por usar','3 dias após inscrição, com gratuitos e pedidos compatíveis disponíveis.',{active_requests:2,free_contacts:4,localities:'Lisboa'}],
 ['first_contact_feedback','Como correu o primeiro contacto','48 horas após o primeiro contacto aceite, sem feedback.',{municipality:'Lisboa'}],
 ['free_contacts_exhausted','Usou os quatro gratuitos','Após usar o quarto contacto inicial gratuito.',{}],
 ['lead_expiring','Pedido a expirar','A 5 dias do fim, sem compradores anteriores e compatível com o parceiro.',{municipality:'Lisboa',days_remaining:5}],
 ['inactive_buyer','Cinco dias sem comprar','Após compra paga, 5 dias sem outra compra paga, com oportunidades perdidas e pedidos disponíveis.',{missed_requests:3}]
];
const items=specs.map(([id,name,when,data])=>({id,name,when,channel:'Email',provider:'Sender / Make',active:true,variants:[{label:'Exemplo',...renderPartnerEngagementEmail({...base,event_type:id,data})}]}));
items.find(x=>x.id==='approved_no_login').variants.push({label:'Sem pedidos ativos',...renderPartnerEngagementEmail({...base,event_type:'approved_no_login',data:{active_requests:0,free_contacts:4,localities:''}})});
items[0].variants.push({label:'Contacto exclusivo',...renderPartnerEngagementEmail({...base,event_type:'contact_accepted',data:{...specs[0][3],modality:'exclusiva'}})});
const original=globalThis.fetch;
try{
 for(const [id,name,when] of [['application','Inscrição recebida','Após submeter a adesão.'],['application-admin','Nova adesão para aprovação','Alerta à gestão após nova adesão.'],['welcome','Parceiro aprovado','Após aprovação manual.'],['offer','Novo pedido compatível','Quando é disponibilizado um pedido compatível.']]){
  const f=deliveryFixture();let sent;
  globalThis.fetch=async(url,init)=>{if(String(url).endsWith('/api/partner-email-policy'))return Response.json({ok:true,allowed:true});if(String(url).endsWith('/api/partner-sender-sync'))return Response.json({ok:true,jobs:[]});if(String(url)==='https://api.sender.net/v2/message/send'){sent=JSON.parse(init.body);return Response.json({ok:true});}throw Error('Unexpected mocked destination');};
  try{
   const body={...base,event_id:(id==='offer'?'':id+':')+'00000000-0000-4000-8000-000000000001',partner_email:id==='application-admin'?'hugo.lima.teixeira.fonseca@gmail.com':'empresa@example.invalid',lead_title:'Limpeza regular',municipality:'Lisboa',lead_summary:id==='application-admin'?'Empresa de exemplo apresentou uma candidatura.':'Apartamento T2 · Semanal',expires_at:null};
   const response=await onRequestPost({request:new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer example','Content-Type':'application/json'},body:JSON.stringify(body)}),env:{EMAIL_DELIVERY_DB:f.binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:'example',SENDER_API_TOKEN:'example',CLEANING_DASHBOARD_API_TOKEN:'example'},waitUntil:()=>{}});
   if(response.status!==200||!sent)throw Error('catalog render failed: '+id);
   items.push({id,name,when,channel:'Email',provider:'Sender / Make',active:true,variants:[{label:'Exemplo',subject:sent.subject,text:sent.text}]});
  }finally{f.db.close();}
 }
}finally{globalThis.fetch=original;}
items.push({id:'receipt',name:'Recibo de carregamento',when:'Após pagamento confirmado, conforme configuração e bloqueio de comunicações.',channel:'Email',provider:'Stripe',active:true,variants:[{label:'Modelo gerido pela Stripe',subject:'Recibo de pagamento',text:'O recibo é gerado pela Stripe com os dados reais do pagamento. O conteúdo integral desse modelo é consultado na Stripe; não é um modelo editável desta plataforma.'}]});
items.push({id:'whatsapp',name:'WhatsApp e SMS automáticos',when:'Não configurados. Os botões de contacto não enviam mensagens automaticamente.',channel:'WhatsApp / SMS',provider:'Nenhum',active:false,variants:[]});
fs.writeFileSync(destination,JSON.stringify({note:'Catálogo de regras e exemplos fictícios, não um histórico de entregas. Os valores e ligações reais são preenchidos no envio. Bloqueios de email e elegibilidade são respeitados.',items},null,2)+'\n');
