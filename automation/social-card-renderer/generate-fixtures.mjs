import fs from 'node:fs/promises';
import path from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {renderSocialCardNode} from './render-node.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const outputDirectory=path.join(root,'artifacts/social-card-fixtures');

const fixtures=[
  {file:'01-curto-condominio.png',pillar:'condominio',source:'DECO PROteste',title:'Condomínios podem instalar painéis solares',theme:'condominio'},
  {file:'02-medio-arrendamento.png',pillar:'arrendar',source:'CNN Portugal',title:'Novas regras tornam contratos de arrendamento mais claros',theme:'arrendamento'},
  {file:'03-longo-herancas.png',pillar:'vender',source:'Público',title:'Heranças com casas passam a exigir mais atenção aos documentos e às decisões entre familiares',theme:'herancas'},
  {file:'04-muito-longo-energia.png',pillar:'casa',source:'Jornal Económico',title:'Apoios à eficiência energética podem ajudar proprietários a renovar janelas, melhorar o isolamento e reduzir o consumo das suas casas',theme:'energia'}
];

function scene(theme) {
  const scenes={
    condominio:`
      <path d="M980 780V252l82-68h332v596z" fill="#e8ddc8" stroke="#173c3d" stroke-width="8"/>
      <path d="M1046 246h292v92h-292zM1046 394h292v92h-292zM1046 542h292v92h-292z" fill="#f7f1e5"/>
      <g fill="#54736a"><path d="M1080 260h50v62h-50zM1168 260h50v62h-50zM1254 260h50v62h-50z"/><path d="M1080 408h50v62h-50zM1168 408h50v62h-50zM1254 408h50v62h-50z"/><path d="M1080 556h50v62h-50zM1168 556h50v62h-50zM1254 556h50v62h-50z"/></g>
      <g stroke="#173c3d" stroke-width="5"><path d="M1032 342h320M1032 490h320M1032 638h320"/><path d="M1065 342v34m62-34v34m62-34v34m62-34v34m62-34v34"/></g>
      <path d="M900 820c94-170 214-184 332-34 70-94 171-78 250 34z" fill="#6f8066"/>`,
    arrendamento:`
      <path d="M910 188h488v608H910z" fill="#e9dfcc" stroke="#173c3d" stroke-width="8"/>
      <path d="M972 246h170v264H972z" fill="#b9d0c3" stroke="#41645e" stroke-width="8"/><path d="M1057 246v264M972 378h170" stroke="#f7f1e5" stroke-width="7"/>
      <path d="M1204 226h132v570h-132z" fill="#315951"/><path d="M1204 392h132" stroke="#d9a35d" stroke-width="8"/>
      <path d="M950 642q180-122 360 0v142H950z" fill="#c7b99e"/><path d="M992 620h118v74H992zM1134 606h120v88h-120z" fill="#f3ecdf"/>
      <circle cx="1272" cy="588" r="32" fill="#b77b52"/><path d="M1272 588l90 76m-28-22 28-28m-8 50 30-24" stroke="#f4efe5" stroke-width="14" stroke-linecap="round"/>`,
    herancas:`
      <path d="M920 420l250-220 252 220v382H920z" fill="#ede2cc" stroke="#173c3d" stroke-width="8"/><path d="M872 422l298-264 300 264" fill="none" stroke="#b66e4f" stroke-width="40" stroke-linecap="round"/>
      <path d="M1110 542h128v260h-128z" fill="#315951"/><path d="M968 498h94v116h-94zM1286 498h94v116h-94z" fill="#b9d0c3" stroke="#41645e" stroke-width="7"/>
      <g fill="#557066"><circle cx="944" cy="736" r="72"/><circle cx="1392" cy="720" r="82"/></g>
      <path d="M874 770l244-68 56 204-244 68zM1110 750l232-30 28 212-232 30z" fill="#f7f1e5" stroke="#c5ae88" stroke-width="5"/>
      <circle cx="1260" cy="738" r="34" fill="#b78345"/><path d="M1260 738l98 68m-36-25 26-32m-2 58 36-21" stroke="#173c3d" stroke-width="15" stroke-linecap="round"/>`,
    energia:`
      <circle cx="1350" cy="184" r="78" fill="#d9a35d" opacity=".82"/>
      <path d="M916 510l236-222 270 222v310H916z" fill="#eee3ce" stroke="#173c3d" stroke-width="8"/><path d="M872 516l278-270 310 270" fill="none" stroke="#b66e4f" stroke-width="34" stroke-linecap="round"/>
      <g transform="translate(1040 330) skewX(-18)" fill="#315951" stroke="#f4efe5" stroke-width="5"><path d="M0 0h132v82H0zM142 0h132v82H142zM0 92h132v82H0zM142 92h132v82H142z"/></g>
      <path d="M1190 600h136v220h-136z" fill="#54736a"/><path d="M960 622h116v106H960z" fill="#b9d0c3" stroke="#41645e" stroke-width="7"/>
      <path d="M874 842c96-126 204-132 314 0 84-110 190-112 318 0z" fill="#687d61"/>`
  };
  return scenes[theme];
}

function baseSvg(theme) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
    <defs>
      <linearGradient id="paper" x1="0" x2="1"><stop stop-color="#f7f2e9"/><stop offset=".58" stop-color="#efe5d2"/><stop offset="1" stop-color="#d8c6a7"/></linearGradient>
      <filter id="grain"><feTurbulence baseFrequency=".72" numOctaves="2" seed="7" type="fractalNoise"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .045 0"/></filter>
    </defs>
    <path fill="url(#paper)" d="M0 0h1536v1024H0z"/><path fill="#173c3d" d="M820 0h716v1024H820z"/>
    <path d="M742 0c188 236 162 446 52 642-54 96-72 226-18 382h760V0z" fill="#e7d9bf" opacity=".9"/>
    ${scene(theme)}
    <path fill="#173c3d" opacity=".08" filter="url(#grain)" d="M0 0h1536v1024H0z"/>
  </svg>`;
}

await fs.mkdir(outputDirectory,{recursive:true});
for (const fixture of fixtures) {
  const base=new Resvg(baseSvg(fixture.theme)).render().asPng();
  const {png,metrics}=await renderSocialCardNode({...fixture,root,image:base});
  await fs.writeFile(path.join(outputDirectory,fixture.file),png);
  console.log(JSON.stringify({file:fixture.file,category:metrics.title.category,font_size:metrics.title.fontSize,lines:metrics.title.lines.length}));
}
