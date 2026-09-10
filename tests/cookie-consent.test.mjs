import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/components/CookieConsent.astro', import.meta.url), 'utf8');
const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
function setup(preferences, pathname='/seguro-vida-diagnostico/') {
  const nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, {hidden:false, checked:false, open:false, listeners:{},
      addEventListener(type, fn){this.listeners[type]=fn}, focus(){},
      showModal(){this.open=true}, close(){this.open=false},
      querySelector: node});
    return nodes.get(key);
  };
  const jar = new Map(preferences ? [['gp_cookie_preferences', encodeURIComponent(JSON.stringify(preferences))]] : []);
  const document = {getElementById:node, querySelectorAll:()=>[node('settings')], documentElement:{style:{overflow:'auto'}}};
  Object.defineProperty(document,'cookie',{get:()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; '),set:raw=>{const [k,v]=raw.split(';')[0].split('=');jar.set(k,v)}});
  const window = {};
  let reloaded=false;
  vm.runInNewContext(script,{document,window,metaPixelId:'',location:{protocol:'https:',pathname,reload(){reloaded=true}},Date});
  return {node,document,window,jar,get reloaded(){return reloaded}, choice(){return JSON.parse(decodeURIComponent(jar.get('gp_cookie_preferences')))}};
}
const valid = measurement => ({version:'2026-09-01-1',measurement,savedAt:new Date().toISOString()});
test('Sem escolha, a janela exige decisão; Escape não aceita nem fecha',()=>{
  const x=setup();assert.equal(x.node('cookie-banner').open,true);assert.equal(x.document.documentElement.style.overflow,'hidden');
  let prevented=false;x.node('cookie-banner').listeners.cancel({preventDefault(){prevented=true}});
  assert.equal(prevented,true);assert.equal(x.node('cookie-banner').open,true);assert.equal(x.jar.size,0);
});
test('Aceitar e recusar fecham a janela, restauram o scroll e guardam escolhas distintas',()=>{
  for(const [selector,allowed] of [["[data-cookie-choice='all']",true],["[data-cookie-choice='necessary']",false]]){
    const x=setup();x.node(selector).listeners.click();assert.equal(x.node('cookie-banner').open,false);
    assert.equal(x.document.documentElement.style.overflow,'auto');assert.equal(x.choice().measurement,allowed);
    assert.equal(x.choice().version,'2026-09-01-1');
  }
});
test('Escolhas válidas persistem, incluindo a recusa; escolhas inválidas voltam a pedir decisão',()=>{
  for(const value of [true,false])assert.equal(setup(valid(value)).node('cookie-banner').open,false);
  for(const pref of [valid('true'),{...valid(true),savedAt:'inválido'},{...valid(true),version:'antiga'},{...valid(false),savedAt:new Date(Date.now()-15600000000).toISOString()}])assert.equal(setup(pref).node('cookie-banner').open,true);
});
test('É possível reabrir e retirar a autorização; recusa não ativa medição',()=>{
  const x=setup(valid(true));x.window._pixelOn=true;x.node('settings').listeners.click({preventDefault(){}});
  assert.equal(x.node('cookie-banner').open,true);assert.equal(x.node('cookie-measurement').checked,true);
  x.node("[data-cookie-choice='necessary']").listeners.click();assert.equal(x.choice().measurement,false);assert.equal(x.reloaded,true);
});
test('Informação legal pode ser lida antes da decisão, sem criar consentimento',()=>{
  for(const path of ['/cookies/','/privacidade/','/termos/']){const x=setup(undefined,path);assert.equal(x.node('cookie-banner').open,false);assert.equal(x.jar.size,0)}
});
