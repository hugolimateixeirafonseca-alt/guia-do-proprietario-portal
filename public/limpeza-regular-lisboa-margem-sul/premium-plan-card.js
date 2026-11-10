/* Shared by the partner preview and the cleaning quote page. */
function premiumPlanCard(plan, {team=false, frequency='', selectable=false, checked=false}={}) {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>Number(value).toLocaleString('pt-PT',{maximumFractionDigits:2});
  const monthly=plan.billing==='mensal';
  const cadence=plan.frequency||frequency;
  const title=cadence?'Plano '+cadence.toLocaleLowerCase('pt-PT'):(monthly?'Plano mensal':plan.billing==='hora'?'Plano à hora':'Limpeza regular');
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
  const tag=selectable?'label':'article';
  const radio=selectable?'<input type="radio" name="quote-plan" value="'+esc(plan.id)+'"'+(checked?' checked':'')+'>':'';
  const price=amount>0?esc(number(amount))+' €<span class="pc-unit">'+(monthly?'/mês':plan.billing==='hora'?'/h':'')+'</span>':'Preço a combinar';
  return '<'+tag+' class="plan-card"><span class="pc-head"><span class="pc-name">'+radio+esc(title)+'</span>'+
    '<span class="pc-pricing"><span class="pc-price">'+price+'</span>'+(notes?'<span class="pc-note">'+esc(notes)+'</span>':'')+'</span></span>'+
    (metrics.length?'<span class="pc-metrics">'+metrics.map(([key,value])=>'<span class="pc-metric"><span class="pc-key">'+esc(key)+'</span><span class="pc-value">'+esc(value)+'</span></span>').join('')+'</span>':'')+
    (rows.length?'<span class="pc-terms">'+rows.map(([key,value])=>'<span class="pc-row"><span class="pc-key">'+esc(key)+'</span><span>'+esc(value)+'</span></span>').join('')+'</span>':'')+'</'+tag+'>';
}
