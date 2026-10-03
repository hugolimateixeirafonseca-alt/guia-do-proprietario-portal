import {renderEmailCopyV2} from './partner-email-copy-v2.mjs';
import {renderEmailLayout,emailCard,emailParagraph,escapeEmailHtml as esc} from './partner-email-layout.mjs';
import {renderPartnerNewsEmail,NEWS_VERSION} from './partner-news-email.mjs';
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const clean = (value, max = 120) => typeof value === 'string' && !/^(?:null|undefined|nan|\{[^{}]+\})$/i.test(value.trim()) ? value.trim().replace(/[\r\n]+/g, ' ').slice(0, max) : '';
const positive = value => Number.isSafeInteger(value) && value > 0;
const labels={regular:'Limpeza regular',profunda:'Limpeza profunda','pos-obra':'Limpeza pós-obra',mudanca:'Limpeza de mudança',empresa:'Limpeza de empresa',outra:'Outra limpeza',apartamento:'Apartamento',moradia:'Moradia',escritorio:'Escritório',loja:'Loja','alojamento-local':'Alojamento local',outro:'Outro espaço','t0-t1':'T0 / T1',t2:'T2',t3:'T3','t4-mais':'T4 ou maior',pequeno:'pequeno',medio:'médio',grande:'grande','nao-sei':'por definir','uma-vez':'uma vez',semanal:'semanal',quinzenal:'quinzenal',mensal:'mensal',seg:'segunda-feira',ter:'terça-feira',qua:'quarta-feira',qui:'quinta-feira',sex:'sexta-feira',sab:'sábado',dom:'domingo',flexivel:'dia flexível',manha:'manhã',tarde:'tarde',indiferente:'horário indiferente'};
function preferences(value,fallback) {
  let values=value;
  if(typeof value==='string') {try{values=JSON.parse(value);}catch{values=[value];}}
  if(!Array.isArray(values))return fallback;
  return [...new Set(values.map(v=>labels[v]).filter(Boolean))].join(', ')||fallback;
}

