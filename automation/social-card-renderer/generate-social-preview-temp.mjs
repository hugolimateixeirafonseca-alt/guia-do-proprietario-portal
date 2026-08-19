import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {renderSocialCardNode} from './render-node.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const outputDirectory=path.join(root,'artifacts/social-card-preview-temp');
const baseImage=path.join(root,'public/imagens/hero-home.webp');
const image=await sharp(baseImage).resize(1536,1024,{fit:'cover',position:'centre'}).png().toBuffer();

const samples=[
  {file:'social-guia.png',title:'Vai vender casa? Comece pelos documentos',badge:'GUIA'},
  {file:'social-pergunta.png',title:'Qual foi a obra em casa que parecia simples e acabou por sair cara?',badge:'PERGUNTA'}
];

await fs.mkdir(outputDirectory,{recursive:true});
for(const sample of samples){
  const {png}=await renderSocialCardNode({root,image,variant:'social',...sample});
  await fs.writeFile(path.join(outputDirectory,sample.file),png);
  console.log(`wrote ${sample.file}`);
}
