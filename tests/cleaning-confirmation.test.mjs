import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const full=readFileSync(new URL('../src/scripts/landings/limpezas.js',import.meta.url),'utf8');
function fixture(){
 const node={classList:{add(){},remove(){},toggle(){}}};const handlers={};const sent=[];
 const elements={consent_partner_sharing:{checked:true},consent_marketing:{checked:false}};
 const nodes={confirmationTitle:{focus(){}},pedido:{scrollIntoView(){}}};
 const ctx={currentStep:5,confirmation:{checked:false,focus(){}},confirmButton:{disabled:true},
 steps:[1,2,3,4,5,6].map(step=>({...node,dataset:{step}})),dots:[],stepLabel:{},updateSummary(){},document:{getElementById:id=>nodes[id]},
 form:{...node,elements,dataset:{consentVersion:'v1'},addEventListener:(name,fn)=>handlers[name]=fn},window:{location:{href:'https://test/'}},
 eventId:()=>crypto.randomUUID(),getValue:()=> 'value',getValues:()=>[],validateStep:()=>true,
 sendingState:node,errorState:node,successState:node,errorMap:{},fetch:async(_,init)=>{sent.push(JSON.parse(init.body));return new Response('{}');}};
 vm.createContext(ctx);
 const reset=full.slice(full.indexOf('  const resetConfirmation'),full.indexOf('  let currentStep'));
 const show=full.slice(full.indexOf('  const showStep'),full.indexOf('  const validateStep'));
 const start=full.indexOf('  let submissionInFlight');
 vm.runInContext(reset+show+full.slice(start,full.indexOf('\n  document.getElementById(',start)),ctx);
 return {ctx,sent,submit:()=>handlers.submit({preventDefault(){}}),show:n=>vm.runInContext('showStep('+n+')',ctx)};
}
test('review sends nothing until the user explicitly confirms',async()=>{
 const f=fixture();await f.submit();assert.equal(f.ctx.currentStep,6);assert.equal(f.sent.length,0);
 await f.submit();assert.equal(f.sent.length,0);
 f.ctx.confirmation.checked=true;await f.submit();assert.equal(f.sent.length,1);
});
test('editing preferences clears approval and returning requires confirmation again',async()=>{
 const f=fixture();f.ctx.confirmation.checked=true;f.ctx.confirmButton.disabled=false;
 f.show(1);assert.equal(f.ctx.confirmation.checked,false);assert.equal(f.ctx.confirmButton.disabled,true);
 f.show(5);await f.submit();await f.submit();assert.equal(f.sent.length,0);
});
test('an invalid earlier field returns to its step without sending',async()=>{
 const f=fixture();f.ctx.currentStep=6;f.ctx.confirmation.checked=true;f.ctx.validateStep=n=>n!==2;
 await f.submit();assert.equal(f.ctx.currentStep,2);assert.equal(f.ctx.confirmation.checked,false);assert.equal(f.sent.length,0);
});
test('one-time summary shows the chosen date without stale recurring weekdays',()=>{
 const result={};const summary={};const values={service_type:'regular',service_frequency:'one_time',one_time_timing:'specific_date',preferred_date:'2026-10-15',postal_code:'1900-096'};
 const ctx={summary,document:{getElementById:()=>result},getValue:k=>values[k]||'',getValues:k=>k==='preferred_weekdays'?['monday']:['morning']};
 const labels=full.slice(full.indexOf('  const labels'),full.indexOf('  const getValue'));
 const update=full.slice(full.indexOf('  const updateSummary'),full.indexOf('  const eventId'));
 vm.runInNewContext(labels+update+'updateSummary();',ctx);
 assert.equal(result.textContent,'Limpeza regular · Uma vez · 15/10/2026 · Manhã · 1900-096');
});