export function renderPartnerEngagementEmail(payload, options = {}) {
  const data = payload.data || {};
  if(data.kind==='video_tutorial')throw Error('retired_video_email');
  if(data.copyVersion==='v2')return renderV2Engagement(payload);
  if(payload.event_type==='client_interest')return renderClientInterestEmail(data,options);
  if(payload.event_type==='contact_accepted' && data.audience==='client')return renderClientContactEmail(data,options);
  const place = clean(data.municipality);
  const url = new URL(payload.dashboard_url);
  const host = options.preview === true ? 'engagement-test.guia-do-proprietario-parceiros.pages.dev' : 'parceiros.guiadoproprietario.pt';
  if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password || !url.searchParams.get('t')) throw new Error('invalid_dashboard_url');
  if(data.kind===NEWS_VERSION){
    if(payload.event_type!=='unused_free_contacts'||!/^engagement:commercial_news:v1:[a-z0-9-]+$/i.test(payload.event_id))throw Error('invalid_event_data');
    return renderPartnerNewsEmail({prices:data.prices,name:clean(payload.partner_name),url:url.toString()});
  }
  let subject, preview, paragraphs, button, offer=false, action = url.toString();
  switch (payload.event_type) {
    case 'request_digest': {
      if (!positive(data.active_requests) || !Array.isArray(data.requests) || !data.requests.length || data.requests.length>3 || data.requests.length>data.active_requests || data.requests.some(item=>!clean(item.municipality)||!clean(item.title))) throw new Error('invalid_event_data');
      subject=data.active_requests===1?'Tem um novo pedido de limpeza na sua zona':data.active_requests+' novos pedidos de limpeza nas suas zonas';
      preview='Veja os pedidos disponíveis e escolha os que quer aceitar.';
      paragraphs=[
        data.active_requests===1?'Há um novo pedido compatível com o seu perfil, ainda disponível.':'Há '+data.active_requests+' novos pedidos compatíveis com o seu perfil, ainda disponíveis.',
        ...data.requests.map(item=>clean(item.municipality)+' · '+clean(item.title)),
        ...(data.active_requests>data.requests.length?['Estes são três dos novos pedidos. Consulte todos na sua área de parceiro.']:[]),
        'Os pedidos podem ser aceites por outros profissionais. Veja a disponibilidade atual antes de escolher.',
        'Pode escolher um ou dois resumos por dia, ou desligar estes avisos, em O meu perfil. As confirmações dos contactos que aceitar continuam imediatas.'
      ];
      button='Ver todos os pedidos disponíveis';
      break;
    }
    case 'approved_no_login': {
      if(!Number.isSafeInteger(data.active_requests)||data.active_requests<0||data.free_contacts!==4||(data.active_requests>0&&!clean(data.localities,500)))throw new Error('invalid_event_data');
      subject=data.active_requests>0?`Tem pedidos à sua espera em ${clean(data.localities,500)}`:'A sua área de parceiro já está pronta';
      preview='O seu acesso está ativo e tem 4 contactos grátis.';offer=true;
      paragraphs=[
        'A sua conta de parceiro no Guia do Proprietário está ativa, mas ainda não entrou.',
        data.active_requests>0?`Neste momento há ${data.active_requests} ${data.active_requests===1?'pedido nas suas zonas à espera':'pedidos nas suas zonas à espera'} de um profissional de limpeza.`:'Os novos pedidos aparecem logo na sua área. Recebe os resumos por email na frequência escolhida no perfil.',
        'Os seus 4 primeiros contactos são grátis. Funciona assim:\n1. Vê o pedido completo: tipo de limpeza, casa, frequência e dias.\n2. Aceita só os que lhe interessam.\n3. Recebe o contacto e fala diretamente com o cliente.',
        'Se teve alguma dificuldade a entrar, responda a este email e ajudamos.'
      ];
      button='Entrar na minha área';
      break;
    }
    case 'contact_accepted': {
      if(data.kind==='client_stop'){
        if(!place || data.free_contacts!==1 || !['partilhada','exclusiva'].includes(data.modality))throw new Error('invalid_event_data');
        subject=`O cliente de ${place} pediu para não receber mais contactos`;
        preview='Atribuímos-lhe 1 contacto grátis para outro pedido.';
        paragraphs=[`O cliente do pedido de ${place} confirmou que não pretende receber mais contactos. Não volte a contactá-lo sobre este pedido.`,
          `Atribuímos-lhe 1 contacto grátis ${data.modality==='exclusiva'?'exclusivo':'sem exclusividade'}, do mesmo tipo do contacto adquirido. Já está disponível na sua conta para usar noutro pedido.`,
          'O pedido foi retirado da venda. Esta indicação não cancela um serviço que já tenha combinado com o cliente.'];
        button='Ver a minha área de parceiro';
        break;
      }
      const name=clean(data.client_name),phone=clean(data.client_phone,24).replace(/[\s()-]/g,'');
      if(!place||!name||!/^\+?[0-9]{9,15}$/.test(phone)||!['partilhada','exclusiva'].includes(data.modality)||!labels[data.cleaning_type]||!labels[data.space_type]||!labels[data.size]||!labels[data.frequency])throw new Error('invalid_event_data');
      const email=clean(data.client_email,254),postal=clean(data.postal_code,20);
      const emailLine=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?`\n✉️ ${email}`:'';
      const notes=clean(data.notes,5000)||'O cliente não deixou notas.';
      subject=`Os contactos do cliente de ${place}`;
      preview='Contacte o cliente e apresente o seu orçamento.';
      paragraphs=[
        `Aceitou o pedido de ${place}. Aqui estão os dados do cliente:`,
        `${name}\n📞 ${phone}${emailLine}\n📍 ${postal?postal+', ':''}${place}`,
        `O pedido: ${labels[data.cleaning_type]} · ${labels[data.space_type]}, ${labels[data.size]} · ${labels[data.frequency]} · prefere ${preferences(data.days,'dia não indicado')}, ${preferences(data.periods,'horário não indicado')}`,
        `Notas do cliente: ${notes}`,
        data.modality==='partilhada'?'Este é um contacto partilhado: outros profissionais podem receber os mesmos dados. Ser o primeiro a ligar faz a diferença.':'Este contacto é exclusivo: só você recebeu estes dados através do Guia do Proprietário enquanto a exclusividade estiver ativa.',
        'Como fazer o primeiro contacto:\n1. Ligue hoje, de preferência na próxima hora. Os nossos termos pedem o primeiro contacto nas 24 horas seguintes à aceitação.\n2. Se não atender, envie logo uma mensagem por WhatsApp a dizer que vem do pedido feito no Guia do Proprietário.\n3. Envie o orçamento por escrito, de preferência no mesmo dia em que falar com o cliente.',
        'Depois de falar com o cliente, atualize o estado do pedido na sua área de parceiro. Leva 10 segundos.',
        'Use estes dados apenas para responder a este pedido.'
      ];
      button='Abrir a minha área de parceiro';
      break;
    }
    case 'shared_contact_acquired': {
      const phone = clean(data.client_phone, 24).replace(/[\s()-]/g, '');
      if (!place || !/^\+?[0-9]{9,15}$/.test(phone)) throw new Error('invalid_event_data');
      subject = `Há mais alguém no pedido de ${place}`;
      preview = 'Outro profissional recebeu o mesmo contacto.';
      paragraphs = [
        `Outro profissional de limpeza recebeu também o contacto do cliente de ${place}.`,
        'O cliente pode comparar propostas. Contacte-o para esclarecer o pedido e apresentar o seu orçamento.',
        'Se ainda não ligou, este é o momento.',
        'Dica: se o cliente não atender, envie logo uma mensagem por WhatsApp a dizer que vem do pedido feito no Guia do Proprietário. Assim reconhece quem está a ligar e é mais provável que responda.'
      ];
      button = 'Abrir a minha área de parceiro';
      break;
    }
    case 'unused_free_contacts': {
      if(data.kind==='video_tutorial'){
        if(!/^engagement:video_tutorial:20260929:[a-z0-9_-]+$/i.test(payload.event_id)||url.hash!=='#video')throw new Error('invalid_video_event');
        subject='Como funciona a plataforma? Veja este vídeo';
        preview='Em menos de 2 minutos: contactos, orçamento e pagamento do serviço.';
        paragraphs=['Preparámos um vídeo curto para esclarecer as dúvidas mais comuns sobre a plataforma.','Veja como obter um contacto, falar com o cliente e apresentar o seu orçamento. É você quem define o preço e combina o pagamento diretamente com o cliente.','Na plataforma, obtém o contacto. O serviço fica combinado quando o cliente aceita a sua proposta.','O vídeo também mostra como adicionar a plataforma ao telemóvel.','Se ficar com alguma dúvida, responda a este email.'];
        button='Ver o vídeo explicativo';break;
      }
      if (!positive(data.active_requests) || !positive(data.free_contacts) || !clean(data.localities, 500)) throw new Error('invalid_event_data');
      const localities = clean(data.localities, 500);
      subject = `${data.active_requests} pedidos de limpeza em ${localities}, e ${data.free_contacts} contactos por nossa conta`;
      preview = 'Fale com clientes reais sem gastar nada.';
      paragraphs = [
        `Há neste momento ${data.active_requests} pedidos ativos nas suas zonas: ${localities}.`,
        `E ainda tem ${data.free_contacts} contactos grátis na sua conta. Ou seja, pode falar com clientes que pediram mesmo uma limpeza e apresentar-lhes a sua proposta sem pagar nada.`,
        'É simples:\n1. Vê o pedido completo: tipo de limpeza, casa, frequência e dias preferidos.\n2. Aceita só os que lhe interessam.\n3. Recebe o contacto e liga ao cliente.',
        'Os pedidos não ficam à espera. Quando outros profissionais os aceitam, as vagas esgotam.'
      ];
      button = 'Usar os meus contactos grátis';offer=true;
      break;
    }
    case 'first_contact_feedback':
      if (!place) throw new Error('invalid_event_data');
      subject = `Como correu com o cliente de ${place}?`;
      preview = 'Leva 10 segundos.';
      paragraphs = [`Já conseguiu falar com o cliente de ${place}?`, 'Diga-nos como correu. Leva 10 segundos, e cada resposta ajuda-nos a perceber que pedidos funcionam melhor para si. A resposta ajuda-nos a acompanhar este pedido.'];
      button = 'Dizer como correu';
      break;
    case 'free_contacts_exhausted': {
      if(!data.prices||![data.prices.partilhada,data.prices.exclusiva].every(n=>Number.isSafeInteger(n)&&n>0)||typeof data.payments_ready!=='boolean')throw Error('invalid_commercial_data');
      const euro=n=>(n/100).toFixed(2).replace('.',',')+' €';
      subject='Já usou os contactos grátis iniciais. Veja os próximos passos.';
      preview='Consulte o saldo, os contactos grátis por usar e os preços atuais.';
      paragraphs=['Já usou os contactos grátis iniciais da sua conta. Os outros contactos grátis por usar e o seu saldo mantêm-se.',
        'Partilhado: '+euro(data.prices.partilhada)+'. Até 3 profissionais podem receber o mesmo contacto.',
        'Exclusivo: '+euro(data.prices.exclusiva)+'. Só você recebe o contacto enquanto a exclusividade estiver ativa. Disponível enquanto ninguém tiver obtido o contacto.',
        data.payments_ready?'Para continuar, pode usar o saldo que já tem ou carregar a sua conta. Consulte as opções disponíveis na sua área.':'Pode continuar a usar o saldo e os contactos grátis que ainda tem. Os carregamentos estão temporariamente indisponíveis.',
        'Sem mensalidade. O saldo é descontado quando obtém um contacto pago.'];
      button=data.payments_ready?'Carregar saldo':'Ver o meu saldo';break;
    }
    case 'lead_expiring':
      if (!place || data.days_remaining !== 5) throw new Error('invalid_event_data');
      subject = `Ninguém aceitou ainda o pedido de ${place}`;
      preview = 'Pode ficar com ele em exclusivo. Faltam 5 dias.';
      paragraphs = [
        `O pedido de ${place} ainda não foi aceite por ninguém.`,
        'O contacto ainda não foi obtido através do Guia. Pode escolher o exclusivo enquanto essa opção estiver disponível.',
        'O pedido termina dentro de 5 dias. Depois disso, deixa de estar disponível.'
      ];
      button = 'Ver pedido';
      break;
    case 'inactive_buyer':
      if (!positive(data.missed_requests)) throw new Error('invalid_event_data');
      subject = `${data.missed_requests} pedidos na sua zona passaram-lhe ao lado`;
      preview = 'Veja os que ainda estão disponíveis.';
      paragraphs = [
        `Na última semana, ${data.missed_requests} pedidos compatíveis com as suas zonas foram aceites por outros profissionais ou deixaram de estar disponíveis.`,
        'Há novos pedidos a entrar. Veja os que estão disponíveis agora, antes que outra pessoa chegue primeiro.',
        'Os pedidos que recebe não lhe servem? Ajuste as zonas, os tipos de limpeza e de espaço na sua área de parceiro. Os dias e horários ajudam a dar prioridade aos pedidos que encaixam na sua disponibilidade. Se estiver sem disponibilidade, pode pausar a receção de pedidos.'
      ];
      button = 'Ver pedidos disponíveis';
      break;
    default: throw new Error('invalid_event_type');
  }
  const content=paragraphs.slice(1).map((p,i)=>emailCard('',emailParagraph((i===0?'<strong>':'')+esc(p).replaceAll('\n','<br>')+(i===0?'</strong>':'')),{offer:offer&&i===0})).join('');
  return renderEmailLayout({subject,preview,title:['contact_accepted','approved_no_login','request_digest'].includes(payload.event_type)?subject:'',name:clean(payload.partner_name),paragraphs:paragraphs.slice(0,1),content,textContent:paragraphs.slice(1).join('\n\n'),button:{label:button,url:action},offer});
}

