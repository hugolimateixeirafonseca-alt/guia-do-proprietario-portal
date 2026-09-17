import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {copyLegacyKitEvents} from '../src/lib/kit-janelas-history.mjs';
const schema=readFileSync('migrations/kit-janelas/0001_kit_janelas.sql','utf8');
const create=()=>{const db=new DatabaseSync(':memory:');db.exec(schema);return db;};
const adapter=(db,readOnly=false)=>({prepare(query){let values=[];return {
  bind(...args){values=args;return this;},
  async first(){return db.prepare(query).get(...values)||null;},
  async run(){assert.equal(readOnly,false,'Nunca escrever na origem');db.prepare(query).run(...values);return {success:true};}
};}});
const event=(db,id,type='janelas_pdf_sent',status='success',error=null,date='2026-09-16T23:30:00.000Z')=>
  db.prepare('INSERT INTO kit_events (source,request_id,event,status,error_code,occurred_at) VALUES (?,?,?,?,?,?)')
    .run('kit-trocar-janelas',id,type,status,error,date);

test('base de Janelas rejeita eventos de outros produtos e não tem contactos do Estudante',()=>{
  const db=create();
  assert.throws(()=>db.prepare("INSERT INTO kit_events (source,event,status,occurred_at) VALUES ('meta','lead','success','2026-09-16')").run());
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('kit_leads','kit_sessions')").get().n,0);
  db.close();
});

test('vistas distinguem aceitações, exclusões, erros e ausência de motivo histórico',()=>{
  const db=create();
  for(const id of ['accepted','denied','error','unknown','unconfigured'])event(db,id);
  event(db,'accepted','janelas_meta_registration','error','meta_network');
  event(db,'accepted','janelas_meta_registration');
  event(db,'denied','janelas_meta_registration','ignored','measurement_not_authorized');
  event(db,'error','janelas_meta_registration','error','meta_timeout');
  event(db,'unconfigured','janelas_meta_registration','ignored','not_configured');
  const summary=db.prepare('SELECT * FROM resumo_inscricoes_por_dia').get();
  assert.deepEqual({...summary},{dia_lisboa:'2026-09-17',inscricoes:5,aceites_meta:1,sem_autorizacao:1,falhas_envio:2,sem_registo_meta:1});
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inscricoes_nao_enviadas_meta').get().n,4);
  db.close();
});

test('resumo usa o dia de Lisboa em verão e inverno',()=>{
  const db=create();
  event(db,'winter','janelas_pdf_sent','success',null,'2026-01-10T23:30:00.000Z');
  event(db,'summer','janelas_pdf_sent','success',null,'2026-09-16T23:30:00.000Z');
  event(db,'autumn','janelas_pdf_sent','success',null,'2026-10-25T23:30:00.000Z');
  assert.equal(db.prepare("SELECT dia_lisboa FROM inscricoes_meta WHERE pedido_id='winter'").get().dia_lisboa,'2026-01-10');
  assert.equal(db.prepare("SELECT dia_lisboa FROM inscricoes_meta WHERE pedido_id='summer'").get().dia_lisboa,'2026-09-17');
  assert.equal(db.prepare("SELECT dia_lisboa FROM inscricoes_meta WHERE pedido_id='autumn'").get().dia_lisboa,'2026-10-25');
  db.close();
});

test('copia cauda histórica sem duplicar, preserva origem e não copia outro produto',async()=>{
  const legacy=new DatabaseSync(':memory:');
  legacy.exec(readFileSync('migrations/0001_kit_estudante.sql','utf8'));
  const target=create();
  event(legacy,'old');
  legacy.prepare("INSERT INTO kit_events (source,event,status,occurred_at) VALUES ('meta','student','success','2026-09-16')").run();
  assert.equal(await copyLegacyKitEvents(adapter(legacy,true),adapter(target)),1);
  assert.equal(await copyLegacyKitEvents(adapter(legacy,true),adapter(target)),0);
  event(legacy,'late');
  assert.equal(await copyLegacyKitEvents(adapter(legacy,true),adapter(target),'late'),1);
  assert.equal(await copyLegacyKitEvents(adapter(legacy,true),adapter(target)),1);
  assert.equal(target.prepare('SELECT COUNT(*) AS n FROM kit_events').get().n,2);
  assert.equal(legacy.prepare('SELECT COUNT(*) AS n FROM kit_events').get().n,3);
  legacy.close();target.close();
});

test('falha de importação não avança o cursor e permite recuperar a página',async()=>{
  const legacy=create(),target=create();event(legacy,'one');event(legacy,'two');
  const destination=adapter(target);
  let inserts=0;
  const failing={prepare(query){const stmt=destination.prepare(query);return {
    bind(...args){stmt.bind(...args);return this;},first:()=>stmt.first(),async run(){
      if(query.startsWith('INSERT')&&++inserts===2)throw Error('simulated failure');
      return stmt.run();
    }
  };}};
  await assert.rejects(copyLegacyKitEvents(adapter(legacy,true),failing));
  assert.equal(target.prepare('SELECT last_legacy_id FROM kit_history_import').get().last_legacy_id,0);
  await copyLegacyKitEvents(adapter(legacy,true),destination);
  assert.equal(target.prepare('SELECT COUNT(*) AS n FROM kit_events').get().n,2);
  legacy.close();target.close();
});
