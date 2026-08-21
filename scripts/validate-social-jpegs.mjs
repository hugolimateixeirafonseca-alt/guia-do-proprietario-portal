import fs from 'node:fs/promises';
import path from 'node:path';

const dir=path.resolve(import.meta.dirname,'../public/imagens/artigos');
const entries=await fs.readdir(dir,{withFileTypes:true});
const webps=entries.filter(e=>e.isFile()&&e.name.toLowerCase().endsWith('.webp')).map(e=>e.name).sort();
if(!webps.length) throw new Error('Nenhuma capa WebP encontrada em public/imagens/artigos');

const missing=[];
const invalid=[];
for(const webp of webps){
  const jpeg=webp.replace(/\.webp$/i,'.social.jpg');
  const file=path.join(dir,jpeg);
  try{
    const bytes=await fs.readFile(file);
    if(bytes.length<1000||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff) invalid.push(jpeg);
  }catch(error){
    if(error?.code==='ENOENT') missing.push(jpeg); else throw error;
  }
}
if(missing.length||invalid.length){
  throw new Error(`JPEG sociais inválidos. missing=${missing.join(',')} invalid=${invalid.join(',')}`);
}
console.log(`SOCIAL_JPEG_COVERAGE_OK=${webps.length}`);