export function renderClientContactEmail(data,options={}){
 const name=clean(data.client_name),professional=clean(data.professional_name),place=clean(data.municipality),phone=clean(data.professional_phone,24).replace(/[\s()-]/g,'');
 if(!name||!professional||!place||!/^\+?[0-9]{9,15}$/.test(phone)||!['partilhada','exclusiva'].includes(data.modality))throw new Error('invalid_client_data');
 const stop=new URL(data.stop_url),host=options.preview?'engagement-test.guia-do-proprietario-parceiros.pages.dev':'parceiros.guiadoproprietario.pt';
 if(stop.protocol!=='https:'||stop.hostname!==host||stop.pathname!=='/pedido-contactos.html'||stop.username||stop.password||stop.port||!stop.hash)throw new Error('invalid_client_link');
 const subject=`${professional} vai contactá-lo sobre a sua limpeza`,preview='Guarde este contacto para reconhecer a chamada.';
 const paragraphs=[`Olá ${name},`,`Boas notícias: o seu pedido de limpeza em ${place} foi aceite por um profissional da sua zona.`,`${professional}\n📞 ${phone}`,'Pedimos ao profissional que o contacte nas próximas 24 horas. Se preferir, pode também ligar diretamente.',data.modality==='partilhada'?'O seu pedido pode ser aceite por até 3 profissionais.':'Este profissional é o único a receber o seu contacto através do Guia do Proprietário.','Antes de marcar o serviço:\nPeça o orçamento por escrito.\nConfirme o que está incluído e o preço final.','O serviço é combinado diretamente entre si e o profissional. O Guia do Proprietário encaminha o pedido, mas não presta o serviço de limpeza.','Já resolveu a limpeza ou prefere não ser contactado? Pode confirmar na ligação abaixo.'];
 const button='Não quero receber mais contactos';
 return renderEmailLayout({subject,preview,title:'Um profissional vai contactá-lo.',name,audience:'client',paragraphs:paragraphs.slice(1),secondary:[{label:button,url:stop.toString()}],signature:false});
}

