import test from 'node:test';
import assert from 'node:assert/strict';
import { linkSeguroComCampanha } from '../src/lib/seguro-vida-links.ts';

test('Seguro: atribuição sem contactos e identificadores Meta apenas com consentimento atual',()=>{
 const destino='https://track.guiadoproprietario.pt/go/seguro-vida-editorial';
 const origem='https://guiadoproprietario.pt/casa/seguro-vida-credito-habitacao-poupar/?utm_source=meta&ad_id=123456789012345&fbclid=ABC&email=private@example.com';
 const a=new URL(linkSeguroComCampanha(destino,origem,'_fbp=fb.1.1788888000000.123'));
 assert.equal(a.searchParams.get('source'),'seguro-vida-credito-habitacao-poupar');
 assert.equal(a.searchParams.get('ad_id'),'123456789012345');
 for(const key of ['email','fbclid','fbp','measurement_consent'])assert.equal(a.searchParams.has(key),false);
 const pref=encodeURIComponent(JSON.stringify({measurement:true,version:'2026-09-01-1',savedAt:new Date().toISOString()}));
 const b=linkSeguroComCampanha(destino,origem,'gp_cookie_preferences='+pref);
 assert.equal(new URL(b).searchParams.get('fbclid'),'ABC');
 assert.equal(new URL(linkSeguroComCampanha(b,origem,'')).searchParams.has('fbclid'),false);
 assert.equal(linkSeguroComCampanha('https://example.com/',origem),'https://example.com/');
 const interno=new URL(linkSeguroComCampanha('/casa/outro/',origem));
 assert.equal(interno.searchParams.get('utm_source'),'meta');
 assert.equal(interno.searchParams.has('email'),false);
});
