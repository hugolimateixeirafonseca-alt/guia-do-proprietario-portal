import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {createSocialCardLayout,SOCIAL_CARD,selectTitleLayout} from '../src/lib/social-card-layout.mjs';
import {detectRasterImageType,isMultipartFormData,isSupportedRasterImage} from '../src/lib/social-card-upload.mjs';
import {renderSocialCardNode} from '../automation/social-card-renderer/render-node.mjs';

const root=path.resolve(import.meta.dirname,'..');
const accentedTitle='Crédito à habitação: prestação média desce em São João';
const source='RTP Notícias';

async function fixturePng() {
  const svg=await fs.readFile(path.join(root,'tests/fixtures/social-card-base.svg'),'utf8');
  return new Resvg(svg).render().asPng();
}

function collectText(node,values=[]) {
  if (typeof node==='string') values.push(node);
  if (Array.isArray(node)) node.forEach(child=>collectText(child,values));
  if (node&&typeof node==='object') collectText(node.props?.children,values);
  return values;
}

test('renderer produz PNG 1536x1024',async()=>{
  const rendered=await renderSocialCardNode({
    root,title:accentedTitle,source,pillar:'casa',image:await fixturePng()
  });
  assert.deepEqual([...rendered.png.subarray(1,4)],[80,78,71]);
  assert.equal(rendered.png.readUInt32BE(16),1536);
  assert.equal(rendered.png.readUInt32BE(20),1024);
});

test('título com acentos e fonte são preservados exatamente',async()=>{
  const layout=createSocialCardLayout({title:accentedTitle,source,image:await fixturePng()});
  assert.equal(layout.metrics.title.title,accentedTitle);
  assert.equal(layout.metrics.title.lines.join(' '),accentedTitle);
  assert.equal(layout.metrics.exactSource,source);
  const text=collectText(layout.tree);
  assert.ok(text.includes('Fonte:'));
  assert.ok(text.includes(source));
});

test('título e fonte com caracteres XML permanecem texto literal',async()=>{
  const specialTitle='Casa <T2> & "Arrendamento": preço sobe 10%';
  const specialSource=`Fonte <Nacional> & 'Imóveis' €`;
  const layout=createSocialCardLayout({title:specialTitle,source:specialSource,image:await fixturePng()});
  assert.equal(layout.metrics.title.title,specialTitle);
  assert.equal(layout.metrics.title.lines.join(' '),specialTitle);
  assert.equal(layout.metrics.exactSource,specialSource);
  assert.ok(collectText(layout.tree).includes('Fonte:'));
  assert.ok(collectText(layout.tree).includes(specialSource));
  const image=await fixturePng();
  await assert.doesNotReject(()=>renderSocialCardNode({root,title:specialTitle,source:specialSource,image}));
});

test('upload exige multipart com boundary e bytes raster coerentes',async()=>{
  const png=await fixturePng();
  assert.equal(isMultipartFormData('multipart/form-data; boundary=make-boundary'),true);
  assert.equal(isMultipartFormData('multipart/form-data'),false);
  assert.equal(isMultipartFormData('application/json'),false);
  assert.equal(detectRasterImageType(png),'image/png');
  assert.equal(isSupportedRasterImage(png,'image/png'),true);
  assert.equal(isSupportedRasterImage(png,'image/jpeg'),false);
  assert.equal(isSupportedRasterImage(new TextEncoder().encode('<svg></svg>'),'image/png'),false);
});

test('título longo permanece na área segura e não colide com a ilustração',()=>{
  const title='Novas regras para obras de conservação em edifícios residenciais ajudam condomínios a planear intervenções, contratos e custos comuns';
  const layout=selectTitleLayout(title);
  assert.ok(layout.lines.length<=layout.maxLines);
  assert.ok(layout.height<=SOCIAL_CARD.title.maxHeight);
  assert.ok(SOCIAL_CARD.title.left+SOCIAL_CARD.title.width<SOCIAL_CARD.illustrationStart);
  assert.equal(layout.lines.join(' '),title);
});

test('título extremamente longo reduz automaticamente o tamanho',()=>{
  const title='Proprietários de apartamentos em condomínios com obras de conservação, eficiência energética e contratos de manutenção passam a dispor de orientações adicionais para organizar decisões e documentação';
  const layout=selectTitleLayout(title);
  assert.ok(layout.fontSize<56);
  assert.ok(layout.lines.length<=6);
  assert.equal(layout.lines.join(' '),title);
});