export function renderClientInterestEmail(data,options={}){
 const name=clean(data.client_name),place=clean(data.municipality);
 if(!name||!place||![5,15].includes(data.stage))throw Error('invalid_interest_data');
 const host=options.preview?'engagement-test.guia-do-proprietario-parceiros.pages.dev':'parceiros.guiadoproprietario.pt';
 for(const [value,path] of [[data.interest_url,'/pedido-interesse.html'],[data.stop_url,'/pedido-contactos.html']]){
  const url=new URL(value);if(url.protocol!=='https:'||url.hostname!==host||url.port||url.username||url.password||url.pathname!==path||!url.hash)throw Error('invalid_interest_url');
 }
 const subject='Ainda procura um profissional de limpeza em '+place+'?',preview='Diga-nos se ainda pretende ser contactado sobre o seu pedido.';
 const paragraphs=['Ainda nenhum profissional da nossa rede aceitou o seu pedido de limpeza em '+place+'.',data.stage===15?'O prazo do seu pedido terminou. Se ainda precisa da limpeza, confirme abaixo para o voltar a disponibilizar por mais 15 dias. Tem 7 dias para confirmar.':'O pedido continua disponível e ainda pode ser aceite. Para o mantermos atualizado, diga-nos: ainda pretende ser contactado?'];
 return renderEmailLayout({subject,preview,name,audience:'client',paragraphs,button:{label:'Sim, ainda preciso da limpeza',url:data.interest_url},secondary:[{label:'Já não preciso de ser contactado',url:data.stop_url}],signature:false});
}

