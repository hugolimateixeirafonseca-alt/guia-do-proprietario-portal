const $=id=>document.getElementById(id);
let token='',records=[],next=null,email='',scope='',busy=false,generation=0;
const status=text=>$('status').textContent=text;
function clear(){generation++;token='';records=[];next=null;email='';$('key').value='';$('email').value='';$('records').replaceChildren();$('results').hidden=true;$('search').hidden=true;$('login').hidden=false;status('');}
function render(){
 $('records').replaceChildren();
 for(const r of records){
  const card=document.createElement('article');card.className='record';
  const title=document.createElement('h3');title.textContent=new Date(r.received_at).toLocaleString('pt-PT',{timeZone:'Europe/Lisbon'})+' · '+r.source;card.append(title);
  const list=document.createElement('dl');
  const fields=[['Email',r.email],['Data original (UTC)',r.received_at],['IP',r.ip||'Não recolhido'],['Origem do IP',r.ip_source],['Página',r.page_url||'Não indicada'],['Origem da URL',r.url_source],['Versão do texto',r.consent_version],['Evento',r.event_id],['Navegador',r.user_agent||'Não recolhido'],['Identificador',r.id],['Integridade SHA-256',r.integrity]];
  for(const [label,value] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;list.append(dt,dd);}card.append(list);
  for(const [key,text] of Object.entries(r.consent_text)){if(!text)continue;const label=document.createElement('p');label.className='choice';label.textContent=key+' · '+(r.choices[key]===true?'Aceite':r.choices[key]===false?'Não aceite':'Não registado');const quote=document.createElement('blockquote');quote.textContent=text;card.append(label,quote);}
  $('records').append(card);
 }
 $('result-title').textContent=records.length+' registo(s) de '+email;$('coverage').textContent=scope;$('more').hidden=next===null;$('results').hidden=false;
 // A exportação só é disponibilizada quando todas as páginas da pesquisa foram carregadas.
 $('export').disabled=next!==null;$('print').disabled=next!==null;
}
async function search(more=false){if(busy)return;busy=true;const current=generation;
 if(!more){records=[];next=null;email=$('email').value.trim().toLowerCase();$('results').hidden=true;$('records').replaceChildren();}
 status('A consultar o arquivo…');
 try{const response=await fetch('/api/consent-archive',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({email,after:more?next:0}),cache:'no-store'});
 if(current!==generation)return;
 if(response.status===401){clear();status('A chave não foi aceite. Volte a entrar.');return;}
 if(!response.ok)throw new Error(response.status===503?'O arquivo ainda não está disponível. Verifique a configuração privada.':'Não foi possível concluir a pesquisa.');
 const result=await response.json();if(current!==generation)return;records.push(...result.records);next=result.next;scope=result.scope;render();status(records.length?next===null?'Pesquisa completa. Pode consultar ou exportar a evidência.':'Existem mais registos. Carregue-os para exportar a evidência completa.':'Não foram encontrados registos neste arquivo. Isso não prova ausência de consentimento anterior.');
 }catch(error){if(current===generation)status(error.message);}finally{busy=false;}
}
$('login-form').addEventListener('submit',event=>{event.preventDefault();token=$('key').value;$('key').value='';$('login').hidden=true;$('search').hidden=false;$('email').focus();});
$('search-form').addEventListener('submit',event=>{event.preventDefault();search();});$('more').addEventListener('click',()=>search(true));$('logout').addEventListener('click',clear);
$('export').addEventListener('click',()=>{const link=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify({exported_at:new Date().toISOString(),scope,records},null,2)],{type:'application/json'}));link.href=url;link.download='evidencia-consentimento.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});$('print').addEventListener('click',()=>window.print());
window.addEventListener('pagehide',clear);
