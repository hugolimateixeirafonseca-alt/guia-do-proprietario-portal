export const SOCIAL_POST_CARD=Object.freeze({
  width:1536,
  height:1024,
  image:{left:620,top:0,width:916,height:1024},
  textSafeRight:690,
  label:{left:82,top:148,height:70,minWidth:210,maxWidth:410},
  title:{left:76,top:286,width:590,maxHeight:458},
  footer:{left:76,top:826,width:390},
  brand:{left:76,top:892,width:610,height:46},
  curve:{topX:820,midX:735,bottomX:650},
  watermark:{left:392,top:660,width:280,height:250}
});

export const SOCIAL_POST_THEME=Object.freeze({
  background:'#F6F0E6',
  backgroundSoft:'#FBF7EF',
  ink:'#173C3D',
  petrol:'#173C3D',
  petrolSoft:'#295556',
  gold:'#B88A4A',
  goldLight:'#D2B06D',
  creamSecondary:'#E9DECC',
  white:'#FFFDF8'
});

const FONT_SIZES=[104,100,96,92,88,84,80,76,72,68,64,62];

function characterWidth(character,fontSize){
  if (/\s/u.test(character)) return fontSize*0.25;
  if (/[ilI1.,:;!'|]/u.test(character)) return fontSize*0.27;
  if (/[mwMW@%&]/u.test(character)) return fontSize*0.77;
  if (/[A-ZÀ-Þ]/u.test(character)) return fontSize*0.58;
  return fontSize*0.47;
}

function textWidth(text,fontSize){
  return [...text].reduce((total,character)=>total+characterWidth(character,fontSize),0);
}

function wrapTitle(title,fontSize,maxWidth){
  const words=String(title||'').trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [];
  const lines=[];
  let line='';
  for (const word of words){
    if (textWidth(word,fontSize)>maxWidth) return null;
    const candidate=line?`${line} ${word}`:word;
    if (line&&textWidth(candidate,fontSize)>maxWidth){
      lines.push(line);
      line=word;
    }else{
      line=candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function selectSocialPostTitleLayout(title){
  const exactTitle=String(title||'').trim();
  if (!exactTitle) throw new Error('title is required');
  if ([...exactTitle].length>88) throw new Error('title is too long for social card');
  for (const fontSize of FONT_SIZES){
    const lines=wrapTitle(exactTitle,fontSize,SOCIAL_POST_CARD.title.width);
    if (!lines) continue;
    const lineHeight=Math.round(fontSize*1.04);
    const height=lines.length*lineHeight;
    if (lines.length<=5&&height<=SOCIAL_POST_CARD.title.maxHeight){
      return {title:exactTitle,fontSize,lineHeight,lines,height,maxLines:5};
    }
  }
  throw new Error('title is too long for social card');
}

function element(type,style,children,extra={}){
  return {type,props:{...extra,style,children}};
}

function graphic(type,props,children=null){
  return {type,props:{...props,children}};
}

function normalizeBadge(value){
  const badge=String(value||'GUIA').trim().toUpperCase();
  return badge||'GUIA';
}

function normalizePillar(value){
  const pillar=String(value||'casa').trim().toLowerCase();
  return ['casa','impostos','arrendamento','arrendar','condominio','vender','herancas'].includes(pillar)?pillar:'casa';
}

function badgeWidth(badge){
  return Math.max(
    SOCIAL_POST_CARD.label.minWidth,
    Math.min(SOCIAL_POST_CARD.label.maxWidth,112+[...badge].length*16)
  );
}

function watermarkForPillar(pillar){
  const stroke=SOCIAL_POST_THEME.gold;
  const common={fill:'none',stroke,strokeWidth:5,strokeLinecap:'round',strokeLinejoin:'round'};
  if (pillar==='impostos'){
    return [
      graphic('path',{...common,d:'M52 28 H154 L188 62 V194 H52 Z'}),
      graphic('path',{...common,d:'M154 28 V64 H188'}),
      graphic('path',{...common,d:'M78 94 H160 M78 120 H148 M78 146 H136'}),
      graphic('circle',{...common,cx:84,cy:178,r:30}),
      graphic('path',{...common,d:'M96 164 C88 155 70 157 68 173 C66 190 88 199 99 186 M64 176 H91 M64 184 H88'})
    ];
  }
  if (pillar==='arrendamento'||pillar==='arrendar'){
    return [
      graphic('path',{...common,d:'M34 108 L110 42 L186 108 V194 H34 Z'}),
      graphic('path',{...common,d:'M86 194 V132 H134 V194'}),
      graphic('circle',{...common,cx:145,cy:72,r:25}),
      graphic('path',{...common,d:'M123 86 L79 130 M79 130 L64 116 M79 130 L64 145'})
    ];
  }
  if (pillar==='condominio'){
    return [
      graphic('path',{...common,d:'M48 194 V56 H172 V194 Z'}),
      graphic('path',{...common,d:'M74 82 H96 V104 H74 Z M124 82 H146 V104 H124 Z M74 124 H96 V146 H74 Z M124 124 H146 V146 H124 Z'}),
      graphic('path',{...common,d:'M94 194 V160 H126 V194'})
    ];
  }
  if (pillar==='vender'){
    return [
      graphic('path',{...common,d:'M30 108 L104 44 L178 108 V194 H30 Z'}),
      graphic('circle',{...common,cx:162,cy:72,r:26}),
      graphic('path',{...common,d:'M140 88 L103 125 M103 125 L88 112 M103 125 L90 140'})
    ];
  }
  return [
    graphic('path',{...common,d:'M30 108 L110 40 L190 108 V194 H30 Z'}),
    graphic('path',{...common,d:'M82 194 V126 H138 V194'}),
    graphic('path',{...common,d:'M54 94 V58 H78 V74'})
  ];
}

function createWatermark(pillar){
  return element('svg',{
    display:'flex',position:'absolute',left:SOCIAL_POST_CARD.watermark.left,top:SOCIAL_POST_CARD.watermark.top,
    width:SOCIAL_POST_CARD.watermark.width,height:SOCIAL_POST_CARD.watermark.height,opacity:0.075
  },watermarkForPillar(pillar),{viewBox:'0 0 220 220',width:220,height:220,'aria-hidden':'true'});
}

function createHouseFooterIcon(){
  return element('svg',{
    display:'flex',position:'absolute',left:76,top:823,width:42,height:42
  },[
    graphic('path',{d:'M4 20 L21 5 L38 20 M8 18 V36 H34 V18 M17 36 V24 H25 V36',fill:'none',stroke:SOCIAL_POST_THEME.gold,strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'})
  ],{viewBox:'0 0 42 42',width:42,height:42,'aria-hidden':'true'});
}

function createPremiumOverlay(){
  const dots=[];
  for(let i=0;i<3;i+=1){
    dots.push(graphic('circle',{cx:88+i*22,cy:780,r:5,fill:SOCIAL_POST_THEME.gold,opacity:[0.62,0.38,0.2][i]}));
  }
  return element('svg',{
    display:'flex',position:'absolute',left:0,top:0,width:SOCIAL_POST_CARD.width,height:SOCIAL_POST_CARD.height
  },[
    graphic('path',{d:'M0 0H660C747 148 778 318 764 500C750 679 703 852 628 1024H0Z',fill:SOCIAL_POST_THEME.background,opacity:0.997}),
    graphic('path',{d:'M616 0H764C804 166 812 330 790 501C771 661 724 824 650 1024H594C675 847 718 674 721 500C724 315 690 151 616 0Z',fill:SOCIAL_POST_THEME.creamSecondary,opacity:0.975}),
    graphic('path',{d:'M663 -16C746 174 770 343 754 516C740 690 696 855 621 1040',fill:'none',stroke:SOCIAL_POST_THEME.gold,strokeWidth:2.4,opacity:0.96}),
    graphic('path',{d:'M785 -18C867 164 891 330 872 501C855 670 812 837 739 1042',fill:'none',stroke:SOCIAL_POST_THEME.petrol,strokeWidth:11,opacity:0.97}),
    graphic('path',{d:'M807 -18C887 166 912 333 894 506C876 677 835 842 764 1042',fill:'none',stroke:SOCIAL_POST_THEME.goldLight,strokeWidth:2.2,opacity:0.92}),
    graphic('path',{d:'M828 570C790 657 766 754 758 854C818 839 876 818 930 793C883 731 849 655 828 570Z',fill:SOCIAL_POST_THEME.gold,opacity:0.82}),
    graphic('path',{d:'M-84 350C-20 365 20 420 20 494C20 570-22 630-82 649',fill:'none',stroke:SOCIAL_POST_THEME.gold,strokeWidth:1.25,opacity:0.24}),
    ...dots
  ],{viewBox:'0 0 1536 1024',width:1536,height:1024,'aria-hidden':'true'});
}

function createOrnamentLine(){
  return element('svg',{
    display:'flex',position:'absolute',left:0,top:0,width:1536,height:1024
  },[
    graphic('polygon',{points:'389,170 393,184 407,188 393,192 389,206 385,192 371,188 385,184',fill:SOCIAL_POST_THEME.gold,opacity:0.88}),
    graphic('line',{x1:425,y1:188,x2:654,y2:188,stroke:SOCIAL_POST_THEME.gold,strokeWidth:2,opacity:0.88})
  ],{viewBox:'0 0 1536 1024',width:1536,height:1024,'aria-hidden':'true'});
}

export function createSocialPostLayout({title,badge='GUIA',image,pillar='casa'}){
  if (!image) throw new Error('base image is required');
  const exactBadge=normalizeBadge(badge);
  const exactPillar=normalizePillar(pillar);
  const titleLayout=selectSocialPostTitleLayout(title);
  const labelWidth=badgeWidth(exactBadge);
  const tree=element('div',{
    display:'flex',position:'relative',width:SOCIAL_POST_CARD.width,height:SOCIAL_POST_CARD.height,
    overflow:'hidden',backgroundColor:SOCIAL_POST_THEME.background
  },[
    element('img',{
      position:'absolute',left:0,top:0,width:SOCIAL_POST_CARD.width,height:SOCIAL_POST_CARD.height,
      objectFit:'cover',objectPosition:'center center'
    },null,{src:image,width:SOCIAL_POST_CARD.width,height:SOCIAL_POST_CARD.height}),
    createPremiumOverlay(),
    createWatermark(exactPillar),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.label.left,top:SOCIAL_POST_CARD.label.top,
      width:labelWidth,height:SOCIAL_POST_CARD.label.height,borderRadius:35,
      alignItems:'center',justifyContent:'center',backgroundColor:SOCIAL_POST_THEME.petrol,
      color:SOCIAL_POST_THEME.goldLight,border:`2px solid ${SOCIAL_POST_THEME.gold}`,
      fontFamily:'Lato',fontWeight:700,fontSize:27,letterSpacing:exactBadge.length>12?2.2:4.2,
      paddingLeft:24,paddingRight:24
    },exactBadge),
    createOrnamentLine(),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.title.left,top:SOCIAL_POST_CARD.title.top,
      width:SOCIAL_POST_CARD.title.width,height:titleLayout.height,flexDirection:'column',
      color:SOCIAL_POST_THEME.ink,fontFamily:'Cormorant Garamond',fontWeight:500,
      fontSize:titleLayout.fontSize,lineHeight:1,letterSpacing:-0.55
    },titleLayout.lines.map((line,index)=>element('div',{
      display:'flex',width:SOCIAL_POST_CARD.title.width,height:titleLayout.lineHeight,alignItems:'center'
    },line,{key:`social-title-${index}`}))),
    createHouseFooterIcon(),
    element('div',{
      display:'flex',position:'absolute',left:112,top:845,width:352,height:2,
      backgroundColor:SOCIAL_POST_THEME.gold,opacity:0.9
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.brand.left,top:SOCIAL_POST_CARD.brand.top,
      width:SOCIAL_POST_CARD.brand.width,height:SOCIAL_POST_CARD.brand.height,alignItems:'center',
      color:SOCIAL_POST_THEME.ink,fontFamily:'Cormorant Garamond',fontWeight:500,fontSize:34
    },'Guia do Proprietário'),
    element('div',{
      display:'flex',position:'absolute',right:34,bottom:28,width:122,height:6,borderRadius:4,
      backgroundColor:SOCIAL_POST_THEME.gold,opacity:0.72
    },null),
    element('div',{
      display:'flex',position:'absolute',right:34,bottom:42,width:82,height:4,borderRadius:4,
      backgroundColor:SOCIAL_POST_THEME.petrol,opacity:0.76
    },null)
  ],{lang:'pt-PT'});

  return {
    tree,
    metrics:{
      variant:'social',
      design:'premium-editorial-v2',
      badge:exactBadge,
      pillar:exactPillar,
      title:{...SOCIAL_POST_CARD.title,...titleLayout,bottom:SOCIAL_POST_CARD.title.top+titleLayout.height},
      label:{...SOCIAL_POST_CARD.label,width:labelWidth,border:true,goldText:true},
      image:{...SOCIAL_POST_CARD.image},
      curve:{...SOCIAL_POST_CARD.curve,layered:true,gold:true,petrol:true},
      watermark:{...SOCIAL_POST_CARD.watermark,pillar:exactPillar},
      footer:{...SOCIAL_POST_CARD.footer,houseIcon:true,goldRule:true},
      textSafeRight:SOCIAL_POST_CARD.textSafeRight,
      exactSource:'',
      source:null
    }
  };
}
