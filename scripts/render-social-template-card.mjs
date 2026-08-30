import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {renderSocialCardNode} from '../automation/social-card-renderer/render-node.mjs';

const root=path.resolve(import.meta.dirname,'..');
const args=new Map();
for(let index=2;index<process.argv.length;index+=2){
  const key=process.argv[index];
  const value=process.argv[index+1];
  if(!key?.startsWith('--')||value===undefined)throw new Error(`Invalid argument near ${key||'end'}`);
  args.set(key.slice(2),value);
}

const output=args.get('output');
const title=args.get('title');
const pillar=args.get('pillar')||'casa';
const badge=args.get('badge')||'GUIA';
const input=args.get('input')||'public/imagens/hero-home.webp';
const backgroundOutput=args.get('background-output');
if(!output||!title)throw new Error('--output and --title are required');

const inputPath=path.resolve(root,input);
const outputPath=path.resolve(root,output);
const image=await sharp(inputPath)
  .resize(1536,1024,{fit:'cover',position:'centre'})
  .png({compressionLevel:9,adaptiveFiltering:true})
  .toBuffer();

if(backgroundOutput){
  const backgroundPath=path.resolve(root,backgroundOutput);
  await fs.mkdir(path.dirname(backgroundPath),{recursive:true});
  await fs.writeFile(backgroundPath,image);
}

const {png,metrics}=await renderSocialCardNode({root,title,pillar,badge,variant:'social',image});
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,png);
console.log(JSON.stringify({output:path.relative(root,outputPath),input:path.relative(root,inputPath),backgroundOutput:backgroundOutput||null,title,pillar,badge,design:metrics.design},null,2));