function renderV2Engagement(payload){
 const d=payload.data,input={...d,name:payload.partner_name,url:payload.dashboard_url,total:d.total||d.active_requests,missedRequests:d.missed_requests,daysRemaining:d.days_remaining,clientName:d.client_name,clientPhone:d.client_phone,clientEmail:d.client_email,clientPostalCode:d.postal_code,notes:d.notes,modality:d.modality};
 if(d.workflowKind)return renderEmailCopyV2(d.workflowKind,input);
 if(payload.event_type==='client_interest')return renderEmailCopyV2(d.stage===15?'Interesse-15':'Interesse-5',{name:d.client_name,place:d.municipality,requestedAt:d.request_created_at,cleaningType:d.cleaning_type,interestUrl:d.interest_url,stopUrl:d.stop_url});
 if(d.audience==='client')return renderEmailCopyV2(d.modality==='exclusiva'?'C1-exclusiva':'C1-partilhada',{name:d.client_name,place:d.municipality,professional:d.professional_name,professionalPhone:d.professional_phone,resolveUrl:d.resolve_url,stopUrl:d.stop_url});
 const kind=d.kind==='commercial_news_v1'?'P1':d.kind==='client_stop'?'Cliente-sem-contactos':d.kind==='zone_unlocked'?'Z1':{request_digest:'Resumo',approved_no_login:'Sem-acesso',contact_accepted:'P6',shared_contact_acquired:'Partilhado-outro',unused_free_contacts:'Gratis-por-usar',first_contact_feedback:'Feedback-atual',free_contacts_exhausted:d.zoneBlocked?'Carregamentos-pausados':'Gratis-esgotados',lead_expiring:'Pedido-termina',inactive_buyer:'Inativo'}[payload.event_type];
 if(!kind)throw Error('unsupported_v2_event');
 if(payload.event_type==='free_contacts_exhausted'&&!d.zoneBlocked&&d.payments_ready!==true)return renderEmailLayout({subject:'Já usou os contactos grátis iniciais',preview:'O seu saldo e outros contactos grátis mantêm-se.',name:payload.partner_name,paragraphs:['Já usou os contactos grátis iniciais. O seu saldo e outros contactos grátis que tenha mantêm-se.','Os carregamentos online estarão disponíveis em breve.'],button:{label:'Ver o meu saldo',url:payload.dashboard_url}});
 return renderEmailCopyV2(kind,input);
}
