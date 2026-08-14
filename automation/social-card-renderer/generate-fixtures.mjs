import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {renderSocialCardNode} from './render-node.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const outputDirectory=path.join(root,'artifacts/social-card-fixtures');
const masterArgumentIndex=process.argv.indexOf('--master-image');
const suppliedMaster=masterArgumentIndex>=0 ? process.argv[masterArgumentIndex+1] : '';
const masterOnly=process.argv.includes('--master-only');
const variantsOnly=process.argv.includes('--variants-only');
if (masterArgumentIndex>=0 && !suppliedMaster) throw new Error('--master-image requires a local raster path');
if (masterOnly && variantsOnly) throw new Error('--master-only and --variants-only cannot be used together');

const images={
  condominio:path.join(root,'public/imagens/pilar-condominio.webp'),
  arrendamento:path.join(root,'public/imagens/artigos/contrato-arrendamento-o-que-verificar.webp'),
  herancas:path.join(root,'public/imagens/artigos/herdei-uma-casa.webp'),
  energia:path.join(root,'public/imagens/artigos/paineis-solares-vale-a-pena.webp')
};

const fixtures=[
  {
    file:'00-master-calibration.png',pillar:'arrendar',source:'CNN Portugal',
    title:'Apoio ao alojamento para estudantes deslocados poderá dispensar contrato de arrendamento',
    image:suppliedMaster||images.condominio,
    cropMaster:Boolean(suppliedMaster)
  },
  {file:'01-curto.png',pillar:'condominio',source:'DECO PROteste',title:'Condomínios podem instalar painéis solares',image:images.condominio},
  {file:'02-medio.png',pillar:'arrendar',source:'CNN Portugal',title:'Novas regras tornam contratos de arrendamento mais claros',image:images.arrendamento},
  {file:'03-longo.png',pillar:'vender',source:'Público',title:'Heranças com casas passam a exigir mais atenção aos documentos e às decisões entre familiares',image:images.herancas},
  {file:'04-muito-longo.png',pillar:'casa',source:'Jornal Económico',title:'Apoios à eficiência energética podem ajudar proprietários a renovar janelas, melhorar o isolamento e reduzir o consumo das suas casas',image:images.energia}
];

await fs.mkdir(outputDirectory,{recursive:true});
const selectedFixtures=masterOnly ? fixtures.slice(0,1) : variantsOnly ? fixtures.slice(1) : fixtures;
for (const fixture of selectedFixtures) {
  let image;
  if (fixture.cropMaster) {
    const input=sharp(path.resolve(fixture.image));
    const metadata=await input.metadata();
    const cropLeft=Math.round((metadata.width||1536)*0.57);
    const cropWidth=(metadata.width||1536)-cropLeft;
    const photo=await input
      .extract({left:cropLeft,top:0,width:cropWidth,height:metadata.height||1024})
      .resize(936,1024,{fit:'fill'})
      .png()
      .toBuffer();
    const underlay=await sharp(path.resolve(fixture.image))
      .extract({left:cropLeft,top:0,width:cropWidth,height:metadata.height||1024})
      .resize(1536,1024,{fit:'fill'})
      .blur(24)
      .png()
      .toBuffer();
    image=await sharp(underlay)
      .composite([{input:photo,left:600,top:0}])
      .png()
      .toBuffer();
  } else {
    image=await sharp(path.resolve(fixture.image))
      .resize(1536,1024,{fit:'cover',position:'centre'})
      .png()
      .toBuffer();
  }
  const {png,metrics}=await renderSocialCardNode({...fixture,root,image});
  await fs.writeFile(path.join(outputDirectory,fixture.file),png);
  console.log(JSON.stringify({
    file:fixture.file,
    image:path.basename(fixture.image),
    category:metrics.title.category,
    font_size:metrics.title.fontSize,
    lines:metrics.title.lines.length
  }));
}
