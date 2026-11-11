/* Shared by the partner preview and the cleaning quote page. */
function premiumPlanCard(plan,{team,partnerName,preview,group}) {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>Number(value).toLocaleString('pt-PT',{maximumFractionDigits:2});
  const monthly=plan.billing==='mensal';
  const amount=Number(plan.amount),hours=plan.duration==='flexible'?0:Number(plan.hours),visits=Number(plan.visits);
  const metrics=[],rows=[];
  if(monthly&&visits>0)metrics.push(['Limpezas/mês',number(visits)]);
  if(plan.duration==='flexible')rows.push(['Duração','Até concluir a limpeza']);
  if(hours>0)metrics.push([plan.billing==='hora'?'Mínimo por limpeza':'Por limpeza',number(hours)+' h']);
  if(monthly&&visits>0&&hours>0){
    metrics.push(['Total mensal',number(hours*visits)+' h']);
    if(amount>0)rows.push(['Equivalente por hora',number(amount/(hours*visits))+' €/h'+(team?' pela equipa':'')]);
  }
  const extra={included:'Incluída',separate:'Orçamentada à parte',skip:'Sem visita adicional'}[plan.extra];
  if(monthly&&extra)rows.push(['Visita adicional',extra]);
  const vat={included:'IVA incluído',exempt:'Isento de IVA'}[plan.vat];
  const unitNote=!monthly&&team?plan.rateUnit:'';
  const notes=[unitNote,vat].filter(Boolean).join(' · ');
  const title=hours>0?(plan.billing==='hora'?'Mínimo de ':'')+number(hours)+(hours===1?' hora':' horas')+' por visita':
    plan.duration==='flexible'?'Até concluir a limpeza':monthly?'Mensalidade fixa':plan.billing==='hora'?'Limpeza à hora':'Limpeza regular';
  const price=amount>0?esc(number(amount))+' €<span class="pc-unit">'+(monthly?'/mês':plan.billing==='hora'?'/h':'')+'</span>':'Preço a combinar';
  return '<details class="plan-card" name="'+group+'" data-option="'+esc(plan.id)+'"><summary class="pc-head"><span class="pc-name">'+esc(title)+'</span>'+
    '<span class="pc-price">'+price+'</span><span class="pc-link"><span>Ver detalhes</span><span>Ocultar detalhes</span></span></summary>'+
    (notes?'<span class="pc-note pc-meta">'+esc(notes)+'</span>':'')+
    (metrics.length?'<span class="pc-metrics">'+metrics.map(([key,value])=>'<span class="pc-metric"><span class="pc-key">'+esc(key)+'</span><span class="pc-value">'+esc(value)+'</span></span>').join('')+'</span>':'')+
    (rows.length?'<span class="pc-terms">'+rows.map(([key,value])=>'<span class="pc-row"><span class="pc-key">'+esc(key)+'</span><span>'+esc(value)+'</span></span>').join('')+'</span>':'')+'<div class="pc-action"><button type="button" class="pc-interest" data-interest="'+esc(plan.id)+'"'+(preview?' disabled':'')+'>Gostava de saber mais</button>'+
    '<p>Peça mais informações '+(partnerName?'a '+esc(partnerName):'ao parceiro')+' sobre esta opção, sem compromisso.</p></div></details>';
}

function premiumPlanOptions(plans,{team=false,frequency='',partnerName='',preview=false}={}){
  const group=preview?'preview-options':'cleaning-options';
  const cards=plans.map(plan=>premiumPlanCard(plan,{team,partnerName,preview,group}));
  const title='Opções de limpeza'+(frequency==='Semanal'?' semanal':frequency==='Quinzenal'?' quinzenal':'');
  const common=[];
  if(plans.length>1){
    const first=plans[0];
    if(first.billing==='mensal'&&Number(first.visits)>0&&plans.every(plan=>plan.billing==='mensal'&&Number(plan.visits)===Number(first.visits))){
      common.push(Number(first.visits)+(Number(first.visits)===1?' limpeza por mês':' limpezas por mês'));
    }
    const vat={included:'IVA incluído',exempt:'Isento de IVA'}[first.vat];
    if(vat&&plans.every(plan=>plan.vat===first.vat))common.push(vat);
  }
  const commonInfo=common.length?'<p class="pc-common">'+common.join(' · ')+'</p>':'';
  const extra=cards.length>3?'<details class="pc-more"><summary>Ver mais '+(cards.length-3)+(cards.length===4?' opção':' opções')+'</summary>'+cards.slice(3).join('')+'</details>':'';
  return '<section class="quote-plans"><h3>'+title+'</h3>'+commonInfo+cards.slice(0,3).join('')+extra+
    (cards.length?'':'<p>Sem opções para esta frequência.</p>')+'</section>';
}
