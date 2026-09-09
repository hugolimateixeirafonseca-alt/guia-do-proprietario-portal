import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararJanelasEditorial} from '../src/lib/janelas-editorial.mjs';
test('Dois CTAs mantêm atribuição, não divulgam contactos e respeitam revogação do consentimento',()=>{
 const links=Array.from({length:2},()=>({href:'',events:{},addEventListener(name,handler){this.events[name]=handler}}));
 const doc={cookie:'',querySelectorAll:()=>links};
 const win={location:{href:'https://guiadoproprietario.pt/casa/renovar-janelas-casa/?utm_source=meta&utm_campaign=12345678901234&ad_id=4567890123456&fbclid=CLICK&email=private@example.com&source=outro'}};
 prepararJanelasEditorial(doc,win);
 for(const l of links){const u=new URL(l.href);assert.equal(u.pathname,'/go/janelas-diagnostico');assert.equal(u.searchParams.get('source'),'renovar-janelas-casa');assert.equal(u.searchParams.get('utm_campaign'),'12345678901234');assert.equal(u.searchParams.get('ad_id'),'4567890123456');for(const k of ['email','fbclid','measurement_consent'])assert.equal(u.searchParams.has(k),false)}
 doc.cookie='gp_cookie_preferences='+encodeURIComponent(JSON.stringify({measurement:true,version:'2026-09-01-1',savedAt:new Date().toISOString()}))+'; _fbp=fb.1.1788888000000.123';
 for(const l of links){l.events.click();const u=new URL(l.href);assert.equal(u.searchParams.get('fbclid'),'CLICK');assert.equal(u.searchParams.get('measurement_consent'),'true');assert.ok(u.searchParams.get('fbclid_seen_at'));}
 doc.cookie='';
 for(const l of links){l.events.auxclick();assert.equal(new URL(l.href).searchParams.has('fbclid'),false);assert.equal(new URL(l.href).searchParams.has('fbp'),false);l.events.contextmenu();l.events.focus();assert.equal(new URL(l.href).searchParams.has('measurement_consent'),false)}
});
