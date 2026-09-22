// Checkout timestamps must not force conversion of unchanged, pre-generated images.
import {execFileSync} from 'node:child_process';
import {utimesSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z','--','imagens','public/imagens'],{encoding:'utf8',maxBuffer:16*1024*1024}).split('\0').filter(Boolean);
for(const file of files){
  const seconds=Number(execFileSync('git',['log','-1','--format=%ct','--',file],{encoding:'utf8'}).trim());
  if(!Number.isFinite(seconds)||seconds<=0)throw new Error('Missing image commit time: '+file);
  utimesSync(file,seconds,seconds);
}
console.log('Restored timestamps for '+files.length+' tracked images.');
