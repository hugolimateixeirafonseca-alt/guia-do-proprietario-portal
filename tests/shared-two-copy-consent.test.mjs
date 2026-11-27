import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONSENT_TEXT,LIMPEZA_CONSENT_VERSION,ALOJAMENTO_LOCAL_CONSENT_VERSION} from '../src/data/consent.ts';
import {renderEmailCopyV2} from '../functions/lib/partner-email-copy-v2.mjs';

test('current cleaning consent limits recipients to two while preserving archived three-recipient versions',()=>{
 for(const version of [LIMPEZA_CONSENT_VERSION,ALOJAMENTO_LOCAL_CONSENT_VERSION])assert.match(CONSENT_TEXT[version].c1,/até 2 parceiros/);
 for(const version of ['limpeza-2026-09-c','alojamento-local-2026-09-b'])assert.match(CONSENT_TEXT[version].c1,/até 3 parceiros/);
});
test('current cleaning landings, terms, privacy and partner page do not advertise three recipients',()=>{
 for(const file of ['src/pages/servicos-limpeza/index.astro','src/pages/servicos-limpeza/alojamento-local.astro','src/pages/parceiros.astro','src/pages/termos.astro','src/pages/privacidade.astro']){
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/até (?:3|três) (?:profissionais|parceiros|empresas)/i);assert.match(source,/até (?:2|dois) (?:profissionais|parceiros|empresas)/i);
 }
});
test('client acquisition email describes two recipients in HTML and plain text',()=>{
 const data={name:'Ana',place:'Lisboa',professional:'Empresa exemplo',professionalPhone:'910000000',resolveUrl:'https://parceiros.guiadoproprietario.pt/pedido-resposta.html?t=teste',stopUrl:'https://parceiros.guiadoproprietario.pt/pedido-contactos.html#token=teste'};
 const email=renderEmailCopyV2('C1-partilhada',data);assert.match(email.html,/até 2 profissionais/);assert.match(email.text,/até 2 profissionais/);assert.doesNotMatch(email.html+email.text,/até 3 profissionais/);
});