test('quatro classes de título respeitam safe area e hierarquia estável',()=>{
  const cases=[
    ['short','Condomínios podem instalar painéis solares'],
    ['medium','Novas regras tornam contratos de arrendamento mais claros'],
    ['long','Heranças com casas passam a exigir mais atenção aos documentos e às decisões entre familiares'],
    ['very_long','Apoios à eficiência energética podem ajudar proprietários a renovar janelas, melhorar o isolamento e reduzir o consumo das suas casas']
  ];
  let previousSize=Infinity;
  for (const [category,title] of cases) {
    const layout=selectTitleLayout(title);
    assert.equal(layout.category,category);
    assert.equal(layout.lines.join(' '),title);
    assert.ok(layout.lines.length>=1 && layout.lines.length<=layout.maxLines);
    assert.ok(layout.height<=SOCIAL_CARD.title.maxHeight);
    assert.ok(layout.fontSize<=previousSize);
    previousSize=layout.fontSize;
  }
});

test('formas editoriais integram a imagem sem cobrir texto',()=>{
  const textRight=SOCIAL_CARD.title.left+SOCIAL_CARD.title.width;
  assert.ok(SOCIAL_CARD.transitionSafeLeft>textRight);
  assert.ok(SOCIAL_CARD.illustrationStart>textRight);
});

test('NOTÍCIAS e branding ocupam posições determinísticas como texto simples',async()=>{
  const layout=createSocialCardLayout({title:accentedTitle,source,image:await fixturePng()});
  const text=collectText(layout.tree);
  assert.ok(text.includes('NOTÍCIAS'));
  assert.ok(text.includes('Guia do Proprietário'));
  assert.deepEqual(layout.metrics.label,{left:90,top:182,width:213,height:60});
  assert.equal(layout.metrics.source.top,Math.max(
    SOCIAL_CARD.source.minTop,
    Math.min(SOCIAL_CARD.source.maxTop,layout.metrics.title.bottom+SOCIAL_CARD.source.gap)
  ));
  assert.equal(layout.metrics.brand.left,90);
  assert.equal(layout.metrics.brand.top,layout.metrics.source.top+SOCIAL_CARD.brand.offsetTop);
});

test('variante default continua NEWS para compatibilidade com cenários existentes',async()=>{
  const layout=createSocialCardLayout({title:accentedTitle,source,image:await fixturePng()});
  const text=collectText(layout.tree);
  assert.equal(layout.metrics.variant,'news');
  assert.equal(layout.metrics.badge,'NOTÍCIAS');
  assert.ok(text.includes('NOTÍCIAS'));
  assert.ok(text.includes('Fonte:'));
  assert.ok(text.includes(source));
});

test('variante SOCIAL usa badge dinâmico e nunca apresenta Fonte ou NOTÍCIAS',async()=>{
  const title='Vai vender casa? Comece pelos documentos';
  const layout=createSocialCardLayout({title,variant:'social',badge:'GUIA',image:await fixturePng()});
  const text=collectText(layout.tree);
  assert.equal(layout.metrics.variant,'social');
  assert.equal(layout.metrics.badge,'GUIA');
  assert.equal(layout.metrics.source,null);
  assert.equal(layout.metrics.exactSource,'');
  assert.ok(text.includes('GUIA'));
  assert.ok(text.includes('Guia do Proprietário'));
  assert.ok(!text.includes('NOTÍCIAS'));
  assert.ok(!text.includes('Fonte:'));
  assert.equal(layout.metrics.title.lines.join(' '),title);
});

test('badge social longo cabe no limite e imagem final continua 1536x1024',async()=>{
  const rendered=await renderSocialCardNode({
    root,
    title:'Mito ou verdade: avaliação bancária é o valor de mercado?',
    variant:'social',
    badge:'MITO OU VERDADE',
    image:await fixturePng()
  });
  assert.equal(rendered.metrics.variant,'social');
  assert.equal(rendered.metrics.badge,'MITO OU VERDADE');
  assert.ok(rendered.metrics.label.width<=SOCIAL_CARD.social.label.maxWidth);
  assert.ok(rendered.metrics.label.width>=SOCIAL_CARD.social.label.minWidth);
  assert.equal(rendered.png.readUInt32BE(16),1536);
  assert.equal(rendered.png.readUInt32BE(20),1024);
});
