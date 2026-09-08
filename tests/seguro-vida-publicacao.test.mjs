import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parse } from 'parse5';

function* walk(n){yield n;for(const c of n.childNodes||[])yield*walk(c);}
const attrs=n=>Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]));
test('Cinco páginas de produção, 17 CTAs e três artigos nas listagens e sitemap',async()=>{
 const articles=['seguro-vida-credito-habitacao-poupar','mudar-seguro-vida-credito-habitacao-banco','comparar-seguro-vida-credito-habitacao'];
 const archive=await fs.readFile('dist/artigos/index.html','utf8');
 const casa=await fs.readFile('dist/casa/index.html','utf8');
 const sitemap=await fs.readFile('dist/sitemap-0.xml','utf8');
 let total=0;
 for(const route of ['seguro-vida-credito-habitacao','seguro-vida-simulacao',...articles.map(s=>'casa/'+s)]){
  const html=await fs.readFile('dist/'+route+'/index.html','utf8');
  const nodes=[...walk(parse(html))];
  const landing=!route.startsWith('casa/');
  const ctas=nodes.filter(n=>n.tagName==='a'&&attrs(n).href?.startsWith('https://track.guiadoproprietario.pt/go/'));
  assert.equal(ctas.length,landing?4:3,route);
  for(const cta of ctas){const url=new URL(attrs(cta).href);assert.equal(url.pathname,'/go/seguro-vida-'+(landing?'landing':'editorial'));assert.equal(url.searchParams.get('source'),route.split('/').at(-1));assert(attrs(cta).rel.includes('sponsored'));}
  total+=ctas.length;
  assert(!html.includes('https://adsplatform.com/'));
  assert(!html.includes('Apresentação ao cliente'));
  const canonical=nodes.find(n=>n.tagName==='link'&&attrs(n).rel==='canonical');
  assert.equal(attrs(canonical).href,'https://guiadoproprietario.pt/'+route+'/');
  const robots=nodes.find(n=>n.tagName==='meta'&&attrs(n).name==='robots');
  assert.equal((attrs(robots||{}).content||'').includes('noindex'),landing);
  assert.equal(sitemap.includes('https://guiadoproprietario.pt/'+route+'/'),!landing);
  if(!landing){assert(archive.includes('/'+route+'/'));assert(casa.includes('/'+route+'/'));}
 }
 assert.equal(total,17);
});
