import test from 'node:test';
import assert from 'node:assert/strict';
import {cleaningAttribution} from '../functions/lib/cleaning-attribution.mjs';
test('extracts and decodes only requested campaign parameters',()=>{
 assert.deepEqual(cleaningAttribution('https://guiadoproprietario.pt/servicos-limpeza/?utm_content=Video+cozinha&utm_campaign=Limpeza%20Lisboa&fbclid=private'),{utm_content:'Video cozinha',utm_campaign:'Limpeza Lisboa'});
});
test('missing or malformed URLs are unattributed, values bounded',()=>{
 for(const url of [null,undefined,{},'invalid','https://test.pt/']) assert.deepEqual(cleaningAttribution(url),{utm_content:null,utm_campaign:null});
 assert.equal(cleaningAttribution('https://test.pt/?utm_content='+ 'x'.repeat(700)).utm_content.length,500);
});
