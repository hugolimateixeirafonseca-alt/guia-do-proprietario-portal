import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {measurementChoice,trackCleaningLead,trackSelectedCleaningQuote} from '../src/lib/cleaning-measurement.mjs';
import {recordCleaningMeasurement} from '../functions/lib/cleaning-measurement-diagnostics.mjs';
const cookie = (measurement, extra={}) => 'gp_cookie_preferences='+encodeURIComponent(JSON.stringify({version:'2026-09-01-1',savedAt:new Date().toISOString(),measurement,...extra}));
test('measurement choices distinguish refusal, missing, invalid and expired cookies',()=>{
 assert.equal(measurementChoice(cookie(true)),'accepted');assert.equal(measurementChoice(cookie(false)),'refused');
 assert.equal(measurementChoice(''),'unset');assert.equal(measurementChoice('gp_cookie_preferences=%'),'invalid');
 assert.equal(measurementChoice(cookie(true,{savedAt:'2020-01-01'})),'invalid');assert.equal(measurementChoice(cookie(true,{savedAt:'2099-01-01'})),'invalid');
});
test('only consenting submissions invoke the same Lead ID; pixel errors never escape into form success',()=>{
 const calls=[],b={document:{cookie:cookie(true)},fbq:(...a)=>calls.push(a)};
 assert.equal(trackCleaningLead(b,'id-1'),'invoked');assert.equal(calls[0][3].eventID,'id-1');
 b.document.cookie=cookie(false);assert.equal(trackCleaningLead(b,'id-2'),'skipped_consent');assert.equal(calls.length,1);
 b.document.cookie=cookie(true);b.fbq=undefined;assert.equal(trackCleaningLead(b,'id-3'),'unavailable');
 b.fbq=()=>{throw Error('blocked')};assert.equal(trackCleaningLead(b,'id-4'),'exception');
});
test('Premium Lead has a distinct content_name and retains the submission ID',()=>{
 const calls=[],browser={document:{cookie:cookie(true)},fbq:(...args)=>calls.push(args)};
 trackCleaningLead(browser,'premium-id',true);
 trackCleaningLead(browser,'normal-id',false);
 assert.deepEqual(calls[0],['track','Lead',{content_name:'servicos-limpeza-premium'},{eventID:'premium-id'}]);
 assert.deepEqual(calls[1],['track','Lead',{content_name:'servicos-limpeza'},{eventID:'normal-id'}]);
 browser.document.cookie=cookie(false);
 trackCleaningLead(browser,'refused-id',true);
 assert.equal(calls.length,2);
});
test('confirmed quote uses a separate Meta event only with measurement consent',()=>{
 const calls=[],browser={document:{cookie:cookie(false)},fbq:(...args)=>calls.push(args)};
 assert.equal(trackSelectedCleaningQuote(browser,'request-id'),'skipped_consent');
 browser.document.cookie=cookie(true);
 assert.equal(trackSelectedCleaningQuote(browser,'request-id'),'invoked');
 assert.deepEqual(calls,[['trackCustom','OrcamentoSelecionado',{content_name:'servicos-limpeza'},{eventID:'request-id'}]]);
});
test('diagnostics record only successful caller evidence, once per event, without contact data',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/consent-archive/0002_cleaning_measurement_diagnostics.sql',import.meta.url),'utf8'));
 const env={CONSENT_ARCHIVE_DB:{prepare(sql){let args;return {bind(...v){args=v;return this},async run(){db.prepare(sql).run(...args);return {success:true}}}}}};
 const evidence={id:'opaque-key',received_at:new Date().toISOString()},body={source:'guia_limpeza_preco_disponibilidade',measurementPixelState:'callable',email:'must-not-store@example.invalid'};
 await recordCleaningMeasurement(env,new Request('https://test/',{headers:{Cookie:cookie(true)}}),evidence,body);
 await recordCleaningMeasurement(env,new Request('https://test/'),evidence,body);
 const rows=db.prepare('SELECT * FROM cleaning_measurement_diagnostics').all();assert.equal(rows.length,1);assert.equal(rows[0].measurement_choice,'accepted');assert.equal(rows[0].browser_pixel_state,'callable');assert.ok(!JSON.stringify(rows).includes(body.email));
 await recordCleaningMeasurement(env,new Request('https://test/'),{...evidence,id:'second'},{...body,measurementPixelState:'invalid'});
 assert.equal(db.prepare("SELECT browser_pixel_state FROM cleaning_measurement_diagnostics WHERE event_key='second'").get().browser_pixel_state,'unknown');db.close();
});
test('diagnostic storage errors do not fail the lead',async()=>{
 const original=console.warn;let warned=false;console.warn=()=>{warned=true};try {await recordCleaningMeasurement({},new Request('https://test/'),{},{});assert.equal(warned,true)}finally{console.warn=original}
});