'use strict';
const areas={
  'Grande Lisboa':['Amadora','Cascais','Lisboa','Loures','Mafra','Odivelas','Oeiras','Sintra','Vila Franca de Xira'],
  'Margem Sul':['Alcochete','Almada','Barreiro','Moita','Montijo','Palmela','Seixal','Sesimbra','Setúbal']
};
const municipalities=Object.values(areas).flat();
const spaceTypes=['Apartamento','Moradia','Escritório','Loja','Alojamento local','Outro'];
const homeTypes=['Apartamento','Moradia','Alojamento local'];
const weekdays=['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];
const spaceAreas=['Até 50 m²','51 a 100 m²','101 a 150 m²','Mais de 150 m²'];
let profiles=[];
let excludedPartners=new Set();
let resuming=false,recoveryKey='';
const presentedPartners=new Set();
function networkAlreadySent(){
  main.innerHTML='<section class="wrap page narrow">'+head('Já pediu propostas a outros parceiros')+'<p>Os parceiros da sua zona que aceitarem o pedido poderão contactá-lo pelo canal que indicou.</p></section>';
}
const offerRanks=new Map();
let lastSubmission=null;
let sending=false;
let delivered=false;
const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main=document.querySelector('#main');
const startMarkup=main.innerHTML;
const initial={zone:'',frequency:'Semanal',size:'T2',space:'',other:'',area:'51 a 100 m²',days:[],periods:[],selected:'',planId:'',contactName:'',email:'',phone:'',channels:['Chamada','WhatsApp'],contactTime:'Sem preferência',consents:null};
let request={...initial};
let confirmed=false,normal=false,pendingPhone='';
const options=arr=>arr.map(s=>'<option>'+s+'</option>').join('');
const money=n=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:2}).format(n)+' €';
const sizes=['T0 / T1','T2','T3','T4 ou superior'];
function scheduleLabel(days){
  if(days.length===7)return 'Todos os dias da semana';
  if(days.length===5&&days.every(day=>weekdays.slice(0,5).includes(day)))return 'De segunda a sexta-feira';
  return new Intl.ListFormat('pt-PT',{type:'disjunction'}).format(days);
}
function availableDays(p){return scheduleLabel(p.days.filter(day=>!request.days.length||request.days.includes(day)))}
function matches(){return profiles.filter(p=>!excludedPartners.has(p.id)&&p.spaces.includes(request.space)&&p.zones.includes(request.zone)&&p.frequencies.includes(request.frequency)&&
  (!homeTypes.includes(request.space)||p.sizes.includes(request.size))&&
  (!request.periods.length||request.periods.some(t=>p.periods.includes(t)))&&availableDays(p)&&compatiblePlans(p).length);}
