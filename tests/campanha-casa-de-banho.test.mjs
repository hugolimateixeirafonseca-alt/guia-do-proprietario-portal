import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCampanhaBanho } from '../src/lib/campanha-casa-de-banho.mjs';
test('Desconto e CTA preservam IDs, respeitam recusa/revogação e não enviam contactos',()=>{
 const links=Array.from({length:2},()=>({href:'',events:{},addEventListener(k,fn){this.events[k]=fn}}));
 const inputs=['banheira','duche'].map(value=>({value,events:{},addEventListener(k,fn){this.events[k]=fn}}));
 const next={textContent:''};
 const doc={cookie:'',querySelector:()=>next,querySelectorAll:s=>s==='[data-banho-link]'?links:inputs};
 prepararCampanhaBanho(doc,{location:{href:'https://guiadoproprietario.pt/campanha-casa-de-banho/?source=outro&utm_source=meta&utm_campaign=123456789012345&utm_content=34567890123456&campaign_id=123456789012345&adset_id=23456789012345&ad_id=34567890123456&fbclid=META_CLICK&email=private@example.com'}});
 for(const link of links){const u=new URL(link.href);assert.equal(u.pathname,'/go/casa-banho-campanha');assert.equal(u.searchParams.get('source'),'campanha-casa-de-banho');assert.equal(u.searchParams.get('ad_id'),'34567890123456');assert.equal(u.searchParams.get('utm_campaign'),'123456789012345');for(const k of ['email','fbclid','measurement_consent'])assert.equal(u.searchParams.has(k),false)}
 doc.cookie='gp_cookie_preferences='+encodeURIComponent(JSON.stringify({measurement:true,version:'2026-09-01-1',savedAt:new Date().toISOString()}))+'; _fbp=fb.1.1788888000000.123';
 links[0].events.click();
 for(const l of links){const u=new URL(l.href);assert.equal(u.searchParams.get('measurement_consent'),'true');assert.equal(u.searchParams.get('fbclid'),'META_CLICK');assert.ok(u.searchParams.get('fbclid_seen_at'))}
 doc.cookie='';links[1].events.auxclick();
 for(const l of links){assert.equal(new URL(l.href).searchParams.has('fbclid'),false);assert.equal(new URL(l.href).searchParams.has('fbp'),false)}
 inputs[1].events.change();assert.match(next.textContent,/renovar a base/);
 inputs[0].events.change();assert.match(next.textContent,/trocar a banheira/);
});