function summary(){
  return [request.zone,request.space==='Outro'?request.other:request.space,homeTypes.includes(request.space)?request.size:request.area,'Limpeza '+request.frequency.toLowerCase(),request.days.join(', ')||'Qualquer dia'].join(' · ');
}
function compatiblePlans(p){
  if(!p.plans){
    const price=money(p.rate)+'/h'+(p.rateUnit?' '+p.rateUnit:'');
    return [{id:'base',amount:p.rate,billing:'hora',rateUnit:p.rateUnit,price,title:'À hora',summary:price,details:[]}];
  }
  return p.plans.filter(plan=>!plan.frequency||plan.frequency===request.frequency)
    .map(plan=>plan.frequency?plan:{...plan,title:plan.title.replace(/^Limpeza regular/,request.frequency),summary:plan.summary.replace(/^Limpeza regular/,request.frequency)});
}
const anyPlan={id:'_any',title:'Qualquer uma das opções',summary:'Qualquer uma das opções'};
function selectedPlan(p){
  const plans=compatiblePlans(p);
  if(request.planId===anyPlan.id&&plans.length>1)return anyPlan;
  return plans.find(plan=>plan.id===request.planId);
}
function cardPrice(p){
  const plans=compatiblePlans(p);
  if(plans.length===1)return plans[0].price;
  const minimums=new Map();
  let hasUnpriced=false;
  for(const plan of plans){
    if(!(Number(plan.amount)>0)){hasUnpriced=true;continue;}
    const unit=plan.billing==='mensal'?'mensal':(p.people>1||p.type==='Equipa de Limpeza'?plan.rateUnit:'hora');
    if(!minimums.has(unit)||plan.amount<minimums.get(unit).amount)minimums.set(unit,plan);
  }
  const prices=[...minimums.values()].map(plan=>'Desde '+plan.price);
  if(hasUnpriced)prices.push('Preço a combinar');
  return [...prices,plans.length+' opções'].join(' · ');
}
function planChoices(p){
  return premiumPlanOptions(compatiblePlans(p),{team:p.type==='Equipa de Limpeza',frequency:request.frequency,partnerName:p.name});
}
function field(id,label,values){return '<label>'+label+'<select id="'+id+'" name="'+id+'">'+options(values)+'</select></label>'}
function setValues(ids){for(const id of ids){document.getElementById(id).value=request[id]}}
function collect(ids){for(const id of ids){request[id]=document.getElementById(id).value}}
function go(route){if(location.hash==='#'+route)render();else location.hash=route}
function progress(n){return '<p class="step">Passo '+n+' de 3</p>'}
function head(title,extra='',n=0){return '<div class="page-head">'+(n?progress(n):'')+'<h1 id="main-title" tabindex="-1">'+title+'</h1>'+extra+'</div>'}
function reset(){recoveryKey='';resuming=false;presentedPartners.clear();excludedPartners.clear();lastSubmission=null;delivered=false;request={...initial};normal=false;confirmed=false;go('inicio')}
function start(){
  main.innerHTML=startMarkup;
  document.getElementById('regularEntry').onclick=()=>document.getElementById('zone').focus();
  const normalUrl=new URL('/servicos-limpeza/',location.origin);
  for(const [key,value] of new URLSearchParams(location.search)){
    if(key.startsWith('utm_')||['fbclid','gclid'].includes(key))normalUrl.searchParams.set(key,value);
  }
  normalUrl.hash='pedido';
  document.getElementById('otherEntry').href=normalUrl.href;
  const zone=document.getElementById('zone');
  for(const [name,places] of Object.entries(areas)){const g=document.createElement('optgroup');g.label=name;g.innerHTML=options(places);zone.append(g)}
  setValues(['zone','frequency']);
  document.getElementById('zoneForm').onsubmit=e=>{e.preventDefault();collect(['zone','frequency']);normal=false;confirmed=false;if(municipalities.includes(request.zone))go('pedido')};
}
function choices(name,title,labels,type,selected,hint=''){
  const items=labels.map(label=>'<label class="choice"><input type="'+type+'" name="'+name+'" value="'+label+'"'+(selected.includes(label)?' checked':'')+(type==='radio'?' required':'')+'><span>'+label+'</span></label>').join('');
  return '<fieldset class="choice-set"><legend>'+title+'</legend>'+(hint?'<p class="note">'+hint+'</p>':'')+'<div class="tiles">'+items+'</div></fieldset>';
}
function selectedValues(form,name){return Array.from(form.querySelectorAll('input[name="'+name+'"]:checked'),el=>el.value)}
function bindAvailability(form,name,all){
  const inputs=Array.from(form.elements[name]);
  for(const input of inputs)input.addEventListener('change',()=>{
    const any=inputs.find(el=>el.value===all);
    if(input===any&&any.checked)inputs.forEach(el=>{el.checked=el===any});
    if(input!==any&&input.checked)any.checked=false;
    if(!inputs.some(el=>el.checked))any.checked=true;
  });
}
function qualify(){
  const location='<p>'+request.zone+' · Limpeza '+request.frequency.toLowerCase()+'</p>';
  const space=choices('space','Tipo de espaço',spaceTypes,'radio',[request.space]);
  const other='<label id="otherLabel" hidden>Qual é o tipo de espaço?<input id="other" type="text" maxlength="100" placeholder="Por exemplo, um estúdio de dança"></label>';
  const days=choices('days','Em que dias pode receber a limpeza?',['Qualquer dia',...weekdays],'checkbox',request.days.length?request.days:['Qualquer dia'],'Escolha todos os dias que lhe dão jeito.');
  const periods=choices('periods','Em que períodos?',['Qualquer período','Manhã','Tarde'],'checkbox',request.periods.length?request.periods:['Qualquer período']);
  main.innerHTML='<section class="wrap page narrow"><div class="bar"><a class="back" href="#inicio">← Alterar zona e frequência</a></div>'+head('Como é a limpeza que procura?',location,2)+'<form class="box" id="qualify"><h2>O seu espaço e a sua disponibilidade</h2>'+space+other+'<div class="field-grid">'+field('size','Tipologia do imóvel',sizes)+field('area','Área aproximada',spaceAreas)+'</div>'+days+periods+'<p class="tint">Os orçamentos referem-se à limpeza regular. Forno, interior de armários e limpezas pós-obra são combinados diretamente com o prestador.</p><div class="actions"><button class="primary">Comparar orçamentos <span aria-hidden="true">→</span></button></div></form></section>';
  const form=document.getElementById('qualify'),otherInput=form.elements.other;
  setValues(['size','area']);otherInput.value=request.other;
  function updateSpace(){
    const type=form.elements.space.value;
    const isOther=type==='Outro';
    document.getElementById('otherLabel').hidden=!isOther;
    otherInput.disabled=!isOther;otherInput.required=isOther;
    form.elements.size.closest('label').hidden=!homeTypes.includes(type);
    form.elements.area.closest('label').hidden=!type||homeTypes.includes(type);
  }
  updateSpace();
  for(const radio of form.elements.space)radio.addEventListener('change',updateSpace);
  otherInput.addEventListener('input',()=>otherInput.setCustomValidity(''));
  bindAvailability(form,'days','Qualquer dia');bindAvailability(form,'periods','Qualquer período');
  form.onsubmit=e=>{
    e.preventDefault();
    if(form.elements.space.value==='Outro'&&!otherInput.value.trim()){
      otherInput.setCustomValidity('Indique o tipo de espaço.');otherInput.reportValidity();return;
    }
    if(request.space!==form.elements.space.value || request.area!==form.elements.area.value)request.spaceSize='';
    collect(['size','area']);request.space=form.elements.space.value;
    request.other=request.space==='Outro'?otherInput.value.trim():'';
    request.days=selectedValues(form,'days').filter(d=>d!=='Qualquer dia');
    request.periods=selectedValues(form,'periods').filter(t=>t!=='Qualquer período');
    offerRanks.clear();
    request.selected='';request.planId='';confirmed=false;normal=false;go('propostas');
  };
}
function introExcerpt(bio){
  const text=(bio||'').trim().replace(/\s+/g,' ');
  const chars=Array.from(text);
  if(chars.length<=95)return text;
  const prefix=chars.slice(0,94).join('');
  const end=chars[94]===' '?prefix:prefix.replace(/ [^ ]*$/,'');
  return end.trimEnd()+'…';
}
function card(p){const active=p.id===request.selected;
  const excerpt=introExcerpt(p.bio);
  return '<button type="button" class="offer '+(active?'selected':'')+'" data-id="'+html(p.id)+'" aria-pressed="'+active+'" aria-controls="perfil"><img src="'+html(p.image)+'" alt="Fotografia de '+html(p.name)+'"><span class="info"><span class="type">'+html(p.name)+'</span><span class="person">'+p.type+(p.people>1?' · '+p.people+' profissionais':'')+'</span><span class="price">'+html(cardPrice(p))+'</span>'+(excerpt?'<span class="offer-intro">'+html(excerpt)+'</span>':'')+'<span class="open">'+(active?'Perfil aberto':'Ver perfil')+'</span></span></button>';
}
function profile(p){
  const list=new Intl.ListFormat('pt-PT',{style:'long',type:'conjunction'});
  const schedule=scheduleLabel(p.days);
  const team=p.type==='Equipa de Limpeza';
  const identity=team?p.type+' · '+p.people+(p.people===1?' profissional':' profissionais')+' por serviço':p.type;
  const provider={flexible:'A combinar',partner:'O prestador leva',client:'O cliente fornece'};
  const details=[
    ['Dias disponíveis',schedule],
    ['Períodos de serviço',list.format(p.periods)],
    ['Concelhos',list.format(p.zones)],
    ['Espaços',list.format(p.spaces)],
    ['Tipologias',p.spaces.some(space=>homeTypes.includes(space))?list.format(p.sizes):''],
    ['Frequência',list.format(p.frequencies)],
    ['Equipamento',provider[p.equipment]]
  ];
  const rows=details.filter(([,value])=>value).map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+html(value)+'</dd></div>').join('');
  return '<img src="'+html(p.image)+'" alt="Fotografia de '+html(p.name)+'">'+
    '<h2 id="profile-title" tabindex="-1">'+html(p.name)+'</h2><p>'+html(identity)+'</p><p>'+html(p.bio)+'</p>'+
    planChoices(p)+
    '<dl class="quote-details">'+rows+'</dl><p>O parceiro verifica a disponibilidade em 24 horas, contando apenas os dias úteis. Pedido sem compromisso.</p>'+
    '<div class="pc-action"><button type="button" class="pc-interest" data-profile-contact>Pedir contacto a este parceiro</button></div>';
}
async function results(){
  let lookupFailed=false;
  const zone=request.zone;
  main.innerHTML='<section class="wrap page"><p role="status">A consultar os parceiros disponíveis…</p></section>';
  try{
    const response=await fetch('/api/perfis-limpeza-premium?plans=1&zone='+encodeURIComponent(zone),{cache:'no-store'});
    if(!response.ok)throw Error();
    const data=await response.json();
    if(location.hash!=='#propostas'||request.zone!==zone)return;
    if(!data.ok||!Array.isArray(data.profiles))throw Error();
    profiles=data.profiles;
    if(recoveryKey){
      const saved=await fetch('/api/perfis-limpeza-premium',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({key:recoveryKey,presented:matches().map(p=>p.id)}),cache:'no-store'});
      if(!saved.ok)throw Error();
      const state=await saved.json();
      if(location.hash!=='#propostas'||request.zone!==zone)return;
      if(state.networkSent){networkAlreadySent();return;}
    }
  }catch{
    if(location.hash!=='#propostas'||request.zone!==zone)return;
    profiles=[];
    lookupFailed=true;
  }
  const found=matches();
  if(resuming){
    resuming=false;
    if(!lookupFailed&&!found.length){normal=true;go('contacto');return;}
  }
  for(const partner of found){
    presentedPartners.add(partner.id);
    if(!offerRanks.has(partner.id))offerRanks.set(partner.id,Math.random());
  }
  found.sort((a,b)=>offerRanks.get(a.id)-offerRanks.get(b.id));
  if(!found.some(p=>p.id===request.selected)){request.selected=found[0]?.id||'';request.planId='';}
  let title='Pode pedir contacto a outros parceiros da sua zona';
  if(found.length===1)title='Veja a proposta para a sua limpeza';
  if(found.length>1)title='Compare as propostas para a sua limpeza';
  const networkOffer=recoveryKey&&found.length?'<aside class="box network-invitation"><h2>Prefere receber outras propostas?</h2><p>Peça contacto a outros parceiros da sua zona. Quem aceitar o pedido poderá contactá-lo para apresentar uma proposta, sem compromisso. As empresas cujas propostas já viu ficam excluídas.</p><button type="button" class="secondary" id="fallback">Pedir propostas a outros parceiros</button></aside>':'';
  const description='<p id="request-summary"></p>'+networkOffer;
  main.innerHTML='<section class="wrap page"><div class="bar"><a class="back" href="#pedido">← Alterar pedido</a></div>'+head(title,description,3)+(found.length?'<div class="results"><div class="offers" aria-label="Propostas de limpeza"></div><article id="perfil" class="profile" aria-labelledby="profile-title"></article></div>':'<div class="box"><p>Os parceiros Premium apresentam aqui o seu perfil, planos de limpeza e dias disponíveis. '+(lookupFailed?'De momento, não conseguimos consultar esses perfis.':'De momento, nenhum tem uma proposta compatível com as suas preferências.')+'</p><p>Quer receber outras propostas? Aproveitamos os dados que já preencheu. Complete os dados em falta e escolha como quer ser contactado por até três parceiros da sua zona.</p><div class="actions"><button type="button" class="primary" id="fallback">Pedir contacto a outros parceiros</button><a href="#pedido" class="secondary">Ajustar preferências</a>'+(lookupFailed?'<button type="button" class="secondary" id="retry-profiles">Voltar a consultar parceiros Premium</button>':'')+'</div></div>')+'</section>';
  if(lookupFailed)document.getElementById('retry-profiles').onclick=results;
  document.getElementById('request-summary').textContent=summary();
  if(found.length){
    const display=move=>{
      const p=found.find(i=>i.id===request.selected);
      const offers=document.querySelector('.offers'), detail=document.getElementById('perfil');
      offers.innerHTML=found.map(card).join('');
      detail.innerHTML=profile(p);
      const openContact=planId=>{
        request.planId=planId;
        normal=false;confirmed=false;go('contacto');
      };
      detail.querySelector('[data-profile-contact]').onclick=()=>{
        const plans=compatiblePlans(p);
        openContact(plans.length===1?plans[0].id:'');
      };
      detail.querySelector('.quote-plans').onclick=e=>{
        const interest=e.target.closest('button[data-interest]');
        if(!interest)return;
        openContact(interest.dataset.interest);
      };
      const frame=(img,partner)=>{
        const position=value=>Number.isInteger(value)?Math.min(100,Math.max(0,value)):50;
        const fit=partner.photoFit==='contain'?'contain':'cover';
        img.style.objectFit=fit;
        img.style.objectPosition=fit==='contain'?'50% 50%':position(partner.photoX)+'% '+position(partner.photoY)+'%';
      };
      offers.querySelectorAll('.offer img').forEach((img,index)=>frame(img,found[index]));
      frame(detail.querySelector('img'),p);
      if(move){
        document.getElementById('profile-title').focus({preventScroll:true});
        if(matchMedia('(max-width:780px)').matches)detail.scrollIntoView({block:'start'});
      }
    };
    document.querySelector('.offers').onclick=e=>{const button=e.target.closest('button[data-id]');if(button){if(request.selected!==button.dataset.id)request.planId='';request.selected=button.dataset.id;display(true)}};display(false);
  }
  const fallback=document.getElementById('fallback');
  if(fallback)fallback.onclick=()=>{normal=true;confirmed=false;go('contacto')};
}
function phoneNumber(value){
  {
    const digits=value.replace(/\D/g,'').replace(/^(00351|351)/,'');
    return /^9\d{8}$/.test(digits) && !/[^\d+\s()-]/.test(value) ? '+351'+digits : '';
  }

}
function proposalLabel(p){
  return html(p.name)+' · '+p.type;
}
function contactDeadline(){
  return 'O parceiro vai verificar a disponibilidade. Enviamos a resposta por email no prazo de 24 horas, contando apenas os dias úteis. Se tiver disponibilidade, fala consigo pelo canal que indicou dentro desse mesmo prazo.';
}
const lateContactMessage='Olá! Fiz um pedido de limpeza através do Guia do Proprietário. Já passou o prazo de contacto e ainda não fui contactado. Podem ajudar-me?';
const supportWhatsApp='https://wa.me/351913857414?text='+encodeURIComponent(lateContactMessage);
function contactPlan(p){
  const plan=selectedPlan(p);
  if(plan)return '<p>'+html(plan.summary)+' · '+html(availableDays(p))+'</p>';
  const options=compatiblePlans(p).map(item=>'<option value="'+html(item.id)+'">'+html(item.summary)+'</option>').join('');
  return '<label>Sobre que opção gostaria de saber mais?<select name="planOfInterest" required><option value="">Selecione uma opção</option><option value="'+anyPlan.id+'">'+anyPlan.title+'</option>'+options+'</select></label>';
}
function contact(){
  const p=matches().find(profile=>profile.id===request.selected);
  if(!normal&&!p){go('propostas');return}
  const recipient=normal?'Pedido a parceiros de '+request.zone:proposalLabel(p);
  const title=normal?'Pedir propostas a outros parceiros':'Como prefere que '+html(p.name)+' entre em contacto consigo?';
  const authorisedPartner=normal?'até 3 parceiros de limpeza e manutenção do lar selecionados de acordo com a localização, o tipo de serviço e a disponibilidade':'o prestador que escolhi ('+html(p.name)+')';
  const permission='Autorizo o Guia do Proprietário a partilhar os dados deste pedido com '+authorisedPartner+(normal?', para que me possam contactar':', para que me possa contactar')+' com informações, disponibilidade e propostas relacionadas com este pedido.';
  request.consents=null;
  main.innerHTML='<section class="wrap page narrow"><div class="bar"><a href="#propostas" class="back">← Voltar às propostas</a></div>'+head(title)+
    '<form class="contact-box" id="finish" method="dialog"><div class="tint"><strong>'+recipient+'</strong>'+(normal?'':contactPlan(p))+
    '<p id="contact-summary" class="summary-line"></p>'+(normal?(recoveryKey?'<p class="details">Ao confirmar, o seu pedido fica disponível para outros parceiros da sua zona. Quem o aceitar poderá contactá-lo para apresentar uma proposta. As empresas cujas propostas já viu ficam excluídas.</p>':''):'<p class="details">Pedido sem compromisso. '+contactDeadline()+'</p>')+'</div>'+normalFields()+'<fieldset class="contact-fields"><legend>Os seus dados de contacto</legend><div class="field-grid">'+
    '<label>Nome<input id="contactName" name="contactName" autocomplete="name" type="text" maxlength="80" required></label>'+
    '<label>Email<input id="email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required></label>'+
    '<label>Número de telefone<input id="phone" name="phone" autocomplete="tel" type="tel" inputmode="tel" maxlength="28" aria-describedby="phone-help" required><small id="phone-help">'+'Indique um telemóvel português com nove algarismos.'+'</small></label>'+
    '</div></fieldset>'+choices('channels','Como prefere ser contactado?',normal?Object.keys(normalChannels):['Chamada','WhatsApp'],'checkbox',request.channels,normal?'Escolha os canais que prefere.':'Pode escolher uma ou ambas as opções.')+
    (normal?'':field('contactTime','Em que período prefere o contacto?',['Sem preferência','De manhã','À tarde']))+

    '<div class="optins"><label class="permission"><input type="checkbox" name="allowContact" required><span><strong>'+permission+'</strong><small>Consulte os parceiros que podem receber pedidos na nossa <a href="https://guiadoproprietario.pt/parceiros/">Lista de Parceiros</a> e saiba mais na <a href="https://guiadoproprietario.pt/privacidade/">Política de Privacidade</a>.</small></span></label>'+
    '<label class="permission"><input type="checkbox" name="marketing"><span><strong>Quero receber por email conteúdos, novidades e comunicações comerciais do Guia do Proprietário, incluindo ofertas e conteúdos patrocinados de parceiros selecionados.</strong><small>As comunicações são enviadas pelo Guia do Proprietário e o meu email não é cedido aos anunciantes. Posso cancelar a subscrição a qualquer momento.</small></span></label></div>'+
    '<div class="actions"><button type="submit" class="primary">'+(normal?'Confirmar pedido a outros parceiros':'Rever número de telefone')+'</button></div></form></section>';
  document.getElementById('contact-summary').textContent=summary();
  setValues(normal?['contactName','email','phone']:['contactName','email','phone','contactTime']);
  const form=document.getElementById('finish');
  bindNormalFields(form);
  const nameInput=form.elements.contactName,phoneInput=form.elements.phone;
  for(const input of [nameInput,form.elements.email,phoneInput])input.oninput=()=>{
    input.setCustomValidity('');request[input.id]=input.value;
  };
  function readPreferences(){
    request.channels=selectedValues(form,'channels');
    form.elements.channels[0].setCustomValidity(request.channels.length?'':'Escolha pelo menos uma forma de contacto.');
    if(!normal)collect(['contactTime']);
  }
  readPreferences();
  form.onchange=readPreferences;
  form.onsubmit=event=>{
    event.preventDefault();
    const name=nameInput.value.trim().replace(/\s+/g,' ');
    const validName=name.length>=2 && /^[\p{L}\p{M}]+(?:[ '’-][\p{L}\p{M}]+)*$/u.test(name);
    nameInput.setCustomValidity(validName?'':'Indique um nome válido.');
    form.elements.email.setCustomValidity(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value.trim())?'':'Indique um endereço de email válido.');
    phoneInput.setCustomValidity(phoneNumber(phoneInput.value)?'':'Indique um telemóvel português válido.');
    if(!form.reportValidity())return;
    if(form.elements.planOfInterest)request.planId=form.elements.planOfInterest.value;
    request.contactName=name;request.email=form.elements.email.value.trim();request.phone=phoneNumber(phoneInput.value);
    request.consents={partnerSharing:form.elements.allowContact.checked,marketing:form.elements.marketing.checked,recipient:normal?'parceiros-da-zona':p.id};
    pendingPhone=request.phone;confirmed=false;go('telefone');
  };
}
function confirmPhone(){
  const display=pendingPhone.replace(/^\+351(\d{3})(\d{3})(\d{3})$/, '+351 $1 $2 $3');
  main.innerHTML='<section class="wrap page narrow">'+head('É este o número para onde prefere ser contactado?')+
    '<div class="contact-box"><p>Confirme o indicativo e os últimos algarismos antes de concluir o pedido.</p>'+
    '<p role="status" id="send-status"></p><a id="review-proposals" href="#propostas" hidden>Voltar aos orçamentos</a><p id="phone-review" class="total details" dir="ltr"></p><p id="phone-channels" class="note details"></p>'+
    '<div class="actions"><button type="button" id="confirm-number" class="primary">'+(normal?'Sim, confirmar este número':'Pedir contacto')+'</button>'+
    '<button type="button" id="edit-number" class="secondary">Corrigir número</button></div>'+
    '<form id="correct-number" method="dialog" hidden><div class="field-grid"><label>Número de telefone<input name="correctedPhone" required type="tel" autocomplete="tel" inputmode="tel" maxlength="28"></label></div>'+
    '<button class="primary">Rever número corrigido</button></form></div></section>';
  document.getElementById('phone-review').textContent=display;
  document.getElementById('phone-channels').textContent='Contacto por '+request.channels.join(' e ')+'.';
  document.getElementById('confirm-number').onclick=sendRequest;
  const form=document.getElementById('correct-number'),input=form.elements.correctedPhone;
  document.getElementById('edit-number').onclick=event=>{
    event.currentTarget.parentElement.hidden=true;form.hidden=false;input.value=pendingPhone;input.focus();input.select();
  };
  input.oninput=()=>input.setCustomValidity('');
  form.onsubmit=event=>{
    event.preventDefault();const value=phoneNumber(input.value);
    input.setCustomValidity(value?'':'Indique um número de telefone válido.');
    if(!form.reportValidity())return;
    pendingPhone=value;request.phone=value;confirmPhone();document.getElementById('confirm-number').focus();
  };
}
async function sendRequest(){
  if(sending||delivered||!pendingPhone||!request.consents?.partnerSharing)return;
  const profile=normal?null:matches().find(p=>p.id===request.selected);
  if(!normal&&(!profile||!selectedPlan(profile))){go('propostas');return;}
  const note=[request.notes,request.other&&'Espaço: '+request.other,!homeTypes.includes(request.space)&&'Área: '+request.area,
    !normal&&'Preferência de contacto: '+request.contactTime].filter(Boolean).join(' · ');
  const body={...normalRequestData(),premiumRecoveryKey:recoveryKey||undefined,presentedPartners:normal?undefined:[...presentedPartners],additionalNotes:note.slice(0,500),requestConfirmed:true,
    source:normal?'guia_limpeza_regular_lisboa':'guia_limpeza_premium',consentVersion:normal?'limpeza-2026-09-c':'limpeza-premium-2026-11',
    pageUrl:location.origin+location.pathname+location.search};
  if(profile)Object.assign(body,{premiumPreferences:Object.fromEntries(['area','other','contactTime','notes'].map(key=>[key,request[key]])),premiumPartner:profile.id,premiumPlan:selectedPlan(profile).id,premiumName:profile.name,premiumVersion:profile.version});
  const signature=JSON.stringify(body);
  if(lastSubmission?.signature!==signature)lastSubmission={signature,id:crypto.randomUUID()};
  body.eventId=lastSubmission.id;body.measurementPixelState=typeof window.fbq==='function'?'callable':'missing';
  const submit=document.getElementById('confirm-number'),edit=document.getElementById('edit-number'),status=document.getElementById('send-status');
  sending=true;submit.disabled=true;edit.disabled=true;status.textContent='A enviar o pedido…';
  try{
    const response=await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok||!result.dashboardStored){
      if(response.status===409){document.getElementById('review-proposals').hidden=false;throw Error('A proposta mudou. Consulte os orçamentos disponíveis antes de confirmar.');}
      throw Error('Não foi possível confirmar o envio. Tente novamente.');
    }
    window.dispatchEvent(new CustomEvent('gp:premium-request-sent',{detail:body.eventId}));
    if(profile)window.dispatchEvent(new CustomEvent('gp:quote-request-confirmed',{detail:body.eventId}));
    delivered=true;confirmed=true;pendingPhone='';go('concluido');
  }catch(error){status.textContent=error.message;submit.disabled=false;edit.disabled=false;}finally{sending=false;}
}
function premiumConfirmation(p,plan){
  const channel=new Intl.ListFormat('pt-PT',{type:'disjunction'}).format(request.channels.map(c=>c==='Chamada'?'chamada':c));
  const space=[request.zone,request.space==='Outro'?request.other:request.space,homeTypes.includes(request.space)?request.size:request.area].filter(Boolean).join(' · ');
  const facts=[
    ['Espaço',space],['Plano',plan.title],['Dias possíveis',availableDays(p)],
    ['Contacto',request.contactName+' · '+channel+' · número terminado em '+request.phone.slice(-3)]
  ];
  const rows=facts.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+html(value)+'</dd></div>').join('');
  const terms=(plan.details||[]).map(term=>'<li>'+html(term)+'</li>').join('');
  return '<section class="wrap page receipt">'+head('Pedido enviado')+
    '<p class="receipt-intro"><strong>'+html(p.name)+'</strong> vai verificar se tem disponibilidade para a sua limpeza.</p>'+
    '<section class="receipt-next"><h2>Quando recebo uma resposta?</h2>'+
    '<p>Enviamos a resposta para <strong>'+html(request.email)+'</strong> no prazo de 24 horas, contando apenas os dias úteis.</p>'+
    '<p>Se o parceiro tiver disponibilidade, fala consigo por '+html(channel)+' dentro desse prazo. Se recusar ou não responder ao pedido, enviamos-lhe outras opções por email.</p></section>'+
    '<section class="receipt-summary" id="final-summary"><header><div><h2>A sua proposta</h2><p>'+html(p.name)+' · '+html(p.type)+'</p></div>'+(plan.price?'<strong class="receipt-price">'+html(plan.price)+'</strong>':'')+'</header>'+
    '<dl>'+rows+'</dl>'+(terms?'<details><summary>Condições do plano</summary><ul>'+terms+'</ul></details>':'')+
    '<p class="receipt-note">O pedido é sem compromisso. A limpeza só fica marcada quando combinar o serviço com o parceiro.</p></section>'+
    '<div class="receipt-footer"><p>O parceiro confirmou disponibilidade mas ainda não falou consigo? <a href="'+supportWhatsApp+'">Fale com o Guia pelo WhatsApp</a>.</p>'+
    '<button type="button" id="restart" class="secondary">Fazer outro pedido</button></div></section>';
}
function done(){
  if(!normal){
    const p=matches().find(profile=>profile.id===request.selected);
    const plan=p&&selectedPlan(p);
    if(!plan){go('propostas');return;}
    main.innerHTML=premiumConfirmation(p,plan);
  }else{
    const data=normalRequestData();
    main.innerHTML='<section class="wrap page narrow">'+head('Pedido enviado')+
      '<div class="box"><h2>Contacto com outros parceiros</h2><p id="final-summary" class="summary-line details"></p><p id="final-contact" class="details"></p>'+
      '<p class="note details">O pedido foi registado. A data da limpeza é combinada diretamente com o prestador.</p>'+
      '<div class="actions"><button class="primary" id="restart">Fazer outro pedido</button></div></div></section>';
    document.getElementById('final-summary').textContent=summary()+(homeTypes.includes(request.space)?'':' · '+normalSizes[data.spaceSize])+' · '+data.postalCode+' · '+
      (data.preferredDate?data.preferredDate.split('-').reverse().join('/'):normalTiming[data.oneTimeTiming])+' · '+(request.periods.join(' ou ')||'Qualquer período');
    document.getElementById('final-contact').textContent=request.contactName+' · '+request.channels.join(' e ')+' · telefone terminado em '+request.phone.slice(-3)+'.';
  }
  document.getElementById('restart').onclick=reset;
}
function render(){
  let route=location.hash.slice(1)||'inicio';

  if(delivered&&route!=='concluido')return go('concluido');
  if(sending&&route!=='telefone')return go('telefone');
  if(route!=='inicio'&&!municipalities.includes(request.zone)){route='inicio';history.replaceState(null,'','#inicio')}
  if(route==='telefone'&&(!pendingPhone||!request.consents?.partnerSharing)){route='contacto';history.replaceState(null,'','#contacto')}
  if(route!=='telefone')pendingPhone='';
  if(route!=='concluido')confirmed=false;
  if(route==='concluido'&&!confirmed){route='propostas';history.replaceState(null,'','#propostas')}
  const views={inicio:start,pedido:qualify,propostas:results,contacto:contact,telefone:confirmPhone,concluido:done};(views[route]||start)();document.getElementById('main-title')?.focus({preventScroll:true});window.scrollTo(0,0);
}
async function resumeRequest(key){
  main.innerHTML='<section class="wrap page narrow"><p role="status">A recuperar o seu pedido…</p></section>';
  try{
    const response=await fetch('/api/perfis-limpeza-premium',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key}),cache:'no-store'});
    if(!response.ok)throw Error();
    const data=await response.json();
    if(data.networkSent){networkAlreadySent();return;}
    if(!data.ok||!municipalities.includes(data.preferences.zone))throw Error();
    Object.assign(request,data.preferences,{selected:'',planId:'',consents:null});
    excludedPartners=new Set(data.excluded);recoveryKey=key;normal=window.premiumNetwork===true;resuming=!normal;
    history.replaceState(null,'',normal?'#contacto':'#propostas');render();
  }catch{
    main.innerHTML='<section class="wrap page narrow">'+head('Não foi possível recuperar o pedido')+'<p>Volte a abrir a ligação do email ou comece um novo pedido.</p><a class="primary" href="#inicio">Começar novo pedido</a></section>';
  }
}
window.addEventListener('hashchange',render);
if(window.premiumResumeKey){const key=window.premiumResumeKey;delete window.premiumResumeKey;resumeRequest(key);}else render();
